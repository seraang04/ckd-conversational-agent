import { createFileRoute } from "@tanstack/react-router";

type SpeakBody = { text?: string; dialect?: string };

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Speech is not configured", { status: 500 });

        const { text, dialect } = (await request.json()) as SpeakBody;
        const spoken = (text ?? "").slice(0, 1200).trim();
        if (!spoken) return new Response("No text", { status: 400 });

        const instructions =
          dialect === "hokkien"
            ? "Speak in Hokkien (Minnan) as an older Singaporean or Malaysian speaker would. Warm, slow, gentle, like talking with an elderly patient."
            : "Speak in gentle Mandarin Chinese, slowly and warmly, like talking with an elderly patient. Pause between sentences.";

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: spoken,
            voice: "shimmer",
            instructions,
            response_format: "mp3",
            stream_format: "audio",
          }),
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          return new Response(detail.slice(0, 400) || "Speech failed", { status: res.status });
        }

        return new Response(res.body, {
          headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
        });
      },
    },
  },
});
