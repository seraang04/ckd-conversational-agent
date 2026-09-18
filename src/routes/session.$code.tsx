import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Lock, Pause, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { BigButton, Card, FooterNote, Notice, Page, SpeakerBadge, inputClass } from "@/components/ckd/ui";
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

export const Route = createFileRoute("/session/$code")({
  head: () => ({
    meta: [
      { title: "对话 · Values conversation" },
      {
        name: "description",
        content:
          "A voice-led conversation about what matters to you, ready for your next kidney consultation.",
      },
      { property: "og:title", content: "Values conversation" },
      {
        property: "og:description",
        content: "A voice-led conversation about what matters to you before your kidney consultation.",
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
  "patient_priorities" | "caregiver_support" | "shared_concerns" | "differing_concerns" | "flagged_topics"
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
  const entries = bundle?.entries ?? [];
  const dialect = session?.language === "hokkien" ? "hokkien" : "zh";

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
      if (error) toast.error("Could not save progress. Please try again.");
      await refresh();
    },
    [session, refresh],
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
        toast.error("Could not save that answer. Please try again.");
        return false;
      }
      await refresh();
      return true;
    },
    [session, refresh],
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
          reflect({ data: { question: question.zh, answer, speaker: who } }),
          distressCheck({ data: { answer } }),
        ]);
        setReflection(text);
        if (distressed) setDistress(true);
        void speak(text.split("EN:")[0] ?? text, dialect);
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
      <Page>
        <p className="text-lg text-muted-foreground">正在打开… Opening…</p>
      </Page>
    );
  }

  if (!session) {
    return (
      <Page>
        <Card className="space-y-4">
          <h1 className="text-2xl font-semibold text-foreground">找不到这个号码</h1>
          <p className="text-muted-foreground">No session with the code {code}.</p>
          <Link to="/session" className="text-lg font-semibold text-primary underline">
            再输入一次 · Try another code
          </Link>
        </Card>
      </Page>
    );
  }

  const isCaregiverStage = session.stage === "caregiver";

  return (
    <Page variant={isCaregiverStage ? "caregiver" : "patient"} subtitle={`Session ${session.code}`}>
      <div className="space-y-5">
        <Progress stage={session.stage} />

        {distress ? (
          <Notice tone="warn">
            如果您现在心里很难受，请告诉身边的人，或联络您的护理团队。
            <br />
            If this feels heavy right now, please tell someone with you or contact your care team. We
            will note that you would like support.
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
            <h1 className="text-3xl font-semibold text-foreground">今天先休息</h1>
            <p className="text-lg text-muted-foreground">
              We have saved that today was not the right day. That is a completely valid answer, and the
              coordinator will see it. Come back any time with code {session.code}.
            </p>
            <BigButton onClick={() => void setStage("checkin")}>
              我想继续 · I would like to continue
            </BigButton>
          </Card>
        ) : null}

        {session.stage === "consent" ? (
          <Card className="space-y-5">
            <h1 className="text-3xl font-semibold text-foreground">开始之前</h1>
            <p className="text-lg leading-relaxed text-foreground">
              我们会把您说的话记下来，整理成一份给肾科协调员看的摘要。
              您不想让别人知道的事，可以随时说不要写进去。
            </p>
            <p className="text-base text-muted-foreground">
              Your words are written down and turned into a summary for the renal coordinator. Anything
              you ask to keep out is left out. You can stop at any time.
            </p>
            <BigButton onClick={() => void setStage("explore")}>好，我同意 · Yes, go ahead</BigButton>
            <BigButton variant="ghost" onClick={() => void setStage("paused", { readiness: "declined" })}>
              今天不要 · Not today
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
              <h2 className="text-2xl font-semibold text-foreground">谢谢您</h2>
              <p className="text-lg text-muted-foreground">
                Thank you. Next there is one more sensitive topic, and then a few questions for the
                person helping you.
              </p>
              <BigButton onClick={() => void setStage("gate")}>继续 · Continue</BigButton>
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
                  <Lock className="h-4 w-4" /> 这一段只有您和协调员看到，照顾者看不到。 · This answer stays
                  private: the caregiver will not see it.
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
                void saveEntry(SENSITIVE_QUESTION, "（跳过 skipped）", "typed", "patient", "skipped").then(
                  () => setStage("caregiver"),
                )
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
                这一段是问照顾者的，和病人的回答分开记录。 · This section is for the caregiver and is
                recorded separately from the patient's answers.
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
                  void saveEntry(nextCaregiverQuestion, "（跳过 skipped）", "typed", "caregiver", "skipped")
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
              <h2 className="text-2xl font-semibold text-foreground">都问完了</h2>
              <p className="text-lg text-muted-foreground">
                All questions are done. Next we put it together so the patient can check it.
              </p>
              <BigButton onClick={() => void setStage("synthesis")}>整理一下 · Put it together</BigButton>
            </Card>
          )
        ) : null}

        {session.stage === "synthesis" || session.stage === "confirm" ? (
          <Confirmation
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
            <h1 className="text-3xl font-semibold text-foreground">谢谢您，都准备好了</h1>
            <p className="text-lg text-muted-foreground">
              Your renal coordinator will read this before the next consultation. Nothing you asked to
              withhold was included.
            </p>
            <Link
              to="/coordinator/$code"
              params={{ code: session.code }}
              className="block text-lg font-semibold text-primary underline"
            >
              看摘要 · View the summary
            </Link>
          </Card>
        ) : null}

        {session.stage !== "done" && session.stage !== "paused" ? (
          <button
            type="button"
            onClick={() => void setStage("paused")}
            className="mx-auto flex items-center gap-2 rounded-full border-2 border-border px-5 py-3 text-sm font-medium text-foreground"
          >
            <Pause className="h-4 w-4" /> 先休息，等下再说 · Pause and come back later
          </button>
        ) : null}

        <Transcript entries={entries} />
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
  const text = "今天方便谈一谈吗？如果今天心情不好，也可以改天。";
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl font-semibold leading-snug text-foreground">{text}</h1>
      <p className="text-lg text-muted-foreground">
        Is today a good day to talk? If you are not feeling up to it, another day is fine.
      </p>
      <button
        type="button"
        onClick={() => void speak(text, dialect)}
        className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
      >
        听一听 · Read aloud
      </button>
      <BigButton onClick={onReady}>可以，开始吧 · Yes, let's start</BigButton>
      <BigButton variant="ghost" onClick={onNotReady}>
        我还没准备好 · I'm not ready
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
  const body =
    "没关系。这个对话不是要您马上决定什么。我们只是想知道，什么事对您来说重要，好让医生和协调员先知道。您随时可以停下来。";
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl font-semibold text-foreground">慢慢来，没关系</h1>
      <p className="text-xl leading-relaxed text-foreground">{body}</p>
      <p className="text-base text-muted-foreground">
        Nothing here asks you to decide anything. We only want to know what matters to you, so your
        doctor and coordinator know it before the consultation. You can stop at any time.
      </p>
      <button
        type="button"
        onClick={() => void speak(body, dialect)}
        className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
      >
        听一听 · Read aloud
      </button>
      <BigButton onClick={onBack}>我现在可以了 · I'm ready now</BigButton>
      <BigButton variant="ghost" onClick={onPause}>
        今天先这样 · Stop for today
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
  const text = "接下来想问换肾和家人捐肾的事。您希望怎么谈？";
  return (
    <Card className="space-y-5">
      <h1 className="text-3xl font-semibold leading-snug text-foreground">{text}</h1>
      <p className="text-lg text-muted-foreground">
        Next is about transplant and living donation. How would you like to talk about it? You never
        have to explain your choice.
      </p>
      <button
        type="button"
        onClick={() => void speak(text, dialect)}
        className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
      >
        听一听 · Read aloud
      </button>
      <BigButton onClick={() => onChoose("private")}>
        我自己谈，家人先离开 · Privately, without my caregiver
      </BigButton>
      <BigButton variant="soft" onClick={() => onChoose("together")}>
        一起谈 · Together with my caregiver
      </BigButton>
      <BigButton variant="ghost" onClick={() => onChoose("defer")}>
        等看诊时和协调员谈 · Later, with the coordinator
      </BigButton>
    </Card>
  );
}

type EditableItem = { text: string; include: boolean };

function Confirmation({
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
      toast.error("Could not put the summary together. Please try again.");
    } finally {
      setWorking(false);
    }
  }, [entries, sessionId, synthesise, refresh]);

  const load = useCallback(() => {
    if (!summary) return;
    const next = {} as Record<SummaryKey, EditableItem[]>;
    for (const section of SUMMARY_SECTIONS) {
      next[section.key] = (summary[section.key] ?? []).map((text) => ({ text, include: true }));
    }
    setItems(next);
  }, [summary]);

  if (!summary) {
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">整理您说过的话</h1>
        <p className="text-lg text-muted-foreground">
          We will organise what was said, in the patient's own words, for the patient to check.
        </p>
        <BigButton onClick={() => void build()} disabled={working}>
          {working ? "正在整理… Putting it together…" : "开始整理 · Put it together"}
        </BigButton>
      </Card>
    );
  }

  if (!items) {
    return (
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">请您看一看</h1>
        <p className="text-lg text-muted-foreground">
          Please check whether this reflects what matters to you. You can change, remove or add
          anything.
        </p>
        <BigButton onClick={load}>看一看 · Review it</BigButton>
        <BigButton variant="ghost" onClick={() => void build()} disabled={working}>
          {working ? "…" : "重新整理 · Redo the summary"}
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
      toast.error("Could not save the summary. Please try again.");
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
        <h1 className="text-3xl font-semibold text-foreground">这样对吗？</h1>
        <p className="text-lg text-muted-foreground">
          Does this reflect what matters to you? Untick anything you do not want the coordinator to
          see — it will be left out.
        </p>
      </Card>

      {SUMMARY_SECTIONS.map((section) => (
        <Card key={section.key} className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">
            {section.zh}
            <span className="block text-sm font-normal text-muted-foreground">{section.en}</span>
          </h2>
          {items[section.key].length === 0 ? (
            <p className="text-sm text-muted-foreground">（没有内容 · nothing recorded）</p>
          ) : null}
          {items[section.key].map((item, index) => (
            <div key={`${section.key}-${index}`} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-4 h-6 w-6 shrink-0"
                checked={item.include}
                onChange={(e) => update(section.key, index, { include: e.target.checked })}
                aria-label="Include this point"
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
                aria-label="Withhold this point"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </Card>
      ))}

      <Card className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">还想加一句吗？ · Anything to add?</h2>
        <textarea
          value={addition}
          rows={3}
          onChange={(e) => setAddition(e.target.value)}
          className={inputClass}
          placeholder="加一句您觉得重要的话 · Add something important to you"
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
          加进去 · Add it
        </BigButton>
      </Card>

      <BigButton onClick={() => void confirm()} disabled={working}>
        {working ? "正在准备… Preparing…" : "就这样，交给协调员 · Confirm and send to the coordinator"}
      </BigButton>
    </div>
  );
}

function Transcript({ entries }: { entries: EntryRow[] }) {
  if (entries.length === 0) return null;
  return (
    <details className="rounded-3xl border border-border bg-card p-5">
      <summary className="cursor-pointer text-base font-semibold text-foreground">
        已经记下的话（{entries.length}） · Answers recorded so far
      </summary>
      <ul className="mt-4 space-y-4">
        {entries.map((entry) => (
          <li key={entry.id} className="space-y-1 border-b border-border pb-3 last:border-0">
            <div className="flex items-center gap-2">
              <SpeakerBadge speaker={entry.speaker} />
              {entry.visibility === "private" ? (
                <span className="rounded-full bg-private-surface px-3 py-1 text-xs font-semibold text-foreground">
                  私下 Private
                </span>
              ) : null}
              {entry.visibility === "deferred" ? (
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                  留给协调员 Deferred
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">{entry.question}</p>
            <p className="text-base text-foreground">{entry.answer}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
