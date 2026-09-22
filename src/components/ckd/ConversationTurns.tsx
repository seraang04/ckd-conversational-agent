import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import claraMascot from "@/assets/clara-mascot.png";

import { VoiceAnswer } from "./VoiceAnswer";
import { BigButton, Card, Notice } from "./ui";
import { nextConversationTurn } from "@/lib/ckd.functions";
import { conversationContext, type ConversationScope } from "@/lib/conversation";
import { SCRIPT, type ScriptQuestion } from "@/lib/ckd-script";
import type { EntryRow } from "@/lib/ckd-db";
import { useText, type Language } from "@/lib/language";

type Props = {
  sessionId: string;
  scope: ConversationScope;
  entries: EntryRow[];
  language: Language;
  speaker: "patient" | "caregiver";
  onSave: (
    question: ScriptQuestion,
    answer: string,
    mode: "voice" | "typed",
    who: "patient" | "caregiver",
    visibility: string,
  ) => Promise<boolean | undefined>;
  onComplete: () => Promise<boolean>;
};

export function ConversationTurns({
  sessionId,
  scope,
  entries,
  language,
  speaker,
  onSave,
  onComplete,
}: Props) {
  const t = useText(language);
  const plan = useServerFn(nextConversationTurn);
  const [saving, setSaving] = useState(false);
  const [advanceFailed, setAdvanceFailed] = useState(false);
  const [introducedConversation, setIntroducedConversation] = useState<string | null>(null);
  const savingRef = useRef(false);
  const completedRef = useRef(false);
  const context = conversationContext(scope, entries);
  const conversationKey = `${sessionId}:${scope}`;
  const needsIntroduction =
    context.history.length === 0 && introducedConversation !== conversationKey;
  const historyKey = JSON.stringify(context.history);
  const turn = useQuery({
    queryKey: ["conversation-turn", sessionId, scope, historyKey],
    queryFn: () => plan({ data: { scope, entries: context.history } }),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: !needsIntroduction,
  });
  const next = turn.data;

  const advance = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    try {
      if (!(await onComplete())) setAdvanceFailed(true);
    } catch {
      setAdvanceFailed(true);
    }
  }, [onComplete]);

  useEffect(() => {
    if (!needsIntroduction && next?.complete) void advance();
  }, [needsIntroduction, next?.complete, advance]);

  const submit = async (answer: string, mode: "voice" | "typed", visibility: string) => {
    if (!next || savingRef.current) return;
    const topic = SCRIPT.find((question) => question.id === next.topic);
    if (!topic) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(
        { ...topic, zh: next.questionZh, en: next.questionEn },
        answer,
        mode,
        speaker,
        visibility,
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (needsIntroduction) {
    return (
      <Card className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-4 sm:gap-6">
          <img
            src={claraMascot}
            loading="eager"
            fetchPriority="high"
            alt={t("对话伙伴 Clara", "Clara, your conversation companion")}
            className="h-24 w-20 shrink-0 object-contain sm:h-32 sm:w-24"
          />
          <h1 className="min-w-0 text-3xl font-semibold text-foreground">
            {t("您好，我是 Clara。", "Hello, I’m Clara.")}
          </h1>
        </div>
        <p className="text-lg leading-relaxed text-muted-foreground">
          {scope === "patient"
            ? t(
                "我会陪您想一想，不同的肾脏治疗方案如何适合您的日常生活，为您下次和肾科护理团队的讨论做准备。",
                "I’ll help you think through how different kidney treatment options may fit your daily life, ahead of your next conversation with your kidney care team.",
              )
            : t(
                "我会陪您从照顾者的角度想一想，不同的肾脏治疗方案如何适合病人的日常生活，为接下来和肾科护理团队的讨论做准备。",
                "I’ll help you think through how different kidney treatment options may fit the patient’s daily life from your perspective as a caregiver, ahead of the next conversation with the kidney care team.",
              )}
        </p>
        <p className="text-lg leading-relaxed text-muted-foreground">
          {t(
            "我们会聊聊您在意的事、担忧、日常安排，以及可以得到的支持。您分享的内容会帮助护理团队了解您的想法，一起讨论治疗选择。",
            "We’ll talk about what matters to you, any worries, daily routines, and available support. What you share will help the care team understand your perspective when discussing treatment choices together.",
          )}
        </p>
        <p className="text-lg leading-relaxed text-muted-foreground">
          {t(
            "我们可以慢慢来。有些问题会提供选项，您也可以打字或用语音补充，或跳过任何问题。现在不需要做决定。我是对话伙伴，不是医生。",
            "We can take this slowly. Some questions offer choices, and you can add your own thoughts by typing or speaking, or skip any question. You don’t need to make a decision now. I’m a conversation companion, not a clinician.",
          )}
        </p>
        <BigButton onClick={() => setIntroducedConversation(conversationKey)}>
          {t("开始聊聊", "Let’s begin")}
        </BigButton>
      </Card>
    );
  }

  if (next?.complete && advanceFailed) {
    return (
      <Card className="space-y-4">
        <p>{t("无法继续。请重试。", "Could not continue. Please try again.")}</p>
        <BigButton
          onClick={() => {
            completedRef.current = false;
            setAdvanceFailed(false);
            void advance();
          }}
        >
          {t("重试", "Retry")}
        </BigButton>
      </Card>
    );
  }

  if (turn.isPending || next?.complete) {
    return (
      <section className="mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-3xl grid-rows-[minmax(11rem,auto)_minmax(14rem,1fr)_auto] gap-4 py-3 sm:min-h-[calc(100dvh-9rem)] sm:grid-rows-[minmax(11rem,auto)_minmax(16rem,1fr)_auto] sm:py-4">
        <div className="space-y-4" aria-hidden>
          <div className="h-9 w-3/4 max-w-md animate-pulse rounded-2xl bg-muted" />
          <div
            style={{ animationDelay: "0.4s" }}
            className="h-9 w-1/2 max-w-xs animate-pulse rounded-2xl bg-muted"
          />
        </div>
        <div className="flex flex-col items-center justify-center gap-5 py-3 text-center">
          <img
            src={claraMascot}
            loading="eager"
            alt={t("对话伙伴 Clara", "Clara, your conversation companion")}
            className="h-40 w-40 object-contain sm:h-52 sm:w-52"
          />
          <p role="status" className="text-xl font-semibold text-foreground">
            {t("正在准备下一题", "Preparing next question")}
          </p>
        </div>
        <div />
      </section>
    );
  }

  if (turn.isError) {
    return (
      <Card className="space-y-4">
        <p>{t("无法加载下一题。", "Could not load the next question.")}</p>
        <BigButton onClick={() => void turn.refetch()}>{t("重试", "Retry")}</BigButton>
      </Card>
    );
  }

  if (!next) return null;
  return (
    <div className="space-y-4">
      {next.topic === "caregiver-4" ? (
        <Notice>
          {t(
            "您的回答不会出现在病人的摘要中。",
            "Your answer will not appear in the patient's summary.",
          )}
        </Notice>
      ) : null}
      <VoiceAnswer
        key={historyKey}
        choices={
          context.history.some((entry) => entry.topic === next.topic)
            ? undefined
            : SCRIPT.find((question) => question.id === next.topic)?.choices
        }
        answerKind={SCRIPT.find((question) => question.id === next.topic)?.answerKind ?? "single"}
        acknowledgementZh={next.acknowledgementZh}
        acknowledgementEn={next.acknowledgementEn}
        questionZh={next.questionZh}
        questionEn={next.questionEn}
        language={language}
        speaker={speaker}
        onSubmit={(answer, mode) =>
          void submit(answer, mode, next.topic === "caregiver-4" ? "private" : "shared")
        }
        onSkip={() => void submit("", "typed", "skipped")}
        onDefer={() => void submit("", "typed", "deferred")}
        busy={saving}
      />
    </div>
  );
}
