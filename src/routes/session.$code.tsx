import {
  normaliseLanguage,
  parseLanguage,
  useText,
  translatedText,
  type Language,
} from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  EyeOff,
  Heart,
  House,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  UsersRound,
  Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import idleClaraStrip from "@/assets/clara-animation/idle.webp";
import listeningClaraStrip from "@/assets/clara-animation/listening.webp";
import speakingClaraStrip from "@/assets/clara-animation/speaking.webp";
import { ClaraMascot } from "@/components/ckd/ClaraMascot";

import {
  actionControlClass,
  ActionButton,
  BigButton,
  Card,
  ConversationLoading,
  LoadingLabel,
  Notice,
  Page,
  inputClass,
  quietActionClass,
} from "@/components/ckd/ui";
import { VoiceAnswer } from "@/components/ckd/VoiceAnswer";
import { SafetySupport } from "@/components/ckd/SafetySupport";
import { OptionsStep } from "@/components/ckd/OptionsStep";
import { hasExplicitSafetySignal } from "@/lib/safety";
import { ConversationTurns } from "@/components/ckd/ConversationTurns";
import {
  addConversationEntry,
  fetchSessionBundle,
  localBackend,
  saveConversationSummary,
  updateConversation,
  type EntryRow,
  type SummaryRow,
} from "@/lib/ckd-db";
import { SCRIPT, SENSITIVE_GATE, type ScriptQuestion } from "@/lib/ckd-script";
import {
  buildClinicianSummary,
  buildSynthesis,
  checkDistress,
  inferCaregiverHelp,
  inferPatientLifeDetails,
} from "@/lib/ckd.functions";
import type { AnswerSubmission } from "@/lib/guided-answer";
import {
  OPTIONS_SHOWN_QUESTION,
  buildOptionsShownAnswer,
  isOptionsShownEntry,
  optionsInformationLines,
  readOptionsInformation,
} from "@/lib/options-record";
import { speak, stopSpeaking } from "@/lib/speak";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/session/$code")({
  validateSearch: (search: Record<string, unknown>) => ({
    language: parseLanguage(search["language"]),
  }),
  head: () => ({
    links: [
      { rel: "preload", as: "image", href: idleClaraStrip, fetchPriority: "high" },
      { rel: "preload", as: "image", href: speakingClaraStrip },
      { rel: "preload", as: "image", href: listeningClaraStrip },
    ],
    meta: [
      { title: "Values conversation" },
      {
        name: "description",
        content:
          "A voice-led conversation about what matters to you, ready for your next kidney consultation.",
      },
      { property: "og:title", content: "Values conversation" },
      {
        property: "og:description",
        content:
          "A voice-led conversation about what matters to you before your kidney consultation.",
      },
    ],
  }),
  component: SessionFlow,
});

const SENSITIVE_QUESTION = SCRIPT.find((q) => q.id === "sensitive-1")!;

type SummaryKey = keyof Pick<
  SummaryRow,
  | "patient_priorities"
  | "caregiver_support"
  | "shared_concerns"
  | "differing_concerns"
  | "flagged_topics"
>;

const SUMMARY_SECTIONS: { key: SummaryKey; zh: string; en: string }[] = [
  { key: "patient_priorities", zh: "您在意的事", en: "What matters to you" },
  { key: "caregiver_support", zh: "照顾者能帮的事", en: "How your caregiver can help" },
  { key: "shared_concerns", zh: "共同的担心", en: "Shared worries" },
  { key: "differing_concerns", zh: "不同的看法", en: "Different views" },
  { key: "flagged_topics", zh: "看诊时再谈", en: "Discuss at your appointment" },
];

function SessionFlow() {
  const { code } = Route.useParams();
  const { language: requestedLanguage } = Route.useSearch();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ["ckd-session", code],
    queryFn: () => fetchSessionBundle(code),
  });

  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [safety, setSafety] = useState<"risk" | "unavailable" | null>(null);
  const [safetySaved, setSafetySaved] = useState(false);
  const safetyBlocked = useRef(false);
  const retrySafety = useRef<() => void>(() => {});
  const safetyStorageKey = `ckd-safety:${code}`;
  useEffect(() => {
    try {
      if (sessionStorage.getItem(safetyStorageKey)) {
        safetyBlocked.current = true;
        setSafety("risk");
      }
    } catch {
      /* The database flag remains the authoritative record. */
    }
  }, [safetyStorageKey]);

  const distressCheck = useServerFn(checkDistress);
  const synthesise = useServerFn(buildSynthesis);
  const summarise = useServerFn(buildClinicianSummary);
  const inferLifeDetails = useServerFn(inferPatientLifeDetails);

  const bundle = query.data;
  const session = bundle?.session;
  const entries = useMemo(() => bundle?.entries ?? [], [bundle?.entries]);
  const language = normaliseLanguage(requestedLanguage ?? session?.language);

  const t = useText(language);

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const setStage = useCallback(
    async (stage: string, extra: Record<string, unknown> = {}) => {
      if (
        !session ||
        (stage !== "safety_review" && (safetyBlocked.current || session.stage === "safety_review"))
      )
        return false;
      try {
        await updateConversation(session.id, {
          stage,
          updated_at: new Date().toISOString(),
          ...extra,
        });
        const result = await query.refetch();
        if (result.isError) throw result.error;
        return true;
      } catch (error) {
        console.error("Could not save stage", error);
        toast.error(t("无法保存进度，请重试。", "Could not save progress. Please try again."));
        return false;
      }
    },
    [session, query, t],
  );

  const transitioningStage = useRef<string | null>(null);
  useEffect(() => {
    const stage = session?.stage;
    const next =
      (localBackend && (stage === "consent" || stage === "checkin")) ||
      stage === "paused" ||
      stage === "readiness"
        ? "explore"
        : null;
    if (!stage || !next || transitioningStage.current === stage) return;
    transitioningStage.current = stage;
    void setStage(next).finally(() => {
      transitioningStage.current = null;
    });
  }, [session?.stage, setStage]);

  const saveEntry = useCallback(
    async (
      question: Pick<ScriptQuestion, "id" | "zh" | "en">,
      answer: string,
      mode: "voice" | "typed",
      who: "patient" | "caregiver",
      visibility: string,
      refreshAfter = true,
    ) => {
      if (!session) return;
      try {
        await addConversationEntry({
          session_id: session.id,
          speaker: who,
          topic: question.id,
          question: question.zh === question.en ? question.en : `${question.zh} / ${question.en}`,
          answer,
          visibility,
          input_mode: mode,
        });
      } catch (error) {
        console.error("Could not save answer", error);
        toast.error(t("无法保存回答，请重试。", "Could not save that answer. Please try again."));
        return false;
      }
      if (refreshAfter) await refresh();
      return true;
    },
    [session, refresh, t],
  );

  const persistSafety = useCallback(async () => {
    const saved = await setStage("safety_review");
    setSafetySaved(saved);
  }, [setStage]);

  const screenFreeText = useCallback(
    async (freeText: string) => {
      if (safetyBlocked.current || session?.stage === "safety_review") return false;
      stopSpeaking();
      let status: "clear" | "risk" | "unavailable" = "unavailable";
      try {
        status = hasExplicitSafetySignal(freeText)
          ? "risk"
          : (await distressCheck({ data: { answer: freeText } })).status;
      } catch {
        /* Never treat a failed safety check as clearance. */
      }
      if (status === "clear") {
        setSafety(null);
        return true;
      }
      setSafety(status);
      if (status === "risk") {
        safetyBlocked.current = true;
        try {
          sessionStorage.setItem(safetyStorageKey, "pending");
        } catch {
          /* Still block in memory. */
        }
        await persistSafety();
      }
      return false;
    },
    [distressCheck, persistSafety, safetyStorageKey, session?.stage],
  );

  const submitAnswer = useCallback(
    async (
      question: ScriptQuestion,
      submission: AnswerSubmission,
      who: "patient" | "caregiver",
      visibility: string,
      afterStage?: string,
    ) => {
      retrySafety.current = () =>
        void submitAnswer(question, submission, who, visibility, afterStage);
      setBusy(true);
      try {
        if (safetyBlocked.current || session?.stage === "safety_review") return false;
        if (submission.freeText && !(await screenFreeText(submission.freeText))) return false;
        const saved = await saveEntry(
          question,
          submission.answer,
          submission.inputMode,
          who,
          visibility,
          !afterStage,
        );
        if (!saved) return false;
        return afterStage ? await setStage(afterStage) : true;
      } finally {
        setBusy(false);
      }
    },
    [saveEntry, screenFreeText, session?.stage, setStage],
  );

  const handleNoAnswer = useCallback(
    async (
      question: ScriptQuestion,
      who: "patient" | "caregiver",
      visibility: "skipped" | "deferred",
      afterStage?: string,
    ) => {
      setBusy(true);
      const saved = await saveEntry(question, "", "typed", who, visibility, !afterStage);
      if (saved && afterStage) await setStage(afterStage);
      setBusy(false);
    },
    [saveEntry, setStage],
  );

  if (safety || session?.stage === "safety_review") {
    return (
      <Page language={language} minimalHeader>
        <SafetySupport
          language={language}
          {...(safety === "unavailable" && session?.stage !== "safety_review"
            ? { status: "unavailable" as const }
            : {
                status: "risk" as const,
                saved: safetySaved || session?.stage === "safety_review",
              })}
          onRetry={() => {
            if (busy) return;
            if (safety === "risk" || session?.stage === "safety_review") void persistSafety();
            else retrySafety.current();
          }}
        />
      </Page>
    );
  }

  if (query.isLoading) {
    return (
      <Page language={requestedLanguage ?? "en"} minimalHeader>
        <ConversationLoading label={t("正在打开对话", "Opening conversation")} />
      </Page>
    );
  }

  if (query.isError || !session) {
    return (
      <Page language={language}>
        <Card className="space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("无法打开对话", "Unable to open conversation")}
          </h1>
          <p className="text-muted-foreground">
            {query.isError
              ? t("无法加载对话，请重试。", "Could not load your conversation. Please try again.")
              : t("此对话已无法使用。", "This conversation is no longer available.")}
          </p>
          {query.isError ? (
            <BigButton onClick={() => void query.refetch()}>{t("重试", "Try again")}</BigButton>
          ) : null}
          <Link to="/" className={cn(actionControlClass, "w-fit")}>
            <House className="h-5 w-5 text-primary" aria-hidden />
            <span>{t("返回首页", "Back to home")}</span>
          </Link>
        </Card>
      </Page>
    );
  }

  const isCaregiverStage = session.stage === "caregiver" || session.stage === "caregiver_done";
  const summary = bundle?.summary;
  const hasSummaryContent = summary
    ? SUMMARY_SECTIONS.some((section) => (summary[section.key]?.length ?? 0) > 0)
    : false;

  return (
    <Page
      language={language}
      variant={isCaregiverStage ? "caregiver" : "patient"}
      minimalHeader
      headerAction={
        <ActionButton
          icon={House}
          disabled={busy}
          className="shrink-0 px-3 text-sm sm:text-base"
          onClick={() => void navigate({ to: "/" })}
        >
          {t("首页", "Home")}
        </ActionButton>
      }
    >
      <div className="space-y-5">
        {session.stage === "consent" ? (
          localBackend ? null : (
            <OnboardingIntro
              language={language}
              onContinue={() =>
                void setStage("checkin", {
                  consent_recording: true,
                  consent_sharing: true,
                })
              }
            />
          )
        ) : null}

        {session.stage === "checkin" ? (
          localBackend ? null : (
            <EmotionalCheckin
              language={language}
              onReady={(readiness) => void setStage("explore", { readiness })}
            />
          )
        ) : null}

        {session.stage === "explore" ? (
          <ConversationTurns
            sessionId={session.id}
            scope="patient"
            entries={entries}
            language={language}
            speaker="patient"
            onSave={submitAnswer}
            onComplete={() => setStage("gate")}
          />
        ) : null}

        {session.stage === "gate" ? (
          <SensitiveGate
            language={language}
            onChoose={(choice) => {
              if (choice === "defer") {
                void handleNoAnswer(SENSITIVE_QUESTION, "patient", "deferred", "options");
              } else {
                void setStage(choice === "private" ? "sensitive_private" : "sensitive_together");
              }
            }}
          />
        ) : null}

        {session.stage === "sensitive_private" || session.stage === "sensitive_together" ? (
          <div className="space-y-4">
            {session.stage === "sensitive_private" ? (
              <Notice tone="warn">
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />{" "}
                  {t(
                    "请照顾者先离开。您的回答不会放进摘要。",
                    "Ask your caregiver to step away. Your answer will not appear in the summary.",
                  )}
                </span>
              </Notice>
            ) : null}
            <VoiceAnswer
              key={SENSITIVE_QUESTION.id}
              questionZh={SENSITIVE_QUESTION.zh}
              questionEn={SENSITIVE_QUESTION.en}
              language={language}
              speaker="patient"
              busy={busy}
              onSubmit={(submission) =>
                void submitAnswer(
                  SENSITIVE_QUESTION,
                  submission,
                  "patient",
                  session.stage === "sensitive_private" ? "private" : "shared",
                  "options",
                )
              }
              onSkip={() =>
                void handleNoAnswer(SENSITIVE_QUESTION, "patient", "skipped", "options")
              }
              onDefer={() =>
                void handleNoAnswer(SENSITIVE_QUESTION, "patient", "deferred", "options")
              }
            />
          </div>
        ) : null}

        {session.stage === "options" ? (
          <OptionsStep
            sessionId={session.id}
            language={language}
            entries={entries}
            allowGated={entries.some(
              (e) =>
                e.speaker === "patient" &&
                e.topic === SENSITIVE_QUESTION.id &&
                e.visibility === "shared" &&
                e.answer.trim() !== "",
            )}
            onDone={async (shown) => {
              // A record of what was shown, not patient free text, so no safety screen.
              if (
                shown &&
                !(await saveEntry(
                  OPTIONS_SHOWN_QUESTION,
                  buildOptionsShownAnswer(shown.source, shown.priorities),
                  "typed",
                  "patient",
                  "shared",
                  false,
                ))
              ) {
                return;
              }
              await setStage("caregiver_intro");
            }}
          />
        ) : null}

        {session.stage === "caregiver_intro" ? (
          <section className="mx-auto w-full max-w-3xl space-y-8 py-3 sm:py-6">
            <h1 className="min-h-20 text-3xl font-semibold leading-tight text-foreground sm:min-h-16 sm:text-4xl">
              {t("有人陪您看病或照顾您吗？", "Does someone help with your care?")}
            </h1>
            <div className="space-y-4">
              <BigButton variant="soft" onClick={() => void setStage("caregiver")}>
                {t("有，请交给对方", "Yes, pass them the device")}
              </BigButton>
              <BigButton variant="soft" onClick={() => void setStage("synthesis")}>
                {t("没有", "No")}
              </BigButton>
            </div>
          </section>
        ) : null}

        {session.stage === "caregiver" ? (
          <ConversationTurns
            sessionId={session.id}
            scope="caregiver"
            entries={entries}
            language={language}
            speaker="caregiver"
            onSave={submitAnswer}
            onComplete={() => setStage("caregiver_done")}
          />
        ) : null}

        {session.stage === "caregiver_done" ? (
          <CaregiverDone
            language={language}
            entries={entries}
            onContinue={() => void setStage("synthesis")}
          />
        ) : null}

        {session.stage === "synthesis" || session.stage === "confirm" ? (
          <Confirmation
            language={language}
            entries={entries}
            summary={bundle?.summary ?? null}
            sessionId={session.id}
            patientLabel={session.patient_label}
            ckdStage={session.ckd_stage}
            keyIssues={session.key_issues}
            synthesise={synthesise}
            summarise={summarise}
            onDone={() => void setStage("done", { completed_at: new Date().toISOString() })}
            refresh={refresh}
          />
        ) : null}

        {session.stage === "done" ? (
          <Card className="mx-auto max-w-3xl space-y-4 text-left">
            <div className="flex items-center gap-4 sm:gap-6">
              <ClaraMascot
                state="idle"
                alt={t("对话伙伴 Clara", "Clara, your conversation companion")}
                className="h-24 aspect-[12/13] sm:h-32"
              />
              <div className="min-w-0 space-y-2">
                <h1 className="text-3xl font-semibold text-foreground">
                  {t("对话已完成", "Conversation complete")}
                </h1>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  {t("谢谢您今天和我聊聊。", "Thank you for talking with me today.")}
                </p>
              </div>
            </div>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {hasSummaryContent
                ? localBackend
                  ? t(
                      "摘要已保存在这台设备，尚未发送给护理团队。",
                      "Summary saved on this device. It has not been sent to your care team.",
                    )
                  : t(
                      "您确认的摘要已保存，供肾科护理团队查看。",
                      "Your confirmed summary is saved for your kidney care team to review.",
                    )
                : t(
                    "这次没有可分享的摘要内容。",
                    "There is no summary content to share from this conversation.",
                  )}
            </p>
            <p className="text-lg leading-relaxed text-muted-foreground">
              {hasSummaryContent
                ? t(
                    "下次就诊时，请带上摘要，与肾科护理团队讨论您的问题和下一步安排。您不需要现在做决定。",
                    "Bring your summary to your next appointment to discuss your questions and next steps with your kidney care team. You don’t need to decide now.",
                  )
                : t(
                    "下次就诊时，请与肾科护理团队讨论您的问题和下一步安排。您不需要现在做决定。",
                    "At your next appointment, discuss your questions and next steps with your kidney care team. You don’t need to decide now.",
                  )}
            </p>
            {summary?.confirmed && hasSummaryContent ? (
              <BigButton
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    const { buildPatientSheet } = await import("@/lib/decision-sheets");
                    const { downloadSheetPdf } = await import("@/lib/summary-pdf");
                    const confirmed = {
                      patientPriorities: summary.patient_priorities.map((item) =>
                        translatedText(item, language),
                      ),
                      sharedConcerns: summary.shared_concerns.map((item) =>
                        translatedText(item, language),
                      ),
                    };
                    const preparedOn = new Date(session.completed_at ?? Date.now()).toLocaleDateString(
                      language === "en" ? "en-SG" : "zh-CN",
                      { day: "numeric", month: language === "en" ? "short" : "long", year: "numeric" },
                    );
                    // A best-effort read of what the patient said; if it fails or is
                    // unconfigured, these rows are just left blank, same as before.
                    const lifeDetails = await inferLifeDetails({
                      data: {
                        entries: entries
                          .filter(
                            (e) =>
                              e.speaker === "patient" &&
                              e.visibility === "shared" &&
                              !isOptionsShownEntry(e),
                          )
                          .map((e) => ({
                            speaker: e.speaker,
                            question: e.question,
                            answer: e.answer,
                            visibility: e.visibility,
                          })),
                        language,
                      },
                    }).catch(() => ({}));
                    await downloadSheetPdf(
                      buildPatientSheet(language, entries, confirmed, preparedOn, lifeDetails),
                      `my-treatment-priorities-${language}.pdf`,
                    );
                  } catch {
                    toast.error(
                      t(
                        "无法下载摘要，请重试。",
                        "Could not download the summary. Please try again.",
                      ),
                    );
                  } finally {
                    setDownloading(false);
                  }
                }}
                className="flex items-center justify-center gap-2"
              >
                <Download className="h-6 w-6 shrink-0" aria-hidden />
                {downloading
                  ? t("正在生成 PDF…", "Preparing PDF…")
                  : t("下载我的治疗优先事项 (PDF)", "Download my treatment priorities (PDF)")}
              </BigButton>
            ) : null}
            <Link to="/" className={cn(quietActionClass, "justify-center")}>
              {t("开始新对话", "Start another conversation")}
            </Link>
          </Card>
        ) : null}
      </div>
    </Page>
  );
}

function SensitiveGate({
  language,
  onChoose,
}: {
  language: Language;
  onChoose: (choice: "private" | "together" | "defer") => void;
}) {
  const t = useText(language);
  const text = language === "en" ? SENSITIVE_GATE.en : SENSITIVE_GATE.zh;
  useEffect(() => {
    const timer = window.setTimeout(() => void speak(text, language), 0);
    return () => {
      window.clearTimeout(timer);
      stopSpeaking();
    };
  }, [text, language]);
  return (
    <section className="mx-auto w-full max-w-3xl space-y-8 py-3 sm:py-6">
      <div className="min-h-52 space-y-4 sm:min-h-40">
        <h1 className="max-w-2xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {text}
        </h1>
        <button
          type="button"
          className={quietActionClass}
          onClick={() => void speak(text, language)}
        >
          <Volume2 className="h-6 w-6" aria-hidden />
          {t("听题目", "Hear question")}
        </button>
      </div>
      <div className="space-y-4">
        <BigButton variant="soft" onClick={() => onChoose("private")}>
          <span className="inline-flex items-center gap-3">
            <Lock className="h-6 w-6" aria-hidden /> {t("我想单独谈", "Talk privately")}
          </span>
        </BigButton>
        <BigButton variant="soft" onClick={() => onChoose("together")}>
          <span className="inline-flex items-center gap-3">
            <UsersRound className="h-6 w-6" aria-hidden />
            {t("和照顾者一起谈", "Talk with my caregiver")}
          </span>
        </BigButton>
      </div>
      <button type="button" className={quietActionClass} onClick={() => onChoose("defer")}>
        {t("留到看诊时再谈", "Discuss at the appointment")}
      </button>
    </section>
  );
}

function OnboardingIntro({
  language,
  onContinue,
}: {
  language: Language;
  onContinue: () => void;
}) {
  const t = useText(language);
  const greeting = t(
    "您好，我是 Clara。",
    "Hi, I'm Clara.",
  );
  useEffect(() => {
    const timer = window.setTimeout(() => void speak(greeting, language), 0);
    return () => {
      window.clearTimeout(timer);
      stopSpeaking();
    };
  }, [greeting, language]);
  return (
    <section className="mx-auto w-full max-w-3xl space-y-8 py-3 sm:py-6">
      <div className="flex items-start gap-5 sm:gap-6">
        <ClaraMascot
          state="speaking"
          alt={t("对话伙伴 Clara", "Clara, your conversation companion")}
          className="h-28 aspect-[12/13] shrink-0 sm:h-36"
        />
        <div className="min-w-0 space-y-4 pt-1">
          <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            {t("您好，我是 Clara。", "Hi, I'm Clara.")}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t(
              "我来帮您想想，不同的肾病治疗方式，哪一种最适合您的生活。我们会聊到您最在意的事、您的担心，以及治疗对您日常生活的影响。",
              "I'll help you think through how different kidney treatment options may fit your daily life. We'll talk about what matters most to you, your concerns, and how treatment might affect your day-to-day.",
            )}
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t(
              "您的回答会保存供肾科护理团队参考，语音回答会转成文字。没有对错之分，慢慢来就好。",
              "Your answers are saved for your kidney care team to review. Voice answers will be transcribed. There are no right or wrong answers — take your time.",
            )}
          </p>
        </div>
      </div>
      <button
        type="button"
        className={quietActionClass}
        onClick={() => void speak(
          t(
            "您好，我是 Clara。我来帮您想想，不同的肾病治疗方式，哪一种最适合您的生活。",
            "Hi, I'm Clara. I'll help you think through how different kidney treatment options may fit your daily life.",
          ),
          language,
        )}
      >
        <Volume2 className="h-6 w-6" aria-hidden />
        {t("再听一遍", "Hear again")}
      </button>
      <BigButton onClick={onContinue}>
        {t("我明白了，开始吧", "I understand — let's begin")}
      </BigButton>
    </section>
  );
}

type ReadinessValue = "okay" | "overwhelmed" | "unsure" | "slow";

function EmotionalCheckin({
  language,
  onReady,
}: {
  language: Language;
  onReady: (readiness: ReadinessValue) => void;
}) {
  const t = useText(language);
  const [selected, setSelected] = useState<ReadinessValue | null>(null);
  const question = t("开始之前，您今天感觉怎么样？", "Before we begin, how are you feeling today?");

  useEffect(() => {
    const timer = window.setTimeout(() => void speak(question, language), 0);
    return () => {
      window.clearTimeout(timer);
      stopSpeaking();
    };
  }, [question, language]);

  const options: { value: ReadinessValue; zh: string; en: string; responseZh: string; responseEn: string }[] = [
    {
      value: "okay",
      zh: "我可以聊",
      en: "I'm okay to talk",
      responseZh: "很好。我们慢慢来，随时可以暂停。",
      responseEn: "That's great. We'll take it at your pace — you can pause anytime.",
    },
    {
      value: "overwhelmed",
      zh: "我有点不知所措",
      en: "I'm feeling a little overwhelmed",
      responseZh: "完全可以理解。我们会慢慢聊，您随时可以跳过任何问题。",
      responseEn: "That's completely understandable. We'll go slowly, and you can skip any question at any time.",
    },
    {
      value: "unsure",
      zh: "我不确定自己的感受",
      en: "I'm not sure how I feel",
      responseZh: "没关系，不需要确定。我们随时可以暂停，也可以跳过您不想回答的问题。",
      responseEn: "That's okay — you don't need to be sure. We can pause at any time, and you can skip questions you'd rather not answer.",
    },
    {
      value: "slow",
      zh: "我想慢慢来",
      en: "I'd rather take things slowly",
      responseZh: "当然可以。您来定节奏，没有时间限制，也没有必须回答的问题。",
      responseEn: "Of course. You set the pace — there's no time limit, and nothing you must answer.",
    },
  ];

  const chosen = options.find((o) => o.value === selected);

  return (
    <section className="mx-auto w-full max-w-3xl space-y-8 py-3 sm:py-6">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {question}
        </h1>
        <button
          type="button"
          className={quietActionClass}
          onClick={() => void speak(question, language)}
        >
          <Volume2 className="h-6 w-6" aria-hidden />
          {t("听问题", "Hear question")}
        </button>
      </div>

      {!selected ? (
        <div className="space-y-4">
          {options.map((opt) => (
            <BigButton key={opt.value} variant="soft" onClick={() => setSelected(opt.value)}>
              {t(opt.zh, opt.en)}
            </BigButton>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <Notice tone="info">
            <span className="flex items-start gap-3">
              <Heart className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span>{chosen ? t(chosen.responseZh, chosen.responseEn) : ""}</span>
            </span>
          </Notice>
          <p className="text-base leading-relaxed text-muted-foreground">
            {t(
              "没有对错之分。您可以随时跳过任何问题，或者要求暂停。",
              "There are no right or wrong responses. You can skip any question or ask to pause at any time.",
            )}
          </p>
          <BigButton onClick={() => onReady(selected)}>
            {t("好的，开始吧", "Okay, let's continue")}
          </BigButton>
          <button
            type="button"
            className={quietActionClass}
            onClick={() => setSelected(null)}
          >
            {t("更改答案", "Change my answer")}
          </button>
        </div>
      )}
    </section>
  );
}

function CaregiverDone({
  language,
  entries,
  onContinue,
}: {
  language: Language;
  entries: EntryRow[];
  onContinue: () => void;
}) {
  const t = useText(language);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const inferHelp = useServerFn(inferCaregiverHelp);

  return (
    <Card className="mx-auto max-w-3xl space-y-4 text-left">
      <div className="flex items-center gap-4 sm:gap-6">
        <ClaraMascot
          state="idle"
          alt={t("对话伙伴 Clara", "Clara, your conversation companion")}
          className="h-24 aspect-[12/13] shrink-0 sm:h-32"
        />
        <div className="min-w-0 space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {t("谢谢您的分享", "Thank you for sharing")}
          </h1>
        </div>
      </div>
      <p className="text-lg leading-relaxed text-muted-foreground">
        {t(
          "这些记录只供您参考，可以带去看诊。请在把设备交还之前下载，之后就不会再显示了。",
          "These notes are just for you, to bring to the appointment. Please download them before you pass the device back – they won't be shown again.",
        )}
      </p>
      <BigButton
        disabled={downloading}
        onClick={async () => {
          setDownloading(true);
          try {
            const { buildCaregiverSheet } = await import("@/lib/decision-sheets");
            const { downloadSheetPdf } = await import("@/lib/summary-pdf");
            const preparedOn = new Date().toLocaleDateString(
              language === "en" ? "en-SG" : "zh-CN",
              { day: "numeric", month: language === "en" ? "short" : "long", year: "numeric" },
            );
            const howIHelp = entries.find(
              (e) => e.speaker === "caregiver" && e.topic === "caregiver-2" && e.visibility === "shared",
            );
            // A best-effort read of the caregiver's own words; if it fails or
            // is unconfigured, the grid is just left blank, same as before.
            const helpCapacity = howIHelp
              ? await inferHelp({ data: { answer: howIHelp.answer } }).catch(() => ({}))
              : {};
            await downloadSheetPdf(
              buildCaregiverSheet(language, entries, preparedOn, helpCapacity),
              `caregiver-notes-${language}.pdf`,
            );
            setDownloaded(true);
          } catch {
            toast.error(
              t("无法下载记录，请重试。", "Could not download your notes. Please try again."),
            );
          } finally {
            setDownloading(false);
          }
        }}
        className="flex items-center justify-center gap-2"
      >
        <Download className="h-6 w-6 shrink-0" aria-hidden />
        {downloading
          ? t("正在生成 PDF…", "Preparing PDF…")
          : downloaded
            ? t("再次下载我的记录 (PDF)", "Download my notes again (PDF)")
            : t("下载我的记录 (PDF)", "Download my notes (PDF)")}
      </BigButton>
      <p className="text-base leading-relaxed text-muted-foreground">
        {t(
          "您私下分享的内容不会印在记录上。",
          "Anything you shared privately is not printed in the notes.",
        )}
      </p>
      <BigButton variant="soft" onClick={onContinue}>
        {downloaded
          ? t("完成，交还设备", "Done – pass the device back")
          : t("跳过，交还设备", "Skip – pass the device back")}
      </BigButton>
    </Card>
  );
}

type EditableItem = { text: string; include: boolean };

/** A short, human name for a deferred/private topic, never its answer text. */
function deferredTopicLabel(
  entry: Pick<EntryRow, "topic" | "question">,
  t: ReturnType<typeof useText>,
  language: Language,
) {
  if (entry.topic === "sensitive-1") {
    return t("换肾或家人捐肾", "Kidney transplant or family donation");
  }
  if (entry.topic === "caregiver-4") {
    return t("照顾者想私下谈", "Caregiver wants to talk privately");
  }
  return entry.question.split(" / ")[language === "en" ? 1 : 0] ?? entry.question;
}

/** Topics the patient herself deferred or kept private — safe for her to review. */
function patientFlaggedTopics(entries: EntryRow[], t: ReturnType<typeof useText>, language: Language) {
  return entries
    .filter((e) => e.speaker === "patient" && (e.visibility === "deferred" || e.visibility === "private"))
    .map((e) => deferredTopicLabel(e, t, language));
}

/** Topics the caregiver deferred or kept private — never shown to the patient. */
function caregiverFlaggedTopics(entries: EntryRow[], t: ReturnType<typeof useText>, language: Language) {
  return entries
    .filter((e) => e.speaker === "caregiver" && (e.visibility === "deferred" || e.visibility === "private"))
    .map((e) =>
      e.topic === "caregiver-4"
        ? deferredTopicLabel(e, t, language)
        : `${t("照顾者", "Caregiver")}: ${deferredTopicLabel(e, t, language)}`,
    );
}

function editableSummary(
  summary: SummaryRow,
  language: Language,
  entries: EntryRow[],
  t: ReturnType<typeof useText>,
) {
  const items = {} as Record<SummaryKey, EditableItem[]>;
  for (const section of SUMMARY_SECTIONS) {
    items[section.key] = (summary[section.key] ?? []).map((text) => ({
      text: translatedText(text, language),
      include: true,
    }));
  }
  // "Discuss at your appointment" is reviewed here by the patient, so it can
  // only ever be seeded from her own deferred/private topics — never the
  // caregiver's, regardless of what the synthesised summary contains.
  items.flagged_topics = patientFlaggedTopics(entries, t, language).map((text) => ({
    text,
    include: true,
  }));
  return items;
}

function Confirmation({
  language,
  entries,
  summary,
  sessionId,
  patientLabel,
  ckdStage,
  keyIssues,
  synthesise,
  summarise,
  onDone,
  refresh,
}: {
  language: Language;
  entries: EntryRow[];
  summary: SummaryRow | null;
  sessionId: string;
  patientLabel: string;
  ckdStage: string;
  keyIssues: string;
  synthesise: ReturnType<typeof useServerFn<typeof buildSynthesis>>;
  summarise: ReturnType<typeof useServerFn<typeof buildClinicianSummary>>;
  onDone: () => void;
  refresh: () => Promise<void>;
}) {
  const t = useText(language);
  const [items, setItems] = useState<Record<SummaryKey, EditableItem[]> | null>(null);
  const [working, setWorking] = useState(false);
  const [buildFailed, setBuildFailed] = useState(false);
  const [addition, setAddition] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const buildAttempted = useRef(false);

  const build = useCallback(async () => {
    setWorking(true);
    setBuildFailed(false);
    try {
      const deferred = [
        ...patientFlaggedTopics(entries, t, language),
        ...caregiverFlaggedTopics(entries, t, language),
      ];
      const shared = entries.filter(
        (e) => e.visibility === "shared" && e.answer.trim() && !isOptionsShownEntry(e),
      );
      const result = localBackend
        ? {
            patient_priorities: shared.filter((e) => e.speaker === "patient").map((e) => e.answer),
            caregiver_support: shared.filter((e) => e.speaker === "caregiver").map((e) => e.answer),
            shared_concerns: [],
            differing_concerns: [],
            flagged_topics: deferred,
          }
        : await synthesise({
            data: {
              entries: entries
                .filter((e) => e.visibility === "shared" && !isOptionsShownEntry(e))
                .map((e) => ({
                  speaker: e.speaker,
                  question: e.question,
                  answer: e.answer,
                  visibility: e.visibility,
                })),
              deferredTopics: deferred,
            },
          });
      const hasContent = SUMMARY_SECTIONS.some((section) => result[section.key].length > 0);
      await saveConversationSummary(sessionId, {
        patient_priorities: result.patient_priorities,
        caregiver_support: result.caregiver_support,
        shared_concerns: result.shared_concerns,
        differing_concerns: result.differing_concerns,
        flagged_topics: result.flagged_topics,
        ...(!hasContent ? { clinician_summary: "", confirmed: true } : {}),
      });
      if (hasContent) await refresh();
      else onDone();
    } catch {
      setBuildFailed(true);
      toast.error(
        t("无法整理摘要，请重试。", "Could not put the summary together. Please try again."),
      );
    } finally {
      setWorking(false);
    }
  }, [entries, sessionId, synthesise, refresh, t, language, onDone]);

  useEffect(() => {
    if (summary || buildAttempted.current) return;
    buildAttempted.current = true;
    void build();
  }, [summary, build]);

  if (!summary) {
    return buildFailed ? (
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">
          {t("无法整理摘要", "Could not prepare summary")}
        </h1>
        <BigButton onClick={() => void build()} disabled={working}>
          {working ? (
            <LoadingLabel>{t("正在重试…", "Retrying…")}</LoadingLabel>
          ) : (
            t("重试", "Try again")
          )}
        </BigButton>
      </Card>
    ) : (
      <ConversationLoading label={t("正在整理摘要", "Preparing your summary")} />
    );
  }

  const reviewItems = items ?? editableSummary(summary, language, entries, t);

  const confirm = async () => {
    setWorking(true);
    try {
      const picked = (key: SummaryKey) =>
        reviewItems[key].filter((i) => i.include && i.text.trim()).map((i) => i.text.trim());
      const payload = {
        patientLabel,
        ckdStage,
        keyIssues,
        patientPriorities: picked("patient_priorities"),
        caregiverSupport: picked("caregiver_support"),
        sharedConcerns: picked("shared_concerns"),
        differingConcerns: picked("differing_concerns"),
        // The patient only ever reviews/edits her own flagged topics; the
        // caregiver's are preserved untouched so the care team still sees them.
        flaggedTopics: [...picked("flagged_topics"), ...caregiverFlaggedTopics(entries, t, language)],
        optionsInformation: optionsInformationLines(readOptionsInformation(entries)),
      };
      const text = localBackend
        ? [
            ...payload.patientPriorities,
            ...payload.caregiverSupport,
            ...payload.flaggedTopics,
            ...payload.optionsInformation,
          ].join("\n")
        : (await summarise({ data: payload })).summary;
      await saveConversationSummary(sessionId, {
        patient_priorities: payload.patientPriorities,
        caregiver_support: payload.caregiverSupport,
        shared_concerns: payload.sharedConcerns,
        differing_concerns: payload.differingConcerns,
        flagged_topics: payload.flaggedTopics,
        clinician_summary: text,
        confirmed: true,
      });
      onDone();
    } catch {
      toast.error(t("无法保存摘要，请重试。", "Could not save the summary. Please try again."));
    } finally {
      setWorking(false);
    }
  };

  const update = (key: SummaryKey, index: number, patch: Partial<EditableItem>) => {
    setItems((prev) => {
      const current = prev ?? editableSummary(summary, language, entries, t);
      const list = [...current[key]];
      const existing = list[index];
      if (!existing) return current;
      list[index] = { ...existing, ...patch };
      return { ...current, [key]: list };
    });
  };

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold text-foreground">
        {t("确认您的摘要", "Review your summary")}
      </h1>

      <Card className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          {t("您在意的事", "What matters to you")}
        </h2>
        {reviewItems.patient_priorities.length === 0 ? (
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t(
              "还没有内容，您可以在下面补充。",
              "Nothing here yet — you can add something below.",
            )}
          </p>
        ) : null}
        {reviewItems.patient_priorities.map((item, index) => {
          const itemKey = `patient_priorities-${index}`;
          return (
            <div key={itemKey} className="rounded-2xl border border-border p-4">
              {editing === itemKey ? (
                <textarea
                  autoFocus
                  aria-label={t(
                    `您在意的事，第 ${index + 1} 点`,
                    `What matters to you, point ${index + 1}`,
                  )}
                  value={item.text}
                  rows={3}
                  onChange={(event) =>
                    update("patient_priorities", index, { text: event.target.value })
                  }
                  className={`${inputClass} text-lg`}
                />
              ) : (
                <p
                  className={`text-lg leading-relaxed ${item.include ? "text-foreground" : "text-muted-foreground line-through"}`}
                >
                  {item.text}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-4">
                <ActionButton
                  icon={Pencil}
                  onClick={() => setEditing(editing === itemKey ? null : itemKey)}
                  className="min-h-11 px-3 py-1"
                >
                  {editing === itemKey ? t("改好了", "Done editing") : t("修改", "Edit")}
                </ActionButton>
                <ActionButton
                  icon={item.include ? EyeOff : RotateCcw}
                  onClick={() => update("patient_priorities", index, { include: !item.include })}
                  className="min-h-11 px-3 py-1"
                >
                  {item.include ? t("不放进摘要", "Leave out") : t("放回摘要", "Put back")}
                </ActionButton>
              </div>
            </div>
          );
        })}
      </Card>

      {reviewItems.flagged_topics.length > 0 ? (
        <Card className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">
            {t("看诊时再谈", "Discuss at your appointment")}
          </h2>
          {reviewItems.flagged_topics.map((item, index) => {
            const itemKey = `flagged_topics-${index}`;
            return (
              <div key={itemKey} className="rounded-2xl border border-border p-4">
                {editing === itemKey ? (
                  <textarea
                    autoFocus
                    aria-label={t(
                      `看诊时再谈，第 ${index + 1} 点`,
                      `Discuss at your appointment, point ${index + 1}`,
                    )}
                    value={item.text}
                    rows={3}
                    onChange={(event) =>
                      update("flagged_topics", index, { text: event.target.value })
                    }
                    className={`${inputClass} text-lg`}
                  />
                ) : (
                  <p
                    className={`text-lg leading-relaxed ${item.include ? "text-foreground" : "text-muted-foreground line-through"}`}
                  >
                    {item.text}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-4">
                  <ActionButton
                    icon={Pencil}
                    onClick={() => setEditing(editing === itemKey ? null : itemKey)}
                    className="min-h-11 px-3 py-1"
                  >
                    {editing === itemKey ? t("改好了", "Done editing") : t("修改", "Edit")}
                  </ActionButton>
                  <ActionButton
                    icon={item.include ? EyeOff : RotateCcw}
                    onClick={() => update("flagged_topics", index, { include: !item.include })}
                    className="min-h-11 px-3 py-1"
                  >
                    {item.include ? t("不放进摘要", "Leave out") : t("放回摘要", "Put back")}
                  </ActionButton>
                </div>
              </div>
            );
          })}
        </Card>
      ) : null}

      {adding ? (
        <Card className="space-y-3">
          <label htmlFor="summary-addition" className="text-xl font-semibold text-foreground">
            {t("补充内容", "Add a note")}
          </label>
          <textarea
            id="summary-addition"
            value={addition}
            rows={3}
            onChange={(event) => setAddition(event.target.value)}
            className={inputClass}
            placeholder={t("写下您觉得重要的事", "Write what matters to you")}
          />
          <BigButton
            variant="ghost"
            disabled={!addition.trim()}
            onClick={() => {
              if (!addition.trim()) return;
              setItems((prev) => {
                const current = prev ?? editableSummary(summary, language, entries, t);
                return {
                  ...current,
                  patient_priorities: [
                    ...current.patient_priorities,
                    { text: addition.trim(), include: true },
                  ],
                };
              });
              setAddition("");
              setAdding(false);
            }}
          >
            {t("加入摘要", "Add to summary")}
          </BigButton>
        </Card>
      ) : (
        <ActionButton icon={Plus} onClick={() => setAdding(true)}>
          {t("补充内容", "Add a note")}
        </ActionButton>
      )}

      <BigButton onClick={() => void confirm()} disabled={working}>
        {working ? (
          <LoadingLabel>{t("正在保存…", "Saving…")}</LoadingLabel>
        ) : (
          t("确认摘要", "Confirm summary")
        )}
      </BigButton>
    </div>
  );
}
