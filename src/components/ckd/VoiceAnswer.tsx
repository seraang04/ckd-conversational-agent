import { useText, type Language } from "@/lib/language";
import { Keyboard, Mic, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { BigButton, SpeakerBadge, inputClass, quietActionClass } from "@/components/ckd/ui";
import claraMascot from "@/assets/clara-mascot-display.png";
import { startRecording, type Recorder } from "@/lib/recorder";
import { speak, stopSpeaking, transcribe } from "@/lib/speak";
import { cn } from "@/lib/utils";

import type { AnswerChoice, AnswerKind } from "@/lib/ckd-script";
import { toggleChoice, moveChoice, formatChoices } from "@/lib/guided-answer";

type Props = {
  acknowledgementZh?: string;
  acknowledgementEn?: string;
  choices?: AnswerChoice[] | undefined;
  answerKind?: AnswerKind;
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
  choices,
  answerKind = "single",
  acknowledgementZh,
  acknowledgementEn,
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
  const acknowledgement = language === "en" ? acknowledgementEn : acknowledgementZh;
  const spokenTurn = acknowledgement ? `${acknowledgement} ${question}` : question;
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
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
    setSelectedChoices([]);
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
      void speak(spokenTurn, language);
    }, 0);
    return () => {
      if (autoplayTimerRef.current !== null) window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
      stopSpeaking();
    };
  }, [spokenTurn, language]);

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

  const showRecorder = recording || working || (!choices && !draft && !typing);

  return (
    <section className="mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-3xl grid-rows-[minmax(11rem,auto)_minmax(14rem,1fr)_auto] gap-4 py-3 sm:min-h-[calc(100dvh-9rem)] sm:grid-rows-[minmax(11rem,auto)_minmax(16rem,1fr)_auto] sm:py-4">
      <div className="space-y-4">
        <div className="flex items-start gap-4 sm:gap-6">
          <div className="relative mt-1 h-24 w-20 shrink-0 overflow-hidden sm:h-32 sm:w-24">
            <img
              src={claraMascot}
              loading="eager"
              fetchPriority="high"
              alt={t("对话伙伴 Clara", "Clara, your conversation companion")}
              className="h-full w-full object-contain object-bottom motion-safe:animate-[pulse_3.6s_ease-in-out_infinite]"
            />
          </div>
          <div className="min-w-0 space-y-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-primary">Clara</span>
              <span className="text-sm text-muted-foreground">
                {t("对话伙伴", "Conversation companion")}
              </span>
              {speaker === "caregiver" ? <SpeakerBadge speaker={speaker} /> : null}
            </div>
            {acknowledgement ? (
              <p className="max-w-2xl text-xl leading-relaxed text-foreground sm:text-2xl">
                {acknowledgement}
              </p>
            ) : null}
          </div>
        </div>
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {question}
        </h1>
        <button
          type="button"
          className={quietActionClass}
          disabled={recording || working}
          onClick={() => void speak(spokenTurn, language)}
        >
          <Volume2 className="h-6 w-6" aria-hidden />
          {t("听题目", "Hear question")}
        </button>
      </div>

      <div className="space-y-5">
        {choices ? (
          <fieldset disabled={busy || recording || working} className="space-y-3">
            <legend className="mb-3 text-lg font-semibold">
              {answerKind === "ranking"
                ? t(
                    "选择您重视的事项，再用上移和下移按钮排序。最重要的排第一。您也可以只补充说明。",
                    "Select what matters to you, then use Move up and Move down to put the most important first. You can also just share your thoughts below.",
                  )
                : answerKind === "multiple"
                  ? t(
                      "选择所有符合您情况的选项，或直接补充说明。",
                      "Select all that apply, or share your own thoughts below.",
                    )
                  : t(
                      "选择最符合您想法的一项，或直接补充说明。",
                      "Choose the closest answer, or share your own thoughts below.",
                    )}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {choices.map((choice, index) => (
                <label
                  key={choice.en}
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 text-lg focus-within:ring-2 focus-within:ring-ring",
                    selectedChoices.includes(index)
                      ? "border-primary bg-primary/10"
                      : "border-border",
                  )}
                >
                  <input
                    type={answerKind === "single" ? "radio" : "checkbox"}
                    name="guided-answer"
                    checked={selectedChoices.includes(index)}
                    onChange={() =>
                      setSelectedChoices((selected) =>
                        toggleChoice(selected, index, choices, answerKind),
                      )
                    }
                    className="h-5 w-5 accent-primary"
                  />
                  {t(choice.zh, choice.en)}
                </label>
              ))}
            </div>
            {answerKind === "ranking" && selectedChoices.length > 0 ? (
              <ol aria-label={t("优先事项排序", "Priority ranking")} className="space-y-3">
                {selectedChoices.map((index, position) => {
                  const choice = choices[index]!;
                  const label = t(choice.zh, choice.en);
                  return (
                    <li
                      key={choice.en}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3"
                    >
                      <span className="flex-1 text-lg">
                        {position + 1}. {label}
                      </span>
                      <button
                        type="button"
                        className={quietActionClass}
                        disabled={position === 0}
                        aria-label={t(`上移：${label}`, `Move up: ${label}`)}
                        onClick={() =>
                          setSelectedChoices((selected) => moveChoice(selected, position, -1))
                        }
                      >
                        {t("上移", "Move up")}
                      </button>
                      <button
                        type="button"
                        className={quietActionClass}
                        disabled={position === selectedChoices.length - 1}
                        aria-label={t(`下移：${label}`, `Move down: ${label}`)}
                        onClick={() =>
                          setSelectedChoices((selected) => moveChoice(selected, position, 1))
                        }
                      >
                        {t("下移", "Move down")}
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}
            {selectedChoices.length > 0 ? (
              <button
                type="button"
                className={quietActionClass}
                onClick={() => setSelectedChoices([])}
              >
                {t("清除选择", "Clear selection")}
              </button>
            ) : null}
          </fieldset>
        ) : null}
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
              {choices
                ? t(
                    "还有什么想让我们知道的吗？（可选）",
                    "Anything else you’d like us to know? (optional)",
                  )
                : t("您的回答", "Your answer")}
            </label>
            <textarea
              id="answer-draft"
              disabled={busy}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={3}
              className={cn(inputClass, "text-xl leading-relaxed")}
            />
            <BigButton
              onClick={() => {
                const answer = [
                  formatChoices(selectedChoices, choices ?? [], answerKind, language),
                  draft.trim(),
                ]
                  .filter(Boolean)
                  .join("\n\n");
                onSubmit(answer, answerMode);
              }}
              disabled={busy || (!draft.trim() && selectedChoices.length === 0)}
            >
              {busy ? t("正在保存…", "Saving…") : t("保存并继续", "Save and continue")}
            </BigButton>
          </div>
        )}
      </div>

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
