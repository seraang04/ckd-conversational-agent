import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { GenerateReportButton } from "./ReportPreview";
import { VoiceAnswer } from "./VoiceAnswer";
import { BigButton, Card, ConversationLoading, Notice } from "./ui";
import { nextConversationTurn } from "@/lib/ckd.functions";
import { conversationContext, type ConversationScope } from "@/lib/conversation";
import { SCRIPT, type ScriptQuestion } from "@/lib/ckd-script";
import type { EntryRow } from "@/lib/ckd-db";
import type { AnswerSubmission } from "@/lib/guided-answer";
import { useText, type Language } from "@/lib/language";

type Props = {
  sessionId: string;
  scope: ConversationScope;
  entries: EntryRow[];
  language: Language;
  speaker: "patient" | "caregiver";
  onSave: (
    question: ScriptQuestion,
    submission: AnswerSubmission,
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

  const submit = async (submission: AnswerSubmission, visibility: string) => {
    if (!next || savingRef.current) return;
    const topic = SCRIPT.find((question) => question.id === next.topic);
    if (!topic) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(
        { ...topic, zh: next.questionZh, en: next.questionEn },
        submission,
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

  if (turn.isPending || next?.complete) {
    return (
      <ConversationLoading
        label={t("正在准备下一题", "Preparing next question")}
        showQuestionMessages
        messageSeed={entries.length}
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
        questionZh={next.questionZh}
        questionEn={next.questionEn}
        language={language}
        speaker={speaker}
        onSubmit={(submission) =>
          void submit(submission, next.topic === "caregiver-4" ? "private" : "shared")
        }
        onSkip={() => void submit({ answer: "", freeText: null, inputMode: "typed" }, "skipped")}
        onDefer={() => void submit({ answer: "", freeText: null, inputMode: "typed" }, "deferred")}
        busy={saving}
        headerAction={
          <GenerateReportButton kind={speaker} entries={entries} language={language} disabled={saving} />
        }
      />
    </div>
  );
}
