import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { VoiceAnswer } from "./VoiceAnswer";
import { BigButton, Card, Notice, SpeakerBadge } from "./ui";
import { nextConversationTurn } from "@/lib/ckd.functions";
import { conversationContext, type ConversationScope } from "@/lib/conversation";
import { SCRIPT, type ScriptQuestion } from "@/lib/ckd-script";
import type { EntryRow } from "@/lib/ckd-db";
import { useText } from "@/lib/language";

type Props = {
  sessionId: string;
  scope: ConversationScope;
  entries: EntryRow[];
  dialect: string;
  speaker: "patient" | "caregiver";
  onSpeakerChange: (speaker: "patient" | "caregiver") => void;
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
  dialect,
  speaker,
  onSpeakerChange,
  onSave,
  onComplete,
}: Props) {
  const t = useText(dialect);
  const plan = useServerFn(nextConversationTurn);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
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
  const submit = async (answer: string, mode: "voice" | "typed", visibility: string) => {
    if (!next || savingRef.current) return;
    const topic = SCRIPT.find((q) => q.id === next.topic);
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
  return (
    <div className="space-y-5">
      {context.history.length ? (
        <details className="rounded-2xl border border-border p-4">
          <summary className="cursor-pointer text-lg font-medium">
            {t("之前说过的话", "Our conversation so far")}
          </summary>
          <div className="mt-4 space-y-4">
            {entries
              .filter(
                (e) =>
                  context.history.some((h) => h.topic === e.topic) && e.visibility !== "private",
              )
              .map((e) => (
                <div key={e.id} className="space-y-2 border-t border-border pt-4">
                  <SpeakerBadge speaker={e.speaker} />
                  <p className="font-medium">
                    {dialect === "en"
                      ? (e.question.split(" / ")[1] ?? e.question)
                      : e.question.split(" / ")[0]}
                  </p>
                  <p className="whitespace-pre-wrap">{e.answer}</p>
                </div>
              ))}
          </div>
        </details>
      ) : null}
      {turn.isPending || saving ? (
        <Card>
          <p role="status">{t("让我想一想…", "Taking a moment…")}</p>
        </Card>
      ) : turn.isError ? (
        <Card className="space-y-4">
          <p>
            {t(
              "暂时无法继续对话。已保存的回答还在，请重试。",
              "We couldn't prepare the next question. Your saved answers are safe. Please retry.",
            )}
          </p>
          <BigButton onClick={() => void turn.refetch()}>{t("重试", "Retry")}</BigButton>
        </Card>
      ) : next?.complete ? (
        <Card className="space-y-4">
          <p>
            {t(
              "谢谢您分享这些。准备好后，我们继续。",
              "Thank you for sharing this. We can move on when you are ready.",
            )}
          </p>
          <BigButton onClick={onComplete}>{t("继续", "Continue")}</BigButton>
        </Card>
      ) : next ? (
        <>
          {next.topic === "caregiver-4" ? (
            <Notice>
              {t("这个回答只留给协调员。", "This answer is kept private for the coordinator.")}
            </Notice>
          ) : null}
          <VoiceAnswer
            key={historyKey}
            questionZh={next.questionZh}
            questionEn={next.questionEn}
            reflection={next.reflectionZh ? `${next.reflectionZh}\nEN: ${next.reflectionEn}` : null}
            dialect={dialect}
            speaker={speaker}
            onSpeakerChange={onSpeakerChange}
            onSubmit={(answer, mode) =>
              void submit(answer, mode, next.topic === "caregiver-4" ? "private" : "shared")
            }
            onSkip={() => void submit("（跳过 skipped）", "typed", "skipped")}
            onDefer={() =>
              void submit("（留给协调员 deferred to coordinator）", "typed", "deferred")
            }
          />
          <button type="button" className="text-base text-primary underline" onClick={onComplete}>
            {t("这一部分先谈到这里", "That's enough for this section")}
          </button>
        </>
      ) : null}
    </div>
  );
}
