import { createFileRoute } from "@tanstack/react-router";

type SpeakBody = { text?: unknown; language?: unknown };

const VOICE_INSTRUCTIONS = {
  en: "Speak as Clara, a kind 18-to-20-year-old female conversation companion. Use a youthful, soft, naturally feminine voice with warm Singapore English and a light local cadence. Speak as though sitting beside an older person who deserves time and care: compassionate, gentle, patient, and reassuring. Never sound serious, formal, clinical, stern, robotic, childish, overly cheerful, or breathy. Keep a relaxed, slightly slow pace, use comfortable pauses, and let each question land as a warm invitation rather than an interview. End questions with a soft, friendly lift. Do not add or change words.",
  zh: "请以 Clara 的身份说话。声音像一位十八至二十岁的年轻女性，柔和、自然、亲切，以温暖的新加坡华语表达。就像坐在长者身边陪他慢慢说话一样：有耐心、有同理心、让人安心。不要严肃、正式、临床、强硬、机械、幼稚、过度活泼或气声太重。语速放松并稍慢，句子间自然停顿，把每个问题说成温柔的邀请，而不是问话。提问结尾轻柔友善。不要增删文字。",
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
                voice: "shimmer",
                instructions: VOICE_INSTRUCTIONS[language],
                speed: language === "en" ? 0.92 : 0.88,
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
