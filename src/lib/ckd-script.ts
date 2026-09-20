export type Section = "values" | "worries" | "life" | "sensitive" | "caregiver";

export type ScriptQuestion = {
  id: string;
  section: Section;
  zh: string;
  en: string;
};

export const SCRIPT: ScriptQuestion[] = [
  {
    id: "values-1",
    section: "values",
    zh: "在您现在的生活里，什么事情最重要？",
    en: "In your life right now, what matters most to you?",
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
    id: "life-2",
    section: "life",
    zh: "去看诊有什么困难吗？",
    en: "What makes it hard to get to your appointments?",
  },
  {
    id: "life-3",
    section: "life",
    zh: "在家里，谁能帮您？",
    en: "Who can help you at home?",
  },
  {
    id: "sensitive-1",
    section: "sensitive",
    zh: "对于换肾或家人捐肾，您有什么感觉？",
    en: "How do you feel about a kidney transplant or family donation?",
  },
  {
    id: "caregiver-2",
    section: "caregiver",
    zh: "您平常怎么帮病人？",
    en: "How do you help the patient?",
  },
  {
    id: "caregiver-3",
    section: "caregiver",
    zh: "照顾病人时，您担心什么？",
    en: "What worries you about helping with their care?",
  },
  {
    id: "caregiver-4",
    section: "caregiver",
    zh: "有什么事，您想单独和肾科协调员谈？",
    en: "Is there anything you'd like to discuss privately with the renal coordinator?",
  },
];

export const SENSITIVE_GATE = {
  id: "sensitive-gate",
  zh: "关于换肾或家人捐肾的事，您想怎么谈？",
  en: "How would you like to discuss a transplant or family donation?",
};

export const SPOKEN_PROMPTS = [...SCRIPT, SENSITIVE_GATE];

export const PATIENT_FLOW: Section[] = ["values", "worries", "life"];
