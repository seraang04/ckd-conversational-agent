import { localBackend } from "@/lib/ckd-db";
import { SPOKEN_PROMPTS } from "@/lib/ckd-script";
import type { Language } from "@/lib/language";

let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let generation = 0;

export function stopSpeaking() {
  generation += 1;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  if (current) {
    current.pause();
    current.src = "";
    current = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

async function playAudio(url: string, objectUrl = false): Promise<boolean> {
  const audio = new Audio(url);
  current = audio;
  if (objectUrl) currentUrl = url;
  audio.onended = () => {
    if (current === audio) stopSpeaking();
  };
  try {
    await audio.play();
    return true;
  } catch {
    if (current === audio) {
      current = null;
      audio.src = "";
      if (objectUrl && currentUrl === url) {
        URL.revokeObjectURL(url);
        currentUrl = null;
      }
    }
    return false;
  }
}

function browserSpeak(text: string, language: Language) {
  if (!window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === "en" ? "en-SG" : "zh-CN";
  window.speechSynthesis.speak(utterance);
}

/** Play the approved question audio. Use the existing speech endpoint for other text. */
export async function speak(text: string, language: Language): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSpeaking();
  const requestGeneration = generation;
  const prompt = SPOKEN_PROMPTS.find((item) => item[language] === text);
  if (prompt) {
    if (await playAudio(`/audio/questions/${language}/${prompt.id}.mp3?v=2`)) return;
  }

  if (!localBackend) {
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, dialect: language }),
      });
      if (res.ok) {
        const blob = await res.blob();
        if (requestGeneration !== generation) return;
        if (await playAudio(URL.createObjectURL(blob), true)) return;
      }
    } catch {
      // Continue with the device voice if the endpoint is unavailable.
    }
  }
  if (requestGeneration === generation) browserSpeak(text, language);
}

export async function transcribe(blob: Blob, language: Language): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "recording.wav");
  if (language) form.append("language", language);
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(detail.error === "empty_recording" ? "empty_recording" : "transcribe_failed");
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}
