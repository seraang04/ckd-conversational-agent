import { useText, translatedText } from "@/lib/language";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lock, Pause, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  BigButton,
  Card,
  FooterNote,
  Notice,
  Page,
  SpeakerBadge,
  inputClass,
} from "@/components/ckd/ui";
import { VoiceAnswer } from "@/components/ckd/VoiceAnswer";
import { supabase } from "@/integrations/supabase/client";
import { fetchSessionBundle, type EntryRow, type SummaryRow } from "@/lib/ckd-db";
import { PATIENT_FLOW, SCRIPT, type ScriptQuestion } from "@/lib/ckd-script";
import {
  buildClinicianSummary,
  buildSynthesis,
  checkDistress,
  reflectAnswer,
} from "@/lib/ckd.functions";
import { speak } from "@/lib/speak";
import { rememberDeviceSession } from "@/lib/session-device";

export const Route = createFileRoute("/session/$code")({
  validateSearch: (search: Record<string, unknown>) => ({
    language:
      search["language"] === "en" || search["language"] === "zh" || search["language"] === "hokkien"
        ? (search["language"] as "en" | "zh" | "hokkien")
        : undefined,
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
const CAREGIVER_QUESTIONS = SCRIPT.filter((q) => q.section === "caregiver");
const PATIENT_QUESTIONS = SCRIPT.filter((q) => PATIENT_FLOW.includes(q.section));

type SummaryKey = keyof Pick<
  SummaryRow,
  | "patient_priorities"
  | "caregiver_support"
  | "shared_concerns"
  | "differing_concerns"
  | "flagged_topics"
>;

const SUMMARY_SECTIONS: { key: SummaryKey; zh: string; en: string }[] = [
  { key: "patient_priorities", zh: "我在意的事", en: "What matters to the patient" },
  { key: "caregiver_support", zh: "照顾者能帮的", en: "Caregiver support and limits" },
  { key: "shared_concerns", zh: "共同的担心", en: "Shared concerns" },
  { key: "differing_concerns", zh: "看法不同的地方", en: "Where views differ" },
  { key: "flagged_topics", zh: "留给协调员的话题", en: "Topics for the coordinator" },
];

function SessionFlow() {
  const { code } = Route.useParams();
  const { language } = Route.useSearch();
  const query = useQuery({
    queryKey: ["ckd-session", code],
    queryFn: () => fetchSessionBundle(code),
  });

  const [speaker, setSpeaker] = useState<"patient" | "caregiver">("patient");
  const [reflection, setReflection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [distress, setDistress] = useState(false);

  const reflect = useServerFn(reflectAnswer);
  const distressCheck = useServerFn(checkDistress);
  const synthesise = useServerFn(buildSynthesis);
  const summarise = useServerFn(buildClinicianSummary);

  const bundle = query.data;
  const session = bundle?.session;
  useEffect(() => {
    if (session) rememberDeviceSession(session.code);
  }, [session]);

  const entries = useMemo(() => bundle?.entries ?? [], [bundle?.entries]);
  const selectedLanguage = language ?? session?.language;
  const dialect =
    selectedLanguage === "en" ? "en" : selectedLanguage === "hokkien" ? "hokkien" : "zh";

  const t = useText(dialect);

  const answered = useMemo(() => new Set(entries.map((e) => e.topic)), [entries]);
  const nextPatientQuestion = PATIENT_QUESTIONS.find((q) => !answered.has(q.id)) ?? null;
  const nextCaregiverQuestion = CAREGIVER_QUESTIONS.find((q) => !answered.has(q.id)) ?? null;

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const setStage = useCallback(
    async (stage: string, extra: Record<string, unknown> = {}) => {
      if (!session) return;
      const { error } = await supabase
        .from("ckd_sessions")
        .update({ stage, updated_at: new Date().toISOString(), ...extra })
        .eq("id", session.id);
      if (error)
        toast.error(t("无法保存进度，请重试。", "Could not save progress. Please try again."));
      await refresh();
    },
    [session, refresh, t],
  );

  const saveEntry = useCallback(
    async (
      question: ScriptQuestion,
      answer: string,
      mode: "voice" | "typed",
      who: "patient" | "caregiver",
      visibility: string,
    ) => {
      if (!session) return;
      const { error } = await supabase.from("ckd_entries").insert({
        session_id: session.id,
        speaker: who,
        topic: question.id,
        question: `${question.zh} / ${question.en}`,
        answer,
        visibility,
        input_mode: mode,
      });
      if (error) {
        toast.error(t("无法保存回答，请重试。", "Could not save that answer. Please try again."));
        return false;
      }
      await refresh();
      return true;
    },
    [session, refresh, t],
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
      setBusy(true);
      setReflection(null);
      const saved = await saveEntry(question, answer, mode, who, visibility);
      if (!saved) {
        setBusy(false);
        return;
      }
      try {
        const [{ reflection: text }, { distressed }] = await Promise.all([
          reflect({
            data: { question: dialect === "en" ? question.en : question.zh, answer, speaker: who },
          }),
          distressCheck({ data: { answer } }),
        ]);
        setReflection(text);
        if (distressed) setDistress(true);
        void speak(
          dialect === "en"
            ? (text.split("EN:")[1]?.trim() ?? text)
            : (text.split("EN:")[0] ?? text),
          dialect,
        );
      } catch {
        // A missing reflection never blocks the conversation.
      }
      if (afterStage) await setStage(afterStage);
      setBusy(false);
    },
    [saveEntry, reflect, distressCheck, setStage, dialect],
  );

  if (query.isLoading) {
    return (
      <Page language={dialect}>
        <p className="text-lg text-muted-foreground">{t("正在打开…", "Opening…")}</p>
      </Page>
    );
  }

  if (!session) {
    return (
      <Page language={dialect}>
        <Card className="space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">
            {t("无法打开对话", "Unable to open conversation")}
          </h1>
          <p className="text-muted-foreground">
            {query.isError
              ? t("无法加载对话，请重试。", "Could not load your conversation. Please try again.")
              : t("此对话已无法使用。", "This conversation is no longer available.")}
          </p>
          <Link to="/" className="text-lg font-semibold text-primary underline">
            {t("返回首页", "Back to home")}
          </Link>
        </Card>
      </Page>
    );
  }

  const isCaregiverStage = session.stage === "caregiver";

  return (
    <Page
      language={dialect}
      variant={isCaregiverStage ? "caregiver" : "patient"}
      subtitle={
        dialect === "en"
          ? "English"
          : dialect === "hokkien"
            ? t("福建话", "Hokkien")
            : t("华语", "Mandarin Chinese")
      }
    >
      <div className="space-y-5">
        <Progress stage={session.stage} />

        {distress ? (
          <Notice tone="warn">
            {t(
              "如果您现在心里很难受，请告诉身边的人，或联络您的护理团队。我们会记下您希望获得支持。",
              "If this feels heavy right now, please tell someone with you or contact your care team. We will note that you would like support.",
            )}
          </Notice>
        ) : null}

        {session.stage === "checkin" ? (
          <CheckIn
            dialect={dialect}
            onReady={() => void setStage("consent", { readiness: "ready" })}
            onNotReady={() => void setStage("readiness", { readiness: "not_ready" })}
          />
        ) : null}

        {session.stage === "readiness" ? (
          <ReadinessSupport
            dialect={dialect}
            onBack={() => void setStage("checkin")}
            onPause={() => void setStage("paused", { readiness: "declined" })}
          />
        ) : null}

        {session.stage === "paused" ? (
          <Card className="space-y-4">
            <h1 className="text-3xl font-semibold text-foreground">
              {t("今天先休息", "Take a break today")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t(
                "我们已记下您今天想先休息。这样完全可以，协调员也会看到。准备好后，请用同一浏览器回来，选择继续对话。",
                "We have saved that today was not the right day. That is a completely valid answer, and the coordinator will see it. Return to this app in the same browser and choose Continue conversation whenever you are ready.",
              )}
            </p>
            <BigButton onClick={() => void setStage("checkin")}>
              {t("我想继续", "I would like to continue")}
            </BigButton>
          </Card>
        ) : null}

        {session.stage === "consent" ? (
          <Card className="space-y-5">
            <h1 className="text-3xl font-semibold text-foreground">
              {t("开始之前", "Before we begin")}
            </h1>
            <p className="text-lg leading-relaxed text-foreground">
              {t(
                "我们会把您说的话记下来，整理成一份给肾科协调员看的摘要。您不想让别人知道的事，可以随时说不要写进去。您随时可以停止。",
                "Your words are written down and turned into a summary for the renal coordinator. Anything you ask to keep out is left out. You can stop at any time.",
              )}
            </p>
            <BigButton
              onClick={() =>
                void setStage("explore", { consent_recording: true, consent_sharing: true })
              }
            >
              {t("好，我同意", "Yes, go ahead")}
            </BigButton>
            <BigButton
              variant="ghost"
              onClick={() => void setStage("paused", { readiness: "declined" })}
            >
              {t("今天不要", "Not today")}
            </BigButton>
          </Card>
        ) : null}

        {session.stage === "explore" ? (
          nextPatientQuestion ? (
            <VoiceAnswer
              key={nextPatientQuestion.id}
              questionZh={nextPatientQuestion.zh}
              questionEn={nextPatientQuestion.en}
              dialect={dialect}
              speaker={speaker}
              onSpeakerChange={setSpeaker}
              busy={busy}
              reflection={reflection}
              onSubmit={(answer, mode) =>
                void handleAnswer(nextPatientQuestion, answer, mode, speaker, "shared")
              }
              onSkip={() =>
                void saveEntry(nextPatientQuestion, "（跳过 skipped）", "typed", speaker, "skipped")
              }
              onDefer={() =>
                void saveEntry(
                  nextPatientQuestion,
                  "（留给协调员 deferred to coordinator）",
                  "typed",
                  speaker,
                  "deferred",
                )
              }
            />
          ) : (
            <Card className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">{t("谢谢您", "Thank you")}</h2>
              <p className="text-lg text-muted-foreground">
                {t(
                  "谢谢您。接下来还有一个较私人的话题，然后会问照顾您的人几个问题。",
                  "Thank you. Next there is one more sensitive topic, and then a few questions for the person helping you.",
                )}
              </p>
              <BigButton onClick={() => void setStage("gate")}>{t("继续", "Continue")}</BigButton>
            </Card>
          )
        ) : null}

        {session.stage === "gate" ? (
          <SensitiveGate
            dialect={dialect}
            onChoose={(choice) => {
              if (choice === "defer") {
                void saveEntry(
                  SENSITIVE_QUESTION,
                  "（留给协调员 deferred to coordinator）",
                  "typed",
                  "patient",
                  "deferred",
                ).then(() => setStage("caregiver"));
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
                    "这一段只有您和协调员看到，照顾者看不到。",
                    "This answer stays private: the caregiver will not see it.",
                  )}
                </span>
              </Notice>
            ) : null}
            <VoiceAnswer
              key={SENSITIVE_QUESTION.id}
              questionZh={SENSITIVE_QUESTION.zh}
              questionEn={SENSITIVE_QUESTION.en}
              dialect={dialect}
              speaker="patient"
              onSpeakerChange={() => undefined}
              busy={busy}
              reflection={reflection}
              onSubmit={(answer, mode) =>
                void handleAnswer(
                  SENSITIVE_QUESTION,
                  answer,
                  mode,
                  "patient",
                  session.stage === "sensitive_private" ? "private" : "shared",
                  "caregiver",
                )
              }
              onSkip={() =>
                void saveEntry(
                  SENSITIVE_QUESTION,
                  "（跳过 skipped）",
                  "typed",
                  "patient",
                  "skipped",
                ).then(() => setStage("caregiver"))
              }
              onDefer={() =>
                void saveEntry(
                  SENSITIVE_QUESTION,
                  "（留给协调员 deferred to coordinator）",
                  "typed",
                  "patient",
                  "deferred",
                ).then(() => setStage("caregiver"))
              }
            />
          </div>
        ) : null}

        {session.stage === "caregiver" ? (
          nextCaregiverQuestion ? (
            <div className="space-y-4">
              <Notice>
                {t(
                  "这一段是问照顾者的，和病人的回答分开记录。",
                  "This section is for the caregiver and is recorded separately from the patient's answers.",
                )}
              </Notice>
              <VoiceAnswer
                key={nextCaregiverQuestion.id}
                questionZh={nextCaregiverQuestion.zh}
                questionEn={nextCaregiverQuestion.en}
                dialect={dialect}
                speaker="caregiver"
                onSpeakerChange={() => undefined}
                busy={busy}
                reflection={reflection}
                onSubmit={(answer, mode) =>
                  void handleAnswer(
                    nextCaregiverQuestion,
                    answer,
                    mode,
                    "caregiver",
                    nextCaregiverQuestion.id === "caregiver-4" ? "private" : "shared",
                  )
                }
                onSkip={() =>
                  void saveEntry(
                    nextCaregiverQuestion,
                    "（跳过 skipped）",
                    "typed",
                    "caregiver",
                    "skipped",
                  )
                }
                onDefer={() =>
                  void saveEntry(
                    nextCaregiverQuestion,
                    "（留给协调员 deferred to coordinator）",
                    "typed",
                    "caregiver",
                    "deferred",
                  )
                }
              />
            </div>
          ) : (
            <Card className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">
                {t("都问完了", "All questions are done")}
              </h2>
              <p className="text-lg text-muted-foreground">
                {t(
                  "问题都问完了。接下来会整理回答，请您确认。",
                  "All questions are done. Next we put it together so the patient can check it.",
                )}
              </p>
              <BigButton onClick={() => void setStage("synthesis")}>
                {t("整理一下", "Put it together")}
              </BigButton>
            </Card>
          )
        ) : null}

        {session.stage === "synthesis" || session.stage === "confirm" ? (
          <Confirmation
            dialect={dialect}
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
              {t("谢谢您，都准备好了", "Thank you, everything is ready")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t(
                "肾科协调员会在下次看诊前阅读这份摘要。您要求保密的内容不会包含在内。",
                "Your renal coordinator will read this before the next consultation. Nothing you asked to withhold was included.",
              )}
            </p>
          </Card>
        ) : null}

        {session.stage !== "done" && session.stage !== "paused" ? (
          <button
            type="button"
            onClick={() => void setStage("paused")}
            className="mx-auto flex items-center gap-2 rounded-full border-2 border-border px-5 py-3 text-sm font-medium text-foreground"
          >
            <Pause className="h-4 w-4" /> {t("先休息，等下再说", "Pause and come back later")}
          </button>
        ) : null}

        <Transcript entries={entries} dialect={dialect} />
        <FooterNote />
      </div>
    </Page>
  );
}

function Progress({ stage }: { stage: string }) {
  const order = ["checkin", "explore", "gate", "caregiver", "synthesis", "done"];
  const normalised = stage.startsWith("sensitive")
    ? "gate"
    : stage === "readiness" || stage === "consent" || stage === "paused"
      ? "checkin"
      : stage === "confirm"
        ? "synthesis"
        : stage;
  const index = Math.max(0, order.indexOf(normalised));
  return (
    <div className="flex gap-2" aria-hidden>
      {order.map((step, i) => (
        <span
          key={step}
          className={`h-2 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

function CheckIn({
  dialect,
  onReady,
  onNotReady,
}: {
  dialect: string;
  onReady: () => void;
  onNotReady: () => void;
}) {
  const t = useText(dialect);
  const text =
    dialect === "en"
      ? "Is today a good day to talk? If you are not feeling up to it, another day is fine."
      : "今天方便谈一谈吗？如果今天心情不好，也可以改天。";
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl font-semibold leading-snug text-foreground">{text}</h1>

      <button
        type="button"
        onClick={() => void speak(text, dialect)}
        className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
      >
        {t("听一听", "Read aloud")}
      </button>
      <BigButton onClick={onReady}>{t("可以，开始吧", "Yes, let's start")}</BigButton>
      <BigButton variant="ghost" onClick={onNotReady}>
        {t("我还没准备好", "I'm not ready")}
      </BigButton>
    </Card>
  );
}

function ReadinessSupport({
  dialect,
  onBack,
  onPause,
}: {
  dialect: string;
  onBack: () => void;
  onPause: () => void;
}) {
  const t = useText(dialect);
  const body =
    dialect === "en"
      ? "Nothing here asks you to decide anything. We only want to know what matters to you, so your doctor and coordinator know it before the consultation. You can stop at any time."
      : "没关系。这个对话不是要您马上决定什么。我们只是想知道，什么事对您来说重要，好让医生和协调员先知道。您随时可以停下来。";
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl font-semibold text-foreground">
        {t("慢慢来，没关系", "Take your time")}
      </h1>
      <p className="text-xl leading-relaxed text-foreground">{body}</p>

      <button
        type="button"
        onClick={() => void speak(body, dialect)}
        className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
      >
        {t("听一听", "Read aloud")}
      </button>
      <BigButton onClick={onBack}>{t("我现在可以了", "I'm ready now")}</BigButton>
      <BigButton variant="ghost" onClick={onPause}>
        {t("今天先这样", "Stop for today")}
      </BigButton>
    </Card>
  );
}

function SensitiveGate({
  dialect,
  onChoose,
}: {
  dialect: string;
  onChoose: (choice: "private" | "together" | "defer") => void;
}) {
  const t = useText(dialect);
  const text =
    dialect === "en"
      ? "Next is about transplant and living donation. How would you like to talk about it? You never have to explain your choice."
      : "接下来想问换肾和家人捐肾的事。您希望怎么谈？";
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl font-semibold leading-snug text-foreground">{text}</h1>

      <button
        type="button"
        onClick={() => void speak(text, dialect)}
        className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
      >
        {t("听一听", "Read aloud")}
      </button>
      <BigButton onClick={() => onChoose("private")}>
        {t("我自己谈，家人先离开", "Privately, without my caregiver")}
      </BigButton>
      <BigButton variant="soft" onClick={() => onChoose("together")}>
        {t("一起谈", "Together with my caregiver")}
      </BigButton>
      <BigButton variant="ghost" onClick={() => onChoose("defer")}>
        {t("等看诊时和协调员谈", "Later, with the coordinator")}
      </BigButton>
    </Card>
  );
}

type EditableItem = { text: string; include: boolean };

function Confirmation({
  dialect,
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
  dialect: string;
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
  const t = useText(dialect);
  const [items, setItems] = useState<Record<SummaryKey, EditableItem[]> | null>(null);
  const [working, setWorking] = useState(false);
  const [addition, setAddition] = useState("");

  const build = useCallback(async () => {
    setWorking(true);
    try {
      const deferred = entries
        .filter((e) => e.visibility === "deferred" || e.visibility === "private")
        .map((e) => e.question.split(" / ")[0] ?? e.question);
      const result = await synthesise({
        data: {
          entries: entries
            .filter((e) => e.visibility !== "skipped")
            .map((e) => ({
              speaker: e.speaker,
              question: e.question,
              answer: e.answer,
              visibility: e.visibility,
            })),
          deferredTopics: deferred,
        },
      });
      const { error } = await supabase.from("ckd_summaries").upsert(
        {
          session_id: sessionId,
          patient_priorities: result.patient_priorities,
          caregiver_support: result.caregiver_support,
          shared_concerns: result.shared_concerns,
          differing_concerns: result.differing_concerns,
          flagged_topics: result.flagged_topics,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "session_id" },
      );
      if (error) throw error;
      await refresh();
    } catch {
      toast.error(
        t("无法整理摘要，请重试。", "Could not put the summary together. Please try again."),
      );
    } finally {
      setWorking(false);
    }
  }, [entries, sessionId, synthesise, refresh, t]);

  const load = useCallback(() => {
    if (!summary) return;
    const next = {} as Record<SummaryKey, EditableItem[]>;
    for (const section of SUMMARY_SECTIONS) {
      next[section.key] = (summary[section.key] ?? []).map((text) => ({
        text: translatedText(text, dialect),
        include: true,
      }));
    }
    setItems(next);
  }, [summary, dialect]);

  if (!summary) {
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">
          {t("整理您说过的话", "Putting your words together")}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t(
            "我们会用您自己的话整理回答，供您确认。",
            "We will organise what was said, in the patient's own words, for the patient to check.",
          )}
        </p>
        <BigButton onClick={() => void build()} disabled={working}>
          {working ? t("正在整理…", "Putting it together…") : t("开始整理", "Put it together")}
        </BigButton>
      </Card>
    );
  }

  if (!items) {
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">
          {t("请您看一看", "Please review your summary")}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t(
            "请确认这些内容是否反映您在意的事。您可以修改、删除或添加内容。",
            "Please check whether this reflects what matters to you. You can change, remove or add anything.",
          )}
        </p>
        <BigButton onClick={load}>{t("看一看", "Review it")}</BigButton>
        <BigButton variant="ghost" onClick={() => void build()} disabled={working}>
          {working ? "…" : t("重新整理", "Redo the summary")}
        </BigButton>
      </Card>
    );
  }

  const confirm = async () => {
    setWorking(true);
    try {
      const picked = (key: SummaryKey) =>
        items[key].filter((i) => i.include && i.text.trim()).map((i) => i.text.trim());
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
      const { summary: text } = await summarise({ data: payload });
      const { error } = await supabase
        .from("ckd_summaries")
        .update({
          patient_priorities: payload.patientPriorities,
          caregiver_support: payload.caregiverSupport,
          shared_concerns: payload.sharedConcerns,
          differing_concerns: payload.differingConcerns,
          flagged_topics: payload.flaggedTopics,
          clinician_summary: text,
          confirmed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("session_id", sessionId);
      if (error) throw error;
      onDone();
    } catch {
      toast.error(t("无法保存摘要，请重试。", "Could not save the summary. Please try again."));
    } finally {
      setWorking(false);
    }
  };

  const update = (key: SummaryKey, index: number, patch: Partial<EditableItem>) => {
    setItems((prev) => {
      if (!prev) return prev;
      const list = [...prev[key]];
      const existing = list[index];
      if (!existing) return prev;
      list[index] = { ...existing, ...patch };
      return { ...prev, [key]: list };
    });
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">
          {t("这样对吗？", "Does this look right?")}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t(
            "这是否反映您在意的事？不想让协调员看到的内容，请取消勾选，我们就不会加入摘要。",
            "Does this reflect what matters to you? Untick anything you do not want the coordinator to see — it will be left out.",
          )}
        </p>
      </Card>

      {SUMMARY_SECTIONS.map((section) => (
        <Card key={section.key} className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">{t(section.zh, section.en)}</h2>
          {items[section.key].length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("（没有内容）", "(Nothing recorded)")}
            </p>
          ) : null}
          {items[section.key].map((item, index) => (
            <div key={`${section.key}-${index}`} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-4 h-6 w-6 shrink-0"
                checked={item.include}
                onChange={(e) => update(section.key, index, { include: e.target.checked })}
                aria-label={t("加入这一点", "Include this point")}
              />
              <textarea
                value={item.text}
                rows={2}
                onChange={(e) => update(section.key, index, { text: e.target.value })}
                className={`${inputClass} text-base ${item.include ? "" : "opacity-50 line-through"}`}
              />
              <button
                type="button"
                onClick={() => update(section.key, index, { include: false, text: item.text })}
                className="mt-3 text-muted-foreground"
                aria-label={t("不分享这一点", "Withhold this point")}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </Card>
      ))}

      <Card className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">
          {t("还想加一句吗？", "Anything to add?")}
        </h2>
        <textarea
          value={addition}
          rows={3}
          onChange={(e) => setAddition(e.target.value)}
          className={inputClass}
          placeholder={t("加一句您觉得重要的话", "Add something important to you")}
        />
        <BigButton
          variant="soft"
          onClick={() => {
            if (!addition.trim()) return;
            setItems((prev) =>
              prev
                ? {
                    ...prev,
                    patient_priorities: [
                      ...prev.patient_priorities,
                      { text: addition.trim(), include: true },
                    ],
                  }
                : prev,
            );
            setAddition("");
          }}
        >
          {t("加进去", "Add it")}
        </BigButton>
      </Card>

      <BigButton onClick={() => void confirm()} disabled={working}>
        {working
          ? t("正在准备…", "Preparing…")
          : t("就这样，交给协调员", "Confirm and send to the coordinator")}
      </BigButton>
    </div>
  );
}

function Transcript({ entries, dialect }: { entries: EntryRow[]; dialect: string }) {
  const t = useText(dialect);
  if (entries.length === 0) return null;
  return (
    <details className="rounded-3xl border border-border bg-card p-5">
      <summary className="cursor-pointer text-base font-semibold text-foreground">
        {t("已经记下的话", "Answers recorded so far")} ({entries.length})
      </summary>
      <ul className="mt-4 space-y-4">
        {entries.map((entry) => (
          <li key={entry.id} className="space-y-1 border-b border-border pb-3 last:border-0">
            <div className="flex items-center gap-2">
              <SpeakerBadge speaker={entry.speaker} />
              {entry.visibility === "private" ? (
                <span className="rounded-full bg-private-surface px-3 py-1 text-xs font-semibold text-foreground">
                  {t("私下", "Private")}
                </span>
              ) : null}
              {entry.visibility === "deferred" ? (
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                  {t("留给协调员", "Deferred")}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {translatedText(entry.question, dialect)}
            </p>
            <p className="text-base text-foreground">
              {entry.visibility === "skipped"
                ? t("已跳过", "Skipped")
                : entry.visibility === "deferred"
                  ? t("留给协调员谈", "Deferred to the coordinator")
                  : entry.answer}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
