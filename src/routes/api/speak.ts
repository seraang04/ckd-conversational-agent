import { createFileRoute } from "@tanstack/react-router";

type SpeakBody = { text?: unknown; language?: unknown };

const VOICE_INSTRUCTIONS = {
  en: "Speak as Clara, a warm Singaporean Chinese young woman around 18 to 20 years old. Use a genuinely youthful, soft, naturally feminine Asian voice with clear Singapore English and a gentle, familiar local cadence. Sound like a caring younger granddaughter or nursing student sitting beside an older Singaporean: kind, compassionate, patient, respectful, and reassuring. Keep the accent natural and subtle; never exaggerate Singlish or sound Western, formal, clinical, stern, robotic, childish, overly cheerful, theatrical, or breathy. Use a relaxed, slightly slow pace, comfortable pauses, and a light friendly warmth. Let each question feel like a caring invitation, with a soft upward lift at the end. Do not add or change words.",
  zh: "请以 Clara 的身份说话。声音像一位十八至二十岁的新加坡华人年轻女性，年轻、柔和、自然、有亲切感，以清楚温暖的新加坡华语和自然的本地语调表达。感觉像一位关心长辈的年轻孙女或护理学生坐在身边慢慢陪他说话：体贴、有耐心、尊重、让人安心。保留轻柔自然的新加坡口音，不要刻意夸张，也不要像中国播音腔。不要严肃、正式、临床、强硬、机械、幼稚、过度活泼、戏剧化或气声太重。语速放松并稍慢，句子间自然停顿，把每个问题说成关心而温柔的邀请。提问结尾轻柔友善。不要增删文字。",
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
                voice: "coral",
                instructions: VOICE_INSTRUCTIONS[language],
                speed: language === "en" ? 0.94 : 0.9,
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
