import { mkdir, rename, stat, writeFile } from "node:fs/promises";

import { SCRIPT, SENSITIVE_GATE } from "../src/lib/ckd-script.ts";

const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error("Set OPENAI_API_KEY in the ignored .env.local file first.");

const root = new URL("../public/audio/questions/", import.meta.url);
const prompts = [...SCRIPT, SENSITIVE_GATE];
const force = process.argv.includes("--force");
const languages = [
  {
    code: "en",
    voice: process.env.OPENAI_TTS_VOICE_EN || "coral",
    instructions:
      "Speak in clear Singapore English with a light, natural local cadence. Sound warm, calm and conversational, like a familiar person asking one question. Use a comfortable everyday pace and a gentle rise at the end. Avoid a scripted, announcer-like or clinical delivery. Do not exaggerate the accent, and do not add or change words.",
  },
  {
    code: "zh",
    voice: process.env.OPENAI_TTS_VOICE_ZH || "shimmer",
    instructions:
      "请用清晰、自然的新加坡华语说出这个问题。语气亲切、温暖，像熟悉的人轻声发问，语速自然，适当停顿。保留一点自然的本地口音，不要刻意夸张，也不要用播音、客服或临床问诊的腔调。不要增删文字。",
  },
];

for (const language of languages) {
  await mkdir(new URL(`${language.code}/`, root), { recursive: true });
  for (const prompt of prompts) {
    const name = `${language.code}/${prompt.id}.mp3`;
    const output = new URL(name, root);
    if (!force && (await stat(output).catch(() => null))?.size) {
      console.log(`Keeping ${name}`);
      continue;
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: language.voice,
        input: prompt[language.code],
        instructions: language.instructions,
        response_format: "mp3",
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) {
      throw new Error(`OpenAI returned HTTP ${response.status} for ${name}.`);
    }
    if (!response.headers.get("content-type")?.includes("audio")) {
      throw new Error(`OpenAI did not return audio for ${name}.`);
    }
    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 1024) throw new Error(`Audio was unexpectedly small for ${name}.`);
    const temporary = new URL(`${name}.tmp`, root);
    await writeFile(temporary, audio);
    await rename(temporary, output);
    console.log(`Generated ${name} (${Math.round(audio.length / 1024)} KB)`);
  }
}
