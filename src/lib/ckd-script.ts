export type Section = "values" | "worries" | "life" | "sensitive" | "caregiver";

export type ScriptQuestion = {
  id: string;
  section: Section;
  zh: string;
  en: string;
};

export const PATIENT_SECTIONS: { key: Section; zh: string; en: string }[] = [
  { key: "values", zh: "我在意的事", en: "What matters to me" },
  { key: "worries", zh: "我担心的事", en: "What worries me" },
  { key: "life", zh: "我的生活", en: "What my life looks like" },
];

export const SCRIPT: ScriptQuestion[] = [
  {
    id: "values-1",
    section: "values",
    zh: "在您现在的生活里，什么事情最重要？",
    en: "In your life right now, what matters most to you?",
  },
  {
    id: "values-2",
    section: "values",
    zh: "哪一天算是好的一天？那天您会做什么？",
    en: "What makes a good day for you? What do you do on that day?",
  },
  {
    id: "values-3",
    section: "values",
    zh: "有什么事，您希望以后还能继续做？",
    en: "What is something you hope you can keep doing?",
  },
  {
    id: "worries-1",
    section: "worries",
    zh: "想到接下来的治疗，您最担心什么？",
    en: "When you think about treatment ahead, what worries you most?",
  },
  {
    id: "worries-2",
    section: "worries",
    zh: "这个担心有多重？会让您睡不好或吃不下吗？",
    en: "How heavy is that worry? Does it affect your sleep or appetite?",
  },
  {
    id: "worries-3",
    section: "worries",
    zh: "还有没有别的事，您一直放在心里？",
    en: "Is there anything else you have been keeping in your heart?",
  },
  {
    id: "life-1",
    section: "life",
    zh: "平常一天，您在家里怎么过？",
    en: "On an ordinary day, how do you spend your time at home?",
  },
  {
    id: "life-2",
    section: "life",
    zh: "去医院方不方便？谁陪您去？",
    en: "Is getting to the hospital easy? Who goes with you?",
  },
  {
    id: "life-3",
    section: "life",
    zh: "家里有谁可以帮您？他们能帮到什么？",
    en: "Who at home can help you, and what can they help with?",
  },
  {
    id: "sensitive-1",
    section: "sensitive",
    zh: "说到换肾，或者家人捐肾给您，您心里有什么想法或感觉？",
    en: "About a kidney transplant, or a family member donating, what thoughts or feelings do you have?",
  },
  {
    id: "caregiver-1",
    section: "caregiver",
    zh: "您是病人的什么人？平常参与多少？",
    en: "What is your relationship to the patient, and how involved are you day to day?",
  },
  {
    id: "caregiver-2",
    section: "caregiver",
    zh: "您能提供哪些支持？例如陪诊、煮饭、换班、经济。",
    en: "What support can you provide — appointments, meals, shifts, money?",
  },
  {
    id: "caregiver-3",
    section: "caregiver",
    zh: "作为照顾者，您自己担心什么？",
    en: "As a caregiver, what are you worried about yourself?",
  },
  {
    id: "caregiver-4",
    section: "caregiver",
    zh: "有没有什么事，您希望私下和肾科协调员谈？",
    en: "Is there anything you would prefer to raise privately with the renal coordinator?",
  },
];

export const questionsFor = (section: Section) => SCRIPT.filter((q) => q.section === section);

export const PATIENT_FLOW: Section[] = ["values", "worries", "life"];

export type SensitiveChoice = "private" | "together" | "defer";
