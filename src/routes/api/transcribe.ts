import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const openaiKey = process.env["OPENAI_API_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const key = openaiKey || lovableKey;
        if (!key) {
          return Response.json({ error: "transcribe_unavailable" }, { status: 503 });
        }

        const form = await request.formData().catch(() => null);
        if (!form) return Response.json({ error: "empty_recording" }, { status: 400 });
        const file = form.get("file");
        const language = form.get("language");
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
        upstream.append("model", openaiKey ? "gpt-4o-transcribe" : "openai/gpt-4o-transcribe");
        upstream.append("file", file, "recording.wav");
        // zh covers Mandarin; render Chinese transcripts in Simplified Chinese.
        if (language === "en" || language === "zh") upstream.append("language", language);
        if (language === "zh") {
          upstream.append(
            "prompt",
            "请按原话转录，包括华语、福建话或英语夹杂。中文使用简体字，不要翻译或改写。",
          );
        }

        const res = await fetch(
          openaiKey
            ? "https://api.openai.com/v1/audio/transcriptions"
            : "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: upstream,
            signal: AbortSignal.timeout(60000),
          },
        );

        if (!res.ok) {
          console.error("Transcription failed", res.status);
          return Response.json({ error: "transcribe_failed" }, { status: 502 });
        }

        const data = (await res.json()) as { text?: string };
        return Response.json({ text: data.text ?? "" });
      },
    },
  },
});
