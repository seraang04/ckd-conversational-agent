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
    zh: "我们慢慢来。您愿意选出现在生活里最重要的事，并按重要程度排序吗？",
    en: "We can take this slowly. Which things matter most to you right now, and in what order?",
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
    zh: "如果您愿意说，有什么喜欢的事，是您希望以后还能继续做的？",
    en: "If you're comfortable sharing, what's something you enjoy and hope to keep doing?",
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
    zh: "想到接下来的治疗，心里可能会有些担心。您愿意说说最让您挂心的是什么吗？",
    en: "Thinking about treatment can bring up worries. What feels most concerning to you?",
  },
  {
    id: "life-2",
    section: "life",
    zh: "平时去看诊，会不会有什么不方便的地方？您可以慢慢说。",
    en: "When you go for appointments, is there anything that makes the journey difficult?",
  },
  {
    id: "life-3",
    section: "life",
    zh: "在家里，有没有谁是您觉得可以依靠、愿意帮您的？",
    en: "At home, is there someone you feel you can rely on for help?",
  },
  {
    id: "sensitive-1",
    section: "sensitive",
    zh: "如果您现在愿意谈，我们可以慢慢说。想到换肾或家人捐肾，您心里有什么感受？",
    en: "If you feel ready, we can take this slowly. What comes to mind when you think about a transplant or family donation?",
  },
  {
    id: "caregiver-2",
    section: "caregiver",
    zh: "您愿意说说，平时是怎么陪伴和帮助病人的吗？",
    en: "Would you tell me a little about how you support and care for the patient?",
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
    zh: "照顾病人的过程中，有什么事情是您比较挂心的吗？",
    en: "As you care for them, is there anything that's been weighing on your mind?",
  },
  {
    id: "caregiver-4",
    section: "caregiver",
    zh: "如果有些话您想私下说，可以告诉我。有什么事想单独和肾科协调员谈吗？",
    en: "If there's something you'd rather share privately, is there anything you'd like to discuss with the renal coordinator?",
  },
];

export const SENSITIVE_GATE = {
  id: "sensitive-gate",
  zh: "这个话题可以按您觉得安心的方式来谈。关于换肾或家人捐肾，您想怎么谈？",
  en: "We can approach this in whatever way feels most comfortable. How would you like to discuss a transplant or family donation?",
};

export const SPOKEN_PROMPTS = [...SCRIPT, SENSITIVE_GATE];

export const PATIENT_FLOW: Section[] = ["values", "worries", "life"];
