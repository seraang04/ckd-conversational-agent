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
    zh: "我们慢慢来。您愿意和我说说，现在生活里什么对您最重要吗？",
    en: "We can take this slowly. What matters most to you in your life right now?",
  },
  {
    id: "values-3",
    section: "values",
    zh: "如果您愿意说，有什么喜欢的事，是您希望以后还能继续做的？",
    en: "If you're comfortable sharing, what's something you enjoy and hope to keep doing?",
  },
  {
    id: "worries-1",
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
