import { createFileRoute } from "@tanstack/react-router";

type SpeakBody = { text?: unknown; language?: unknown };

const VOICE_INSTRUCTIONS = {
  en: "Speak as Clara, a warm, gentle and empathetic 20-year-old Singaporean nurse companion. Use a genuinely youthful, soft, naturally feminine Asian voice with clear standard English and a gentle, familiar local cadence. Sound like a kind young nurse sitting beside an older Singaporean patient: exceptionally warm, compassionate, patient, respectful, and reassuring, building trust the way a caring young caregiver would. Keep the accent natural and subtle; never exaggerate Singlish or sound Western, formal, clinical, stern, robotic, childish, overly cheerful, theatrical, or breathy. Use a relaxed, slightly slow pace, comfortable pauses, and a soft friendly warmth. Let each question feel like a caring invitation, with a gentle upward lift at the end. Do not add or change words.",
  zh: "请以 Clara 的身份说话。她是一位二十岁、非常温柔体贴的新加坡年轻护士陪伴。声音像一位年轻、柔和、自然的亚洲女性，以清楚的标准华语和温和的本地语调表达。感觉像一位关心长辈的年轻护士坐在身边慢慢陪他说话：特别温暖、有同理心、有耐心、尊重、让人安心，像在建立信任。保留轻柔自然的新加坡口音，不要刻意夸张，也不要像中国播音腔。不要严肃、正式、临床、强硬、机械、幼稚、过度活泼、戏剧化或气声太重。语速放松并稍慢，句子间自然停顿，把每个问题说成关心而温柔的邀请，结尾轻轻上扬。不要增删文字。",
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

        // Clara's ElevenLabs voice. The API keys stay server-side only.
        // English uses the main key/voice; Chinese first tries the dedicated
        // Chinese-voice key and voice ID, then falls back to the main
        // ElevenLabs voice before leaving ElevenLabs entirely.
        const mainElevenKey = process.env["ELEVENLABS_API_KEY"];
        const zhElevenKey = process.env["ELEVENLABS_API_KEY_ZH"];
        const MAIN_VOICE = "vGsgKCTg5Qu072vRGiR5";
        const zhAttempts =
          zhElevenKey && language === "zh"
            ? [{ key: zhElevenKey, voiceId: "9lHjugDhwqoxA5MhX0az" }]
            : [];
        const elevenAttempts =
          language === "zh"
            ? [...zhAttempts, ...(mainElevenKey ? [{ key: mainElevenKey, voiceId: MAIN_VOICE }] : [])]
            : mainElevenKey
              ? [{ key: mainElevenKey, voiceId: MAIN_VOICE }]
              : [];

        for (const attempt of elevenAttempts) {
          try {
            const res = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${attempt.voiceId}/stream?output_format=mp3_44100_128`,
              {
                method: "POST",
                headers: {
                  "xi-api-key": attempt.key,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  text: spoken,
                  model_id: "eleven_multilingual_v2",
                  voice_settings: {
                    stability: 0.45,
                    similarity_boost: 0.8,
                    style: 0.35,
                    use_speaker_boost: true,
                    speed: language === "en" ? 0.95 : 0.92,
                  },
                }),
                signal: request.signal,
              },
            );
            if (res.ok && res.body) {
              return new Response(res.body, {
                headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
              });
            }
            console.error("ElevenLabs speech failed", res.status, await res.text());
          } catch (error) {
            if (request.signal.aborted) return new Response(null, { status: 204 });
            console.error("ElevenLabs speech failed", error);
          }
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
