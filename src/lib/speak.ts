let current: (() => void) | null = null;
let pending: AbortController | null = null;

export function stopSpeaking() {
  pending?.abort();
  pending = null;
  current?.();
}

/** Reads text aloud through the app's own voice endpoint. Silent on failure. */
export async function speak(text: string, dialect: string): Promise<void> {
  if (typeof window === "undefined" || !text.trim()) return;
  stopSpeaking();
  const controller = new AbortController();
  pending = controller;
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, dialect }),
      signal: controller.signal,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    // A cancelled request may still finish; only the latest request can play.
    if (controller.signal.aborted) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      URL.revokeObjectURL(url);
      if (current === cleanup) current = null;
    };
    current = cleanup;
    audio.onended = cleanup;
    audio.onerror = cleanup;
    await audio.play().catch(cleanup);
  } catch {
    // Reading aloud is an aid, never a blocker.
  } finally {
    if (pending === controller) pending = null;
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
