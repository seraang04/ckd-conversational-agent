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
  Check,
  Download,
  EyeOff,
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

import {
  actionControlClass,
  ActionButton,
  BigButton,
  Card,
  MicPending,
  Notice,
  Page,
  inputClass,
  quietActionClass,
} from "@/components/ckd/ui";
import { VoiceAnswer } from "@/components/ckd/VoiceAnswer";
import { SafetySupport } from "@/components/ckd/SafetySupport";
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
import { buildClinicianSummary, buildSynthesis, checkDistress } from "@/lib/ckd.functions";
import { speak, stopSpeaking } from "@/lib/speak";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/session/$code")({
  validateSearch: (search: Record<string, unknown>) => ({
    language: parseLanguage(search["language"]),
  }),
  head: () => ({
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
      question: ScriptQuestion,
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
          question: `${question.zh} / ${question.en}`,
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

  const screenAnswer = useCallback(
    async (answer: string) => {
      if (safetyBlocked.current || session?.stage === "safety_review") return false;
      stopSpeaking();
      let status: "clear" | "risk" | "unavailable" = "unavailable";
      try {
        status = hasExplicitSafetySignal(answer)
          ? "risk"
          : (await distressCheck({ data: { answer } })).status;
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

  const handleAnswer = useCallback(
    async (
      question: ScriptQuestion,
      answer: string,
      mode: "voice" | "typed",
      who: "patient" | "caregiver",
      visibility: string,
      afterStage?: string,
    ) => {
      retrySafety.current = () =>
        void handleAnswer(question, answer, mode, who, visibility, afterStage);
      setBusy(true);
      try {
        if (!(await screenAnswer(answer))) return;
        const saved = await saveEntry(question, answer, mode, who, visibility, !afterStage);
        if (saved && afterStage) await setStage(afterStage);
      } finally {
        setBusy(false);
      }
    },
    [saveEntry, screenAnswer, setStage],
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

  const saveConversationEntry = useCallback(
    async (
      question: ScriptQuestion,
      answer: string,
      mode: "voice" | "typed",
      who: "patient" | "caregiver",
      visibility: string,
    ) => {
      retrySafety.current = () =>
        void saveConversationEntry(question, answer, mode, who, visibility);
      setBusy(true);
      try {
        if (safetyBlocked.current || session?.stage === "safety_review") return false;
        if (answer.trim() && !(await screenAnswer(answer))) return false;
        return await saveEntry(question, answer, mode, who, visibility);
      } finally {
        setBusy(false);
      }
    },
    [saveEntry, screenAnswer, session?.stage],
  );

  if (safety || session?.stage === "safety_review") {
    return (
      <Page language={language} minimalHeader>
        <SafetySupport
          language={language}
          unavailable={safety === "unavailable" && session?.stage !== "safety_review"}
          saved={safetySaved || session?.stage === "safety_review"}
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
        <section className="mx-auto grid min-h-[calc(100dvh-10rem)] w-full max-w-3xl grid-rows-[minmax(11rem,auto)_minmax(14rem,1fr)_auto] gap-4 py-3">
          <div className="space-y-4" aria-hidden>
            <div className="h-9 w-3/4 max-w-md animate-pulse rounded-2xl bg-muted" />
            <div
              style={{ animationDelay: "0.4s" }}
              className="h-9 w-1/2 max-w-xs animate-pulse rounded-2xl bg-muted"
            />
          </div>
          <MicPending
            label={requestedLanguage === "zh" ? "正在打开对话" : "Opening conversation"}
          />
          <div />
        </section>
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

  const isCaregiverStage = session.stage === "caregiver";
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
        {session.stage === "consent" || session.stage === "checkin" ? (
          localBackend ? null : (
            <Card className="space-y-5">
              <h1 className="text-3xl font-semibold text-foreground">
                {t("开始对话", "Start conversation")}
              </h1>
              <p className="text-lg leading-relaxed text-muted-foreground">
                {t(
                  "回答会保存给肾科护理团队。语音回答会送去转成文字。",
                  "Your answers are saved for your kidney care team. Voice answers are sent for transcription.",
                )}
              </p>
              <BigButton
                onClick={() =>
                  void setStage("explore", {
                    readiness: "ready",
                    consent_recording: true,
                    consent_sharing: true,
                  })
                }
              >
                {t("同意并开始", "Agree and start")}
              </BigButton>
            </Card>
          )
        ) : null}

        {session.stage === "explore" ? (
          <ConversationTurns
            sessionId={session.id}
            scope="patient"
            entries={entries}
            language={language}
            speaker="patient"
            onSave={saveConversationEntry}
            onComplete={() => setStage("gate")}
          />
        ) : null}

        {session.stage === "gate" ? (
          <SensitiveGate
            language={language}
            onChoose={(choice) => {
              if (choice === "defer") {
                void handleNoAnswer(SENSITIVE_QUESTION, "patient", "deferred", "caregiver_intro");
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
              onSubmit={(answer, mode) =>
                void handleAnswer(
                  SENSITIVE_QUESTION,
                  answer,
                  mode,
                  "patient",
                  session.stage === "sensitive_private" ? "private" : "shared",
                  "caregiver_intro",
                )
              }
              onSkip={() =>
                void handleNoAnswer(SENSITIVE_QUESTION, "patient", "skipped", "caregiver_intro")
              }
              onDefer={() =>
                void handleNoAnswer(SENSITIVE_QUESTION, "patient", "deferred", "caregiver_intro")
              }
            />
          </div>
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
            onSave={saveConversationEntry}
            onComplete={() => setStage("synthesis")}
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
          <Card className="space-y-4 text-center">
            <Check className="mx-auto h-14 w-14 text-primary" />
            <h1 className="text-3xl font-semibold text-foreground">
              {t("对话已完成", "Conversation complete")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {hasSummaryContent
                ? localBackend
                  ? t(
                      "摘要已保存在这台设备，尚未发送给护理团队。",
                      "Summary saved on this device. It has not been sent to your care team.",
                    )
                  : t("摘要已保存，护理团队可以查看。", "Summary saved for your care team.")
                : t("没有保存回答。", "No answers were saved.")}
            </p>
            {summary?.confirmed && hasSummaryContent ? (
              <BigButton
                disabled={downloading}
                onClick={async () => {
                  setDownloading(true);
                  try {
                    const { downloadSummaryPdf } = await import("@/lib/summary-pdf");
                    await downloadSummaryPdf(
                      t("对话摘要", "Conversation summary"),
                      SUMMARY_SECTIONS.map((section) => ({
                        heading: t(section.zh, section.en),
                        answers: (summary[section.key] ?? []).map((answer) =>
                          translatedText(answer, language),
                        ),
                      })),
                      language,
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
                  : t("下载摘要 (PDF)", "Download summary (PDF)")}
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

type EditableItem = { text: string; include: boolean };

function editableSummary(summary: SummaryRow, language: Language) {
  const items = {} as Record<SummaryKey, EditableItem[]>;
  for (const section of SUMMARY_SECTIONS) {
    items[section.key] = (summary[section.key] ?? []).map((text) => ({
      text: translatedText(text, language),
      include: true,
    }));
  }
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
      const deferred = entries
        .filter((e) => e.visibility === "deferred" || e.visibility === "private")
        .map((e) => {
          if (e.topic === "sensitive-1") {
            return t("换肾或家人捐肾", "Kidney transplant or family donation");
          }
          if (e.topic === "caregiver-4") {
            return t("照顾者想私下谈", "Caregiver wants to talk privately");
          }
          const question = e.question.split(" / ")[language === "en" ? 1 : 0] ?? e.question;
          return e.speaker === "caregiver" ? `${t("照顾者", "Caregiver")}: ${question}` : question;
        });
      const shared = entries.filter((e) => e.visibility === "shared" && e.answer.trim());
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
                .filter((e) => e.visibility === "shared")
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
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">
          {buildFailed
            ? t("无法整理摘要", "Could not prepare summary")
            : t("正在整理摘要…", "Preparing your summary…")}
        </h1>
        {buildFailed ? (
          <BigButton onClick={() => void build()} disabled={working}>
            {t("重试", "Try again")}
          </BigButton>
        ) : null}
      </Card>
    );
  }

  const reviewItems = items ?? editableSummary(summary, language);

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
        flaggedTopics: picked("flagged_topics"),
      };
      const text = localBackend
        ? [
            ...payload.patientPriorities,
            ...payload.caregiverSupport,
            ...payload.flaggedTopics,
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
      const current = prev ?? editableSummary(summary, language);
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

      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {SUMMARY_SECTIONS.filter((section) => reviewItems[section.key].length > 0).map(
          (section) => (
            <Card key={section.key} className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">{t(section.zh, section.en)}</h2>
              {reviewItems[section.key].map((item, index) => {
                const itemKey = `${section.key}-${index}`;
                return (
                  <div key={itemKey} className="rounded-2xl border border-border p-4">
                    {editing === itemKey ? (
                      <textarea
                        autoFocus
                        aria-label={t(
                          `${section.zh}，第 ${index + 1} 点`,
                          `${section.en}, point ${index + 1}`,
                        )}
                        value={item.text}
                        rows={3}
                        onChange={(event) =>
                          update(section.key, index, { text: event.target.value })
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
                        onClick={() => update(section.key, index, { include: !item.include })}
                        className="min-h-11 px-3 py-1"
                      >
                        {item.include ? t("不放进摘要", "Leave out") : t("放回摘要", "Put back")}
                      </ActionButton>
                    </div>
                  </div>
                );
              })}
            </Card>
          ),
        )}
      </div>

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
                const current = prev ?? editableSummary(summary, language);
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
        {working ? t("正在保存…", "Saving…") : t("确认摘要", "Confirm summary")}
      </BigButton>
    </div>
  );
}
