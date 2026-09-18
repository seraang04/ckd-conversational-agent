import { Loader2, Mic, Pencil, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BigButton, Card, SpeakerBadge, inputClass } from "@/components/ckd/ui";
import { startRecording, type Recorder } from "@/lib/recorder";
import { speak, stopSpeaking, transcribe } from "@/lib/speak";
import { cn } from "@/lib/utils";

type Props = {
  questionZh: string;
  questionEn: string;
  dialect: string;
  speaker: "patient" | "caregiver";
  onSpeakerChange: (speaker: "patient" | "caregiver") => void;
  onSubmit: (answer: string, mode: "voice" | "typed") => void;
  onSkip: () => void;
  onDefer: () => void;
  busy?: boolean;
  reflection?: string | null;
};

export function VoiceAnswer({
  questionZh,
  questionEn,
  dialect,
  speaker,
  onSpeakerChange,
  onSubmit,
  onSkip,
  onDefer,
  busy,
  reflection,
}: Props) {
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);

  useEffect(() => {
    setDraft("");
    setTyping(false);
    setError(null);
    void speak(questionZh, dialect);
    return () => stopSpeaking();
  }, [questionZh, dialect]);

  const begin = useCallback(async () => {
    setError(null);
    stopSpeaking();
    try {
      recorderRef.current = await startRecording(setLevel);
      setRecording(true);
    } catch {
      setError("没办法使用麦克风。请允许麦克风权限，或用打字。 · Microphone unavailable — allow access or type instead.");
      setTyping(true);
    }
  }, []);

  const finish = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setRecording(false);
    setWorking(true);
    recorderRef.current = null;
    try {
      const blob = await recorder.stop();
      const text = await transcribe(blob, "zh");
      if (!text) throw new Error("empty_recording");
      setDraft((prev) => (prev ? `${prev} ${text}` : text));
    } catch (err) {
      setError(
        (err as Error).message === "empty_recording"
          ? "没有听到声音，请再说一次。 · Nothing was heard — please try again."
          : "刚刚没听清楚，请再说一次，或用打字。 · That didn't come through — try again or type it.",
      );
    } finally {
      setWorking(false);
      setLevel(0);
    }
  }, []);

  return (
    <Card className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <SpeakerBadge speaker={speaker} />
        <button
          type="button"
          onClick={() => onSpeakerChange(speaker === "patient" ? "caregiver" : "patient")}
          className="rounded-full border-2 border-border px-4 py-2 text-sm font-medium text-foreground"
        >
          换人说话 · Switch speaker
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-3xl font-semibold leading-snug text-foreground">{questionZh}</p>
        <p className="text-base text-muted-foreground">{questionEn}</p>
        <button
          type="button"
          onClick={() => void speak(questionZh, dialect)}
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
        >
          <Volume2 className="h-4 w-4" /> 再听一次 · Read aloud
        </button>
      </div>

      {reflection ? (
        <div className="rounded-2xl bg-secondary p-4 text-base leading-relaxed text-secondary-foreground whitespace-pre-line">
          {reflection}
        </div>
      ) : null}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => (recording ? void finish() : void begin())}
          disabled={working || busy}
          className={cn(
            "flex w-full flex-col items-center gap-3 rounded-3xl px-6 py-10 text-xl font-semibold transition-colors disabled:opacity-60",
            recording
              ? "bg-destructive text-destructive-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-foreground/15"
            style={recording ? { transform: `scale(${1 + Math.min(level, 0.5)})` } : undefined}
          >
            {working ? (
              <Loader2 className="h-10 w-10 animate-spin" />
            ) : recording ? (
              <Square className="h-9 w-9" />
            ) : (
              <Mic className="h-10 w-10" />
            )}
          </span>
          {working ? "正在整理您的话…" : recording ? "说完了，按一下 · Tap when done" : "按住说话 · Tap to speak"}
        </button>

        {!typing ? (
          <button
            type="button"
            onClick={() => setTyping(true)}
            className="inline-flex items-center gap-2 text-base font-medium text-primary underline"
          >
            <Pencil className="h-4 w-4" /> 帮他打字 · Type the answer instead
          </button>
        ) : null}
      </div>

      {error ? <p className="text-base text-destructive">{error}</p> : null}

      {typing || draft ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={5}
          placeholder="在这里打字 · Type here"
          className={cn(inputClass, "text-xl leading-relaxed")}
        />
      ) : null}

      {draft.trim() ? (
        <BigButton onClick={() => onSubmit(draft.trim(), typing ? "typed" : "voice")} disabled={busy}>
          {busy ? "…" : "就是这样 · That's right"}
        </BigButton>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-full border-2 border-border px-4 py-3 text-sm font-medium"
        >
          跳过这题 · Skip
        </button>
        <button
          type="button"
          onClick={onDefer}
          className="rounded-full border-2 border-border px-4 py-3 text-sm font-medium"
        >
          留给协调员谈 · Leave for the coordinator
        </button>
      </div>
    </Card>
  );
}
