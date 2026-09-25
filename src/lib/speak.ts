import type { Language } from "@/lib/language";

let current: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let currentRequest: AbortController | null = null;
let finishCurrentAudio: ((ok: boolean) => void) | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;
let finishUtterance: (() => void) | null = null;
let generation = 0;

export function stopSpeaking() {
  generation += 1;
  currentRequest?.abort();
  currentRequest = null;
  if (finishUtterance) finishUtterance();
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  currentUtterance = null;
  finishUtterance = null;
  if (finishCurrentAudio) finishCurrentAudio(false);
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

function browserSpeak(
  text: string,
  language: Language,
  onPlaybackStart?: () => void,
): Promise<void> {
  if (!window.speechSynthesis) return Promise.resolve();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;
    utterance.lang = language === "en" ? "en-SG" : "zh-SG";
    utterance.rate = language === "en" ? 0.9 : 0.86;
    utterance.pitch = 1.1;
    utterance.volume = 0.92;

    const voices = window.speechSynthesis.getVoices();
    const preferredNames =
      /female|sin-ji|tingting|xiaoxiao|huihui|mei-jia|serena|samantha|zira|siri/i;
    const languagePrefix = language === "en" ? "en" : "zh";
    const preferredLocale = language === "en" ? "en-sg" : "zh-sg";
    const localVoice =
      voices.find(
        (voice) => voice.lang.toLowerCase() === preferredLocale && preferredNames.test(voice.name),
      ) ??
      voices.find((voice) => voice.lang.toLowerCase() === preferredLocale) ??
      voices.find(
        (voice) =>
          voice.lang.toLowerCase().startsWith(languagePrefix) && preferredNames.test(voice.name),
      ) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith(languagePrefix));
    if (localVoice) utterance.voice = localVoice;

    const finish = () => {
      utterance.onend = null;
      utterance.onerror = null;
      if (currentUtterance === utterance) {
        currentUtterance = null;
        finishUtterance = null;
      }
      resolve();
    };
    finishUtterance = finish;
    utterance.onend = finish;
    utterance.onerror = finish;
    onPlaybackStart?.();
    window.speechSynthesis.speak(utterance);
  });
}

/** Split spoken text into sentence-sized pieces so audio can start sooner. */
export function splitSentences(text: string): string[] {
  const pieces = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？；;…])\s*/u)
    .map((piece) => piece.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks[chunks.length - 1];
    // Keep very short fragments attached so the voice does not sound clipped.
    if (last && (last.length < 12 || piece.length < 12) && last.length + piece.length <= 240) {
      chunks[chunks.length - 1] = `${last} ${piece}`;
    } else {
      chunks.push(piece.slice(0, 780));
    }
  }
  return chunks.length > 0 ? chunks : [text.trim().slice(0, 780)];
}

/** Fetch one sentence of speech audio; resolves to null when unavailable. */
async function fetchSpeech(
  text: string,
  language: Language,
  signal: AbortSignal,
): Promise<Blob | null> {
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
      signal,
    });
    if (!res.ok || res.status === 204) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

function playQueued(
  blob: Blob,
  requestGeneration: number,
  onPlaybackStart?: () => void,
): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    current = audio;
    currentUrl = url;
    const finish = (ok: boolean) => {
      audio.onended = null;
      audio.onerror = null;
      if (current === audio) {
        current = null;
        audio.pause();
        audio.removeAttribute("src");
      }
      if (currentUrl === url) {
        URL.revokeObjectURL(url);
        currentUrl = null;
      }
      if (finishCurrentAudio === finish) finishCurrentAudio = null;
      resolve(ok && requestGeneration === generation);
    };
    finishCurrentAudio = finish;
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    audio
      .play()
      .then(() => onPlaybackStart?.())
      .catch(() => finish(false));
  });
}

/**
 * Speak the text sentence by sentence: each sentence is generated while the
 * previous one plays, and the returned audio chunks are queued back to back.
 */
export async function speak(
  text: string,
  language: Language,
  onPlaybackChange?: (playing: boolean) => void,
): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSpeaking();
  const requestGeneration = generation;
  const controller = new AbortController();
  currentRequest = controller;
  let playbackNotified = false;
  const notifyPlayback = (playing: boolean) => {
    if (playbackNotified === playing) return;
    playbackNotified = playing;
    onPlaybackChange?.(playing);
  };

  const sentences = splitSentences(text);
  let pending = fetchSpeech(sentences[0]!, language, controller.signal);

  try {
    for (let index = 0; index < sentences.length; index += 1) {
      const blob = await pending;
      if (requestGeneration !== generation) return;
      // Start generating the next sentence while this one plays.
      const nextSentence = sentences[index + 1];
      pending = nextSentence
        ? fetchSpeech(nextSentence, language, controller.signal)
        : Promise.resolve(null);
      if (!blob) {
        // Live speech unavailable: let the device voice read the rest.
        controller.abort();
        if (requestGeneration === generation) {
          await browserSpeak(sentences.slice(index).join(" "), language, () =>
            notifyPlayback(true),
          );
        }
        return;
      }
      const played = await playQueued(blob, requestGeneration, () => notifyPlayback(true));
      if (!played) {
        if (requestGeneration === generation) {
          await browserSpeak(sentences.slice(index).join(" "), language, () =>
            notifyPlayback(true),
          );
        }
        return;
      }
    }
  } finally {
    if (currentRequest === controller) currentRequest = null;
    notifyPlayback(false);
  }
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
