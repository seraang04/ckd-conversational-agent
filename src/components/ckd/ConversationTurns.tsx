import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { VoiceAnswer } from "./VoiceAnswer";
import { BigButton, Card } from "./ui";
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
  onComplete: () => void;
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

  useEffect(() => {
    if (!next?.complete || completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [next?.complete, onComplete]);

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

  if (turn.isPending || saving || next?.complete) {
    return (
      <div
        role="status"
        aria-label={t("正在准备下一题", "Preparing next question")}
        className="mx-auto my-24 h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary"
      />
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
    <VoiceAnswer
      key={historyKey}
      questionZh={next.questionZh}
      questionEn={next.questionEn}
      language={language}
      speaker={speaker}
      onSubmit={(answer, mode) => void submit(answer, mode, "shared")}
      onSkip={() => void submit("", "typed", "skipped")}
      onDefer={() => void submit("", "typed", "deferred")}
      busy={saving}
    />
  );
}
