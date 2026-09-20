import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { VoiceAnswer } from "./VoiceAnswer";
import { BigButton, Card, MicPending, Notice } from "./ui";
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
  const savingRef = useRef(false);
  const completedRef = useRef(false);
  const context = conversationContext(scope, entries);
  const historyKey = JSON.stringify(context.history);
  const turn = useQuery({
    queryKey: ["conversation-turn", sessionId, scope, historyKey],
    queryFn: () => plan({ data: { scope, entries: context.history } }),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
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
    if (next?.complete) void advance();
  }, [next?.complete, advance]);

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

  if (turn.isPending || saving || next?.complete) {
    return (
      <section className="mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-3xl grid-rows-[minmax(11rem,auto)_minmax(14rem,1fr)_auto] gap-4 py-3 sm:min-h-[calc(100dvh-9rem)] sm:grid-rows-[minmax(11rem,auto)_minmax(16rem,1fr)_auto] sm:py-4">
        <div className="space-y-4" aria-hidden>
          <div className="h-9 w-3/4 max-w-md animate-pulse rounded-2xl bg-muted" />
          <div
            style={{ animationDelay: "0.4s" }}
            className="h-9 w-1/2 max-w-xs animate-pulse rounded-2xl bg-muted"
          />
        </div>
        <MicPending label={t("正在准备下一题", "Preparing next question")} />
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
