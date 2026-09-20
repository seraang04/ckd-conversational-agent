import { useText, type Language } from "@/lib/language";
import { Keyboard, Mic, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BigButton, SpeakerBadge, inputClass, quietActionClass } from "@/components/ckd/ui";
import { startRecording, type Recorder } from "@/lib/recorder";
import { speak, stopSpeaking, transcribe } from "@/lib/speak";
import { cn } from "@/lib/utils";

type Props = {
  questionZh: string;
  questionEn: string;
  language: Language;
  speaker: "patient" | "caregiver";
  onSubmit: (answer: string, mode: "voice" | "typed") => void;
  onSkip: () => void;
  onDefer?: () => void;
  busy?: boolean;
};

function elapsedTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function VoiceAnswer({
  questionZh,
  questionEn,
  language,
  speaker,
  onSubmit,
  onSkip,
  onDefer,
  busy,
}: Props) {
  const t = useText(language);
  const question = language === "en" ? questionEn : questionZh;
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [answerMode, setAnswerMode] = useState<"voice" | "typed">("typed");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const recorderRef = useRef<Recorder | null>(null);
  const autoplayTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setDraft("");
    setTyping(false);
    setAnswerMode("typed");
    setError(null);
    return () => {
      stopSpeaking();
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, [question]);

  useEffect(() => {
    // Defer playback so React's development effect replay does not start it twice.
    autoplayTimerRef.current = window.setTimeout(() => {
      autoplayTimerRef.current = null;
      void speak(question, language);
    }, 0);
    return () => {
      if (autoplayTimerRef.current !== null) window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
      stopSpeaking();
    };
  }, [question, language]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const begin = useCallback(async () => {
    setError(null);
    if (autoplayTimerRef.current !== null) window.clearTimeout(autoplayTimerRef.current);
    autoplayTimerRef.current = null;
    stopSpeaking();
    try {
      recorderRef.current = await startRecording(setLevel);
      setRecordedSeconds(0);
      setRecording(true);
    } catch {
      setError(
        t("无法使用麦克风。您可以打字回答。", "Microphone unavailable. You can type your answer."),
      );
      setTyping(true);
    }
  }, [t]);

  const finish = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    setRecording(false);
    setWorking(true);
    try {
      const blob = await recorder.stop();
      const text = await transcribe(blob, language);
      if (!text) throw new Error("empty_recording");
      setDraft((prev) => (prev ? `${prev} ${text}` : text));
      setAnswerMode("voice");
    } catch (err) {
      setError(
        (err as Error).message === "empty_recording"
          ? t("没有听到声音，请再试一次。", "Nothing was heard. Please try again.")
          : t(
              "没听清楚。请再试一次，或打字回答。",
              "We couldn't hear that. Try again or type your answer.",
            ),
      );
    } finally {
      setWorking(false);
      setLevel(0);
    }
  }, [language, t]);

  const showRecorder = recording || working || (!draft && !typing);

  return (
    <section className="mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-3xl grid-rows-[minmax(11rem,auto)_minmax(14rem,1fr)_auto] gap-4 py-3 sm:min-h-[calc(100dvh-9rem)] sm:grid-rows-[minmax(11rem,auto)_minmax(16rem,1fr)_auto] sm:py-4">
      <div className="space-y-4">
        {speaker === "caregiver" ? <SpeakerBadge speaker={speaker} /> : null}
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {question}
        </h1>
        <button
          type="button"
          className={quietActionClass}
          disabled={recording || working}
          onClick={() => void speak(question, language)}
        >
          <Volume2 className="h-6 w-6" aria-hidden />
          {t("听题目", "Hear question")}
        </button>
      </div>

      {showRecorder ? (
        <div className="flex flex-col items-center justify-center gap-4 py-3 text-center">
          <div
            className={cn(
              "rounded-full p-2 transition-colors",
              recording ? "bg-destructive/15" : "bg-primary/10",
            )}
            style={
              recording ? { transform: `scale(${1 + Math.min(level, 0.5) * 0.08})` } : undefined
            }
          >
            <button
              type="button"
              aria-label={
                recording ? t("结束录音", "Stop recording") : t("说出回答", "Speak your answer")
              }
              onClick={() => (recording ? void finish() : void begin())}
              disabled={working || busy}
              className={cn(
                "relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full text-primary-foreground shadow-md transition-colors focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-60 sm:h-40 sm:w-40",
                recording ? "bg-destructive" : "bg-primary hover:bg-primary/90",
              )}
            >
              {working ? (
                <span
                  aria-hidden
                  className="absolute inset-0 animate-[ping_1.6s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-primary-foreground/25"
                />
              ) : null}
              {working ? (
                <Mic className="h-12 w-12 animate-pulse sm:h-16 sm:w-16" aria-hidden />
              ) : recording ? (
                <Square className="h-10 w-10 fill-current" aria-hidden />
              ) : (
                <Mic className="h-12 w-12" aria-hidden />
              )}
            </button>
          </div>
          <p className="text-xl font-semibold text-foreground" role="status">
            {working
              ? t("正在转成文字…", "Turning speech into text…")
              : recording
                ? t("正在录音", "Recording")
                : t("按麦克风说话", "Tap the microphone to speak")}
          </p>
          {recording ? (
            <p className="text-base text-muted-foreground">
              {elapsedTime(recordedSeconds)} · {t("说完后再按一次", "Tap again when finished")}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <label htmlFor="answer-draft" className="block text-lg font-semibold text-foreground">
            {t("您的回答", "Your answer")}
          </label>
          <textarea
            id="answer-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            className={cn(inputClass, "text-xl leading-relaxed")}
          />
          <BigButton
            onClick={() => onSubmit(draft.trim(), answerMode)}
            disabled={busy || !draft.trim()}
          >
            {busy ? t("正在保存…", "Saving…") : t("保存并继续", "Save and continue")}
          </BigButton>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-base text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-border pt-3">
        <button
          type="button"
          className={quietActionClass}
          disabled={busy || working || recording}
          onClick={() => {
            if (showRecorder) {
              setTyping(true);
              setAnswerMode("typed");
            } else {
              void begin();
            }
          }}
        >
          {showRecorder ? (
            <Keyboard className="h-5 w-5" aria-hidden />
          ) : (
            <Mic className="h-5 w-5" aria-hidden />
          )}
          {showRecorder
            ? t("改用打字", "Type answer")
            : draft
              ? t("继续说", "Speak more")
              : t("改用语音", "Speak instead")}
        </button>
        {onDefer ? (
          <button
            type="button"
            className={quietActionClass}
            disabled={busy || working || recording}
            onClick={onDefer}
          >
            {t("留到看诊时再谈", "Discuss at appointment")}
          </button>
        ) : null}
        <button
          type="button"
          className={cn(quietActionClass, "ml-auto text-muted-foreground")}
          disabled={busy || working || recording}
          onClick={onSkip}
        >
          {t("跳过", "Skip")}
        </button>
      </div>
    </section>
  );
}
