import { createFileRoute } from "@tanstack/react-router";

type SpeakBody = { text?: unknown; language?: unknown };

const VOICE_INSTRUCTIONS = {
  en: "Speak in clear Singapore English with a light, natural local cadence. Sound warm, calm and conversational. Ask the question at an everyday pace. Do not add or change words.",
  zh: "请用清晰、自然的新加坡华语发问。语气亲切、温暖，语速自然，适当停顿。不要增删文字。",
} as const;

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as SpeakBody | null;
        const language = body?.language;
        if (language !== "en" && language !== "zh") {
          return Response.json({ error: "invalid_language" }, { status: 400 });
        }
        const spoken = typeof body?.text === "string" ? body.text.trim() : "";
        if (!spoken || spoken.length > 800) {
          return Response.json({ error: "invalid_text" }, { status: 400 });
        }

        const openaiKey = process.env["OPENAI_API_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];

        const providers: { url: string; key: string; model: string }[] = [
          ...(openaiKey
            ? [
                {
                  url: "https://api.openai.com/v1/audio/speech",
                  key: openaiKey,
                  model: "gpt-4o-mini-tts",
                },
              ]
            : []),
          ...(lovableKey
            ? [
                {
                  url: "https://ai.gateway.lovable.dev/v1/audio/speech",
                  key: lovableKey,
                  model: "openai/gpt-4o-mini-tts",
                },
              ]
            : []),
        ];
        if (providers.length === 0) {
          // 204: the browser quietly falls back to the device voice.
          return new Response(null, { status: 204 });
        }

        for (const provider of providers) {
          try {
            const res = await fetch(provider.url, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${provider.key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: provider.model,
                input: spoken,
                voice: language === "en" ? "coral" : "shimmer",
                instructions: VOICE_INSTRUCTIONS[language],
                response_format: "mp3",
                stream_format: "audio",
              }),
              signal: request.signal,
            });

            if (res.ok && res.body) {
              return new Response(res.body, {
                headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
              });
            }
            console.error("Speech generation failed", provider.url, res.status);
          } catch (error) {
            if (request.signal.aborted) return new Response(null, { status: 204 });
            console.error("Speech generation failed", provider.url, error);
          }
        }

        // No provider produced audio; the device voice takes over instead of showing an error.
        return new Response(null, { status: 204 });

      },
    },
  },
});
