import { PATIENT_FLOW, SCRIPT, type ScriptQuestion } from "./ckd-script.ts";

export type ConversationScope = "patient" | "caregiver";
export type ConversationEntry = {
  topic: string;
  question: string;
  answer: string;
  speaker: string;
  visibility: string;
};

export function conversationContext(scope: ConversationScope, entries: ConversationEntry[]) {
  const topics = SCRIPT.filter((q) =>
    scope === "caregiver" ? q.section === "caregiver" : PATIENT_FLOW.includes(q.section),
  );
  const history = entries.filter((e) => topics.some((q) => q.id === e.topic));
  const available = topics.filter((q) => {
    const turns = history.filter((e) => e.topic === q.id);
    const parentAnswered = !q.followsTopic || history.some((e) => e.topic === q.followsTopic);
    return (
      parentAnswered &&
      (!q.requiredForCompletion || turns.length === 0) &&
      turns.length < 2 &&
      !turns.some((e) => ["skipped", "deferred", "private"].includes(e.visibility))
    );
  });
  const requiredTopics = topics.filter(
    (q) => q.requiredForCompletion && !history.some((e) => e.topic === q.id),
  );
  return {
    history: history.map((e) =>
      e.visibility === "private"
        ? { ...e, answer: "[Private answer recorded. Do not revisit or reflect it.]" }
        : e,
    ),
    available,
    requiredTopics,
    complete:
      requiredTopics.length === 0 &&
      (history.length >= (scope === "patient" ? 12 : 6) || available.length === 0),
  };
}

export function requiredQuestionForEarlyCompletion(
  requiredTopics: ScriptQuestion[],
  requestedComplete: boolean,
) {
  return requestedComplete ? requiredTopics[0] : undefined;
}
