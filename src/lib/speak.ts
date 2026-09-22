import type { Language } from "@/lib/language";

let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let currentRequest: AbortController | null = null;
let generation = 0;

export function stopSpeaking() {
  generation += 1;
  currentRequest?.abort();
  currentRequest = null;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  if (current) {
    current.onended = null;
    current.onerror = null;
    current.pause();
    current.removeAttribute("src");
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
  audio.onerror = () => {
    if (current === audio) stopSpeaking();
  };
  try {
    await audio.play();
    return true;
  } catch {
    if (current === audio) {
      current = null;
      audio.onended = null;
      audio.onerror = null;
      audio.removeAttribute("src");
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

/** Generate the displayed question audio when it is requested. */
export async function speak(text: string, language: Language): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSpeaking();
  const requestGeneration = generation;
  if (text.length <= 800) {
    const controller = new AbortController();
    currentRequest = controller;
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
        signal: controller.signal,
      });
      if (res.ok && res.status !== 204) {
        const blob = await res.blob();
        if (requestGeneration !== generation) return;
        if (blob.size > 0 && (await playAudio(URL.createObjectURL(blob), true))) return;
      }

    } catch {
      // Continue with the device voice if live speech is unavailable.
    } finally {
      if (currentRequest === controller) currentRequest = null;
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
