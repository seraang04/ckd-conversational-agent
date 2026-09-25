export type LoadingMessage = {
  zh: string;
  en: string;
};

export const QUESTION_LOADING_MESSAGES: readonly LoadingMessage[] = [
  {
    zh: "慢慢来，不用着急。",
    en: "Take your time. There is no need to rush.",
  },
  {
    zh: "简短回答就可以。",
    en: "A short answer is enough.",
  },
  {
    zh: "这里没有对错之分。",
    en: "There is no right or wrong answer here.",
  },
  {
    zh: "用自己的话说就好。",
    en: "Use your own words.",
  },
  {
    zh: "还不确定也没关系。",
    en: "It is okay to be unsure.",
  },
  {
    zh: "我们可以一次回答一个问题。",
    en: "We can take this one question at a time.",
  },
  {
    zh: "对您重要的事，值得说出来。",
    en: "What matters to you is worth saying.",
  },
  {
    zh: "您的日常生活也很重要。",
    en: "Your everyday life matters here.",
  },
  {
    zh: "您的问题和顾虑值得花时间讨论。",
    en: "Your questions and concerns deserve time.",
  },
  {
    zh: "您最了解自己的生活。",
    en: "You know your life best.",
  },
  {
    zh: "对治疗有复杂的感受，是可以理解的。",
    en: "Mixed feelings about treatment are understandable.",
  },
  {
    zh: "面对困难的选择，可能需要多谈几次。",
    en: "Difficult choices can take more than one conversation.",
  },
  {
    zh: "清楚的解释是良好肾脏护理的一部分。",
    en: "Clear explanations are part of good kidney care.",
  },
  {
    zh: "您可以请一位信任的人一起参与。",
    en: "Someone you trust can join the conversation.",
  },
  {
    zh: "需要暂停一下也没关系。",
    en: "It is okay to pause.",
  },
  {
    zh: "您的重点可能会随着时间改变。",
    en: "Your priorities may change over time.",
  },
  {
    zh: "您与肾病相处的经历很重要。",
    en: "Your experience of living with kidney disease matters.",
  },
  {
    zh: "您可以从护理团队和信任的人那里获得支持。",
    en: "Support can come from your care team and people you trust.",
  },
  {
    zh: "护理计划也应该配合您想过的生活。",
    en: "Your care should support the life you want to live.",
  },
  {
    zh: "您不必独自面对每一个顾虑。",
    en: "You do not have to work through every concern alone.",
  },
];

export function questionLoadingMessage(progress: number): LoadingMessage {
  const index = Math.abs(Math.trunc(progress)) % QUESTION_LOADING_MESSAGES.length;
  return QUESTION_LOADING_MESSAGES[index]!;
}
