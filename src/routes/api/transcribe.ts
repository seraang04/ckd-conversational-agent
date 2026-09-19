import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Speech is not configured", { status: 500 });

        const form = await request.formData();
        const file = form.get("file");
        const language = String(form.get("language") ?? "");
        if (!(file instanceof File) || file.size < 2048) {
          return new Response(JSON.stringify({ error: "empty_recording" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (file.size > 20 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: "too_large" }), { status: 400 });
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", file, "recording.wav");
        // zh covers Mandarin; render Chinese transcripts in Simplified Chinese.
        if (language) upstream.append("language", language);
        if (language === "zh") {
          upstream.append(
            "prompt",
            "请使用简体中文记录语音内容，保留说话者的原意。不要使用繁体字。",
          );
        }

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return new Response(JSON.stringify({ error: detail.slice(0, 400) }), {
            status: res.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        const data = (await res.json()) as { text?: string };
        return new Response(JSON.stringify({ text: data.text ?? "" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
