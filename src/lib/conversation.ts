import { SCRIPT } from "./ckd-script.ts";

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
    scope === "caregiver"
      ? q.section === "caregiver"
      : ["values", "worries", "life"].includes(q.section),
  );
  const history = entries.filter((e) => topics.some((q) => q.id === e.topic));
  const available = topics.filter((q) => {
    const turns = history.filter((e) => e.topic === q.id);
    return (
      turns.length < 2 &&
      !turns.some((e) => ["skipped", "deferred", "private"].includes(e.visibility))
    );
  });
  return {
    history: history.map((e) =>
      e.visibility === "private"
        ? { ...e, answer: "[Private answer recorded. Do not revisit or reflect it.]" }
        : e,
    ),
    available,
    complete: history.length >= (scope === "patient" ? 12 : 6) || available.length === 0,
  };
}
