import { useText, type Language } from "@/lib/language";
import { Check, ChevronDown, ChevronUp, Keyboard, Mic, Plus, Square, Volume2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  BigButton,
  LoadingLabel,
  SpeakerBadge,
  inputClass,
  quietActionClass,
} from "@/components/ckd/ui";
import { ClaraMascot } from "@/components/ckd/ClaraMascot";
import { startRecording, type Recorder } from "@/lib/recorder";
import { speak, stopSpeaking, transcribe } from "@/lib/speak";
import { cn } from "@/lib/utils";

import type { AnswerChoice, AnswerKind } from "@/lib/ckd-script";
import {
  createAnswerSubmission,
  moveChoice,
  toggleChoice,
  type AnswerInputMode,
  type AnswerSubmission,
} from "@/lib/guided-answer";

type Props = {
  choices?: AnswerChoice[] | undefined;
  answerKind?: AnswerKind;
  questionZh: string;
  questionEn: string;
  language: Language;
  speaker: "patient" | "caregiver";
  onSubmit: (submission: AnswerSubmission) => void;
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
  const spokenTurn = question;
  const [selectedChoices, setSelectedChoices] = useState<number[]>([]);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(false);
  const [typing, setTyping] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerInputMode>("typed");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const recorderRef = useRef<Recorder | null>(null);
  const autoplayTimerRef = useRef<number | null>(null);
  const speechRunRef = useRef(0);

  const playQuestion = useCallback(async () => {
    const run = ++speechRunRef.current;
    setSpeaking(false);
    try {
      await speak(spokenTurn, language, (playing) => {
        if (speechRunRef.current === run) setSpeaking(playing);
      });
    } finally {
      if (speechRunRef.current === run) setSpeaking(false);
    }
  }, [language, spokenTurn]);

  useEffect(() => {
    setSelectedChoices([]);
    setDraft("");
    setTyping(false);
    setAnswerMode("typed");
    setError(null);
    setSpeaking(false);
    return () => {
      speechRunRef.current += 1;
      stopSpeaking();
      recorderRef.current?.cancel();
      recorderRef.current = null;
    };
  }, [question]);

  useEffect(() => {
    // Defer playback so React's development effect replay does not start it twice.
    autoplayTimerRef.current = window.setTimeout(() => {
      autoplayTimerRef.current = null;
      void playQuestion();
    }, 0);
    return () => {
      if (autoplayTimerRef.current !== null) window.clearTimeout(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
      stopSpeaking();
    };
  }, [playQuestion]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const begin = useCallback(async () => {
    setError(null);
    if (autoplayTimerRef.current !== null) window.clearTimeout(autoplayTimerRef.current);
    autoplayTimerRef.current = null;
    speechRunRef.current += 1;
    setSpeaking(false);
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

  const hasAnswer = selectedChoices.length > 0 || Boolean(draft.trim());

  const submitAnswer = () => {
    onSubmit(
      createAnswerSubmission({
        selected: selectedChoices,
        choices: choices ?? [],
        kind: answerKind,
        language,
        draft,
        inputMode: answerMode,
      }),
    );
  };

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-4xl flex-col gap-7 py-3 sm:min-h-[calc(100dvh-9rem)] sm:gap-8 sm:py-4">
      <header className="flex flex-col items-center gap-3 text-center">
        {speaker === "caregiver" ? <SpeakerBadge speaker={speaker} /> : null}
        <ClaraMascot
          state={recording ? "listening" : speaking ? "speaking" : working ? "waiting" : "idle"}
          alt={t("Clara 正在陪您对话", "Clara is here with you")}
          className="h-36 aspect-[12/13] sm:h-44"
        />
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {question}
        </h1>
        <button
          type="button"
          className={cn(quietActionClass, "justify-center")}
          disabled={recording || working}
          onClick={() => void playQuestion()}
        >
          <Volume2 className="h-5 w-5" aria-hidden />
          {t("再听一次", "Play again")}
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <button
            type="button"
            aria-label={
              recording ? t("结束录音", "Stop recording") : t("说出回答", "Speak your answer")
            }
            onClick={() => (recording ? void finish() : void begin())}
            disabled={working || busy}
            className={cn(
              "flex min-h-20 w-full max-w-md items-center justify-center gap-4 rounded-full px-7 py-4 text-xl font-semibold text-primary-foreground shadow-md transition-[background-color,transform] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-60",
              recording ? "bg-destructive" : "bg-primary hover:bg-primary/90",
            )}
            style={
              recording ? { transform: `scale(${1 + Math.min(level, 0.5) * 0.025})` } : undefined
            }
          >
            {working ? (
              <LoadingLabel>{t("正在转成文字…", "Turning speech into text…")}</LoadingLabel>
            ) : recording ? (
              <>
                <Square className="h-7 w-7 fill-current" aria-hidden />
                <span>{t("说完了", "Finish speaking")}</span>
              </>
            ) : (
              <>
                <Mic className="h-8 w-8" aria-hidden />
                <span>{draft ? t("继续说", "Speak more") : t("用语音回答", "Speak answer")}</span>
              </>
            )}
          </button>
          {recording ? (
            <p className="text-base font-medium text-foreground" role="status">
              {elapsedTime(recordedSeconds)} · {t("正在聆听", "Listening")}
            </p>
          ) : null}
        </div>

        {choices ? (
          <fieldset disabled={busy || recording || working} className="space-y-4">
            <legend className="sr-only">{t("请选择回答", "Choose your answer")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {choices.map((choice, index) => {
                const position = selectedChoices.indexOf(index);
                const selected = position >= 0;
                return (
                  <label
                    key={choice.en}
                    className={cn(
                      "flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border-2 p-4 text-lg font-medium transition-colors focus-within:outline-4 focus-within:outline-offset-2 focus-within:outline-ring",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/50 hover:bg-secondary/40",
                    )}
                  >
                    <input
                      type={answerKind === "single" ? "radio" : "checkbox"}
                      name="guided-answer"
                      checked={selected}
                      onChange={() => {
                        setSelectedChoices((current) => {
                          const next = toggleChoice(current, index, choices, answerKind);
                          if (choice.en === "Something else" && next.includes(index)) {
                            setTyping(true);
                            setAnswerMode("typed");
                          }
                          return next;
                        });
                      }}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                        selected
                          ? "border-primary-foreground bg-primary-foreground text-primary"
                          : "border-muted-foreground/60",
                      )}
                    >
                      {selected ? (
                        answerKind === "ranking" ? (
                          position + 1
                        ) : (
                          <Check className="h-5 w-5" />
                        )
                      ) : null}
                    </span>
                    <span className="min-w-0 text-left">{t(choice.zh, choice.en)}</span>
                  </label>
                );
              })}
            </div>
            {answerKind === "ranking" && selectedChoices.length > 1 ? (
              <div className="rounded-2xl bg-secondary/60 p-4">
                <h2 className="mb-3 text-base font-semibold text-foreground">
                  {t("您的排序", "Your order")}
                </h2>
                <ol aria-label={t("优先事项排序", "Priority ranking")} className="space-y-2">
                  {selectedChoices.map((index, position) => {
                    const choice = choices[index]!;
                    const label = t(choice.zh, choice.en);
                    return (
                      <li
                        key={choice.en}
                        className="flex items-center gap-3 rounded-xl bg-card px-3 py-2"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                          {position + 1}
                        </span>
                        <span className="min-w-0 flex-1 text-base font-medium sm:text-lg">
                          {label}
                        </span>
                        <button
                          type="button"
                          title={t("上移", "Move up")}
                          disabled={position === 0}
                          aria-label={t(`上移：${label}`, `Move up: ${label}`)}
                          onClick={() =>
                            setSelectedChoices((selected) => moveChoice(selected, position, -1))
                          }
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-primary hover:bg-secondary focus-visible:outline-4 focus-visible:outline-ring disabled:opacity-25"
                        >
                          <ChevronUp className="h-6 w-6" aria-hidden />
                        </button>
                        <button
                          type="button"
                          title={t("下移", "Move down")}
                          disabled={position === selectedChoices.length - 1}
                          aria-label={t(`下移：${label}`, `Move down: ${label}`)}
                          onClick={() =>
                            setSelectedChoices((selected) => moveChoice(selected, position, 1))
                          }
                          className="flex h-11 w-11 items-center justify-center rounded-xl text-primary hover:bg-secondary focus-visible:outline-4 focus-visible:outline-ring disabled:opacity-25"
                        >
                          <ChevronDown className="h-6 w-6" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}
          </fieldset>
        ) : null}
        {typing || draft ? (
          <div className="space-y-4">
            <label htmlFor="answer-draft" className="block text-lg font-semibold text-foreground">
              {choices
                ? t("补充说明（可选）", "Add a note (optional)")
                : t("您的回答", "Your answer")}
            </label>
            <textarea
              id="answer-draft"
              disabled={busy || recording || working}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setAnswerMode("typed");
              }}
              rows={3}
              className={cn(inputClass, "text-xl leading-relaxed")}
            />
          </div>
        ) : (
          <button
            type="button"
            className={cn(quietActionClass, "mx-auto justify-center")}
            disabled={busy || recording || working}
            onClick={() => {
              setTyping(true);
              setAnswerMode("typed");
            }}
          >
            {choices ? (
              <Plus className="h-5 w-5" aria-hidden />
            ) : (
              <Keyboard className="h-5 w-5" aria-hidden />
            )}
            {choices ? t("补充说明", "Add a note") : t("改用打字", "Type instead")}
          </button>
        )}

        {error ? (
          <p role="alert" className="text-center text-base text-destructive">
            {error}
          </p>
        ) : null}

        <BigButton onClick={submitAnswer} disabled={busy || working || recording || !hasAnswer}>
          {busy ? <LoadingLabel>{t("正在保存…", "Saving…")}</LoadingLabel> : t("继续", "Continue")}
        </BigButton>
      </div>

      <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-7 gap-y-1 border-t border-border pt-4">
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
      </footer>
    </section>
  );
}
