let current: HTMLAudioElement | null = null;

export function stopSpeaking() {
  if (current) {
    current.pause();
    current.src = "";
    current = null;
  }
}

/** Reads text aloud through the app's own voice endpoint. Silent on failure. */
export async function speak(text: string, dialect: string): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSpeaking();
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, dialect }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    current = audio;
    await audio.play().catch(() => undefined);
  } catch {
    // Reading aloud is an aid, never a blocker.
  }
}

export async function transcribe(blob: Blob, language: string): Promise<string> {
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
