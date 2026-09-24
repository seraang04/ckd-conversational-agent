export type Section = "values" | "worries" | "life" | "sensitive" | "caregiver";

export type AnswerKind = "single" | "multiple" | "ranking";
export type AnswerChoice = { zh: string; en: string; exclusive?: boolean };

export type ScriptQuestion = {
  id: string;
  section: Section;
  zh: string;
  en: string;
  choices?: AnswerChoice[];
  answerKind?: AnswerKind;
};

export const SCRIPT: ScriptQuestion[] = [
  {
    id: "values-1",
    answerKind: "ranking",
    choices: [
      { zh: "和家人相处", en: "Time with family" },
      { zh: "保持独立", en: "Staying independent" },
      { zh: "继续工作或喜欢的活动", en: "Continuing work or activities I enjoy" },
      { zh: "感觉舒适", en: "Feeling comfortable" },
      { zh: "其他", en: "Something else" },
    ],
    section: "values",
    zh: "现在生活中，哪些事情对您最重要？",
    en: "What matters most to you right now?",
  },
  {
    id: "values-2",
    section: "values",
    zh: "在家接受治疗对您有多重要？",
    en: "How important is receiving treatment at home to you?",
    choices: [
      { zh: "不重要", en: "Not important" },
      { zh: "有点重要", en: "A little important" },
      { zh: "比较重要", en: "Quite important" },
      { zh: "非常重要", en: "Very important" },
      { zh: "还不确定", en: "Not sure yet" },
    ],
  },
  {
    id: "values-3",
    section: "values",
    zh: "您希望以后还能继续做什么？",
    en: "What do you hope to keep doing?",
  },
  {
    id: "worries-1",
    answerKind: "multiple",
    choices: [
      { zh: "治疗对身体的影响", en: "How treatment may affect my body" },
      { zh: "对日常生活的影响", en: "Changes to everyday life" },
      { zh: "费用", en: "Costs" },
      { zh: "对家人的影响", en: "Impact on family" },
      { zh: "其他", en: "Something else" },
      { zh: "还不确定", en: "Not sure yet", exclusive: true },
      { zh: "目前没有担忧", en: "No worries at the moment", exclusive: true },
    ],
    section: "worries",
    zh: "关于治疗，您最担心什么？",
    en: "What worries you most about treatment?",
  },
  {
    id: "life-2",
    section: "life",
    zh: "去看诊时，什么事情会让您觉得不方便？",
    en: "What makes it difficult to get to appointments?",
  },
  {
    id: "life-3",
    section: "life",
    zh: "在家里，谁可以帮助您？",
    en: "Who can help you at home?",
  },
  {
    id: "sensitive-1",
    section: "sensitive",
    zh: "对于换肾或家人捐肾，您有什么想法？",
    en: "What are your thoughts about a kidney transplant or donation from family?",
  },
  {
    id: "caregiver-2",
    section: "caregiver",
    zh: "您平时怎样帮助病人？",
    en: "How do you help care for the patient?",
  },
  {
    id: "caregiver-3",
    answerKind: "multiple",
    choices: [
      { zh: "时间与日常安排", en: "Time and daily routines" },
      { zh: "照顾时需要的帮助", en: "Help with caregiving" },
      { zh: "自己的身心健康", en: "My own wellbeing" },
      { zh: "费用", en: "Costs" },
      { zh: "其他", en: "Something else" },
      { zh: "还不确定", en: "Not sure yet", exclusive: true },
      { zh: "目前没有担忧", en: "No worries at the moment", exclusive: true },
    ],
    section: "caregiver",
    zh: "照顾病人时，您最担心什么？",
    en: "What worries you about caring for the patient?",
  },
  {
    id: "caregiver-4",
    section: "caregiver",
    zh: "您想私下和肾科协调员谈什么？",
    en: "What would you like to discuss privately with the renal coordinator?",
  },
];

export const SENSITIVE_GATE = {
  id: "sensitive-gate",
  zh: "关于换肾或家人捐肾，您想怎么谈？",
  en: "How would you like to discuss a kidney transplant or donation from family?",
};

export const SPOKEN_PROMPTS = [...SCRIPT, SENSITIVE_GATE];

export const PATIENT_FLOW: Section[] = ["values", "worries", "life"];
