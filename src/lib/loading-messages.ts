export type LoadingMessage = {
  kind: "fact" | "support";
  zh: string;
  en: string;
};

/**
 * Short, non-directive messages for the wait between questions.
 * Clinical facts are limited to stable kidney functions and early CKD awareness.
 */
export const QUESTION_LOADING_MESSAGES: readonly LoadingMessage[] = [
  {
    kind: "fact",
    zh: "肾脏帮助清除血液中的废物和多余水分。",
    en: "Your kidneys remove waste and extra fluid from your blood.",
  },
  {
    kind: "support",
    zh: "简短回答就可以。",
    en: "A short answer is enough.",
  },
  {
    kind: "fact",
    zh: "肾脏帮助维持体内矿物质的平衡。",
    en: "Your kidneys help balance minerals in your body.",
  },
  {
    kind: "support",
    zh: "想一想日常生活中什么对您最重要。",
    en: "Think about what matters in your daily life.",
  },
  {
    kind: "fact",
    zh: "肾脏帮助调节血压。",
    en: "Your kidneys help regulate blood pressure.",
  },
  {
    kind: "support",
    zh: "您可以跳过问题，或留到看诊时再谈。",
    en: "You can skip a question or save it for your appointment.",
  },
  {
    kind: "fact",
    zh: "肾脏帮助身体制造红血球，也有助于维持骨骼健康。",
    en: "Your kidneys help your body make red blood cells and keep bones healthy.",
  },
  {
    kind: "support",
    zh: "用自己的话回答就好，没有标准答案。",
    en: "Use your own words. There is no perfect answer.",
  },
  {
    kind: "fact",
    zh: "早期慢性肾病通常没有症状。血液和尿液检查可以帮助了解肾脏健康。",
    en: "Early CKD often has no symptoms. Blood and urine tests help check kidney health.",
  },
  {
    kind: "support",
    zh: "慢慢来，准备好再回答。",
    en: "Take your time. Answer when you are ready.",
  },
];

export function questionLoadingMessage(seed: number, step: number): LoadingMessage {
  const index =
    (((seed + step) % QUESTION_LOADING_MESSAGES.length) + QUESTION_LOADING_MESSAGES.length) %
    QUESTION_LOADING_MESSAGES.length;
  return QUESTION_LOADING_MESSAGES[index]!;
}
