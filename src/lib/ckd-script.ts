export type Section = "values" | "worries" | "life" | "treatment" | "sensitive" | "caregiver";

export type AnswerKind = "single" | "multiple" | "ranking";
export type AnswerChoice = { zh: string; en: string; exclusive?: boolean };

export type ScriptQuestion = {
  id: string;
  section: Section;
  zh: string;
  en: string;
  choices?: AnswerChoice[];
  answerKind?: AnswerKind;
  requiredForCompletion?: boolean;
};

const GENERAL_PATIENT_QUESTIONS: ScriptQuestion[] = [
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
    id: "life-3",
    section: "life",
    zh: "在家里，有没有谁是您觉得可以依靠、愿意帮您的？",
    en: "At home, is there someone you feel you can rely on for help?",
  },
];

const TREATMENT_QUESTIONS: ScriptQuestion[] = [
  {
    id: "treatment-mobility",
    section: "treatment",
    answerKind: "multiple",
    requiredForCompletion: true,
    zh: "平时在家里或外出时，您的行动和完成日常事情会有多方便？",
    en: "How easy is it for you to move around and manage everyday tasks at home or outside?",
    choices: [
      {
        zh: "大多数时候可以自己行动和处理日常事情",
        en: "I can usually move around and manage everyday tasks independently",
      },
      {
        zh: "走路、站立或上下楼梯有些困难",
        en: "I have some difficulty walking, standing or using stairs",
      },
      {
        zh: "会使用拐杖、助行器或轮椅",
        en: "I use a walking aid, walker or wheelchair",
      },
      { zh: "有些时候需要别人协助", en: "I sometimes need another person's help" },
      {
        zh: "体力或行动情况每天可能不同",
        en: "My energy or mobility can change from day to day",
      },
      { zh: "还不确定", en: "Not sure yet", exclusive: true },
    ],
  },
  {
    id: "treatment-travel",
    section: "treatment",
    answerKind: "multiple",
    requiredForCompletion: true,
    zh: "平时去看诊或需要经常外出时，交通和出行对您来说怎么样？",
    en: "When you attend appointments or need to go out regularly, what is transport and travel like for you?",
    choices: [
      { zh: "通常可以自己安排可靠的交通", en: "I can usually arrange reliable transport myself" },
      {
        zh: "家人或朋友可以接送或陪同",
        en: "Family or friends can provide transport or come with me",
      },
      {
        zh: "会使用公共交通或预约接送服务",
        en: "I use public transport or booked transport services",
      },
      {
        zh: "路程、费用或等候时间会带来困难",
        en: "Distance, cost or waiting time can make travel difficult",
      },
      {
        zh: "如果需要经常出门，会很难安排",
        en: "Frequent trips away from home would be difficult to arrange",
      },
      {
        zh: "能够旅行或在外过夜对我很重要",
        en: "Being able to travel or stay away overnight is important to me",
      },
      {
        zh: "目前没有交通或出行方面的担忧",
        en: "No transport or travel concerns at the moment",
        exclusive: true,
      },
      { zh: "还不确定", en: "Not sure yet", exclusive: true },
    ],
  },
  {
    id: "treatment-location",
    section: "treatment",
    answerKind: "multiple",
    requiredForCompletion: true,
    zh: "如果需要定期接受护理，您在哪里会觉得比较安心和方便？家里还有哪些情况需要考虑？",
    en: "If you needed regular care, where would you feel most comfortable, and what should be considered about your home?",
    choices: [
      {
        zh: "如果可以，希望主要在家接受护理",
        en: "I would prefer to receive most care at home if possible",
      },
      {
        zh: "在诊所或护理中心，有工作人员在旁会更安心",
        en: "I would feel safer at a clinic or care centre with staff nearby",
      },
      {
        zh: "在家和到中心接受护理都可以",
        en: "A mix of care at home and at a centre could work for me",
      },
      {
        zh: "家里有干净、安静和私密的空间",
        en: "My home has a clean, quiet and private space for care",
      },
      { zh: "家里的空间或储物位置有限", en: "Space or storage at home is limited" },
      {
        zh: "家务或家庭责任可能让居家护理较难安排",
        en: "Household or family responsibilities could make care at home difficult",
      },
      {
        zh: "对地点没有特别偏好",
        en: "I have no strong preference about location",
        exclusive: true,
      },
      { zh: "还不确定", en: "Not sure yet", exclusive: true },
    ],
  },
  {
    id: "treatment-independence",
    section: "treatment",
    answerKind: "multiple",
    requiredForCompletion: true,
    zh: "在日常护理中，您希望自己参与到什么程度？",
    en: "How involved would you like to be in managing your day-to-day care?",
    choices: [
      {
        zh: "希望尽量自己学习和处理日常护理",
        en: "I would like to learn and manage as much day-to-day care as I can",
      },
      {
        zh: "希望日常护理步骤尽量简单",
        en: "I would prefer the day-to-day care steps to be as simple as possible",
      },
      {
        zh: "愿意处理一些步骤，但希望护理团队定期指导",
        en: "I am willing to manage some tasks with regular guidance from my care team",
      },
      {
        zh: "较希望由护理人员处理大部分护理步骤",
        en: "I would prefer care staff to manage most care tasks",
      },
      {
        zh: "希望参与的程度可能会随身体状况改变",
        en: "How involved I want to be may change with how I am feeling",
      },
      { zh: "还不确定", en: "Not sure yet", exclusive: true },
    ],
  },
  {
    id: "treatment-priorities",
    section: "treatment",
    answerKind: "ranking",
    requiredForCompletion: true,
    zh: "想到今后的护理怎样配合您的日常生活，下面哪些事情对您最重要？请把最重要的排在第一位。",
    en: "Thinking about how future care could fit into your daily life, which of these things matter most to you? Please rank the most important first.",
    choices: [
      {
        zh: "护理时间可以配合工作、学习或其他责任",
        en: "Fitting care around work, studies or other responsibilities",
      },
      { zh: "可以灵活安排每天的时间", en: "Keeping my daily schedule flexible" },
      {
        zh: "每天的护理安排固定、容易预先计划",
        en: "Having a predictable routine that is easy to plan around",
      },
      { zh: "能够旅行或在外过夜", en: "Being able to travel or stay away overnight" },
      {
        zh: "尽量减少每天花在护理上的时间",
        en: "Reducing the amount of time spent on care each day",
      },
      {
        zh: "尽量减少复诊或交通次数",
        en: "Reducing the number of appointments or trips",
      },
      {
        zh: "请护理团队说明不同选择可能怎样影响寿命",
        en: "Having my care team explain how different choices may affect how long I live",
      },
      {
        zh: "还不确定，希望护理团队为我说明",
        en: "Not sure yet; I would like my care team to explain",
        exclusive: true,
      },
    ],
  },
];

const SENSITIVE_QUESTIONS: ScriptQuestion[] = [
  {
    id: "sensitive-1",
    section: "sensitive",
    zh: "如果您现在愿意谈，我们可以慢慢说。想到由亲近的人或家人捐肾给您，您心里有什么感受？",
    en: "If you feel ready, we can take this slowly. What comes to mind when you think about receiving a kidney from someone close to you or a family member?",
  },
];

const CAREGIVER_QUESTIONS: ScriptQuestion[] = [
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

export const SCRIPT: ScriptQuestion[] = [
  ...GENERAL_PATIENT_QUESTIONS,
  ...TREATMENT_QUESTIONS,
  ...SENSITIVE_QUESTIONS,
  ...CAREGIVER_QUESTIONS,
];

export const SENSITIVE_GATE = {
  id: "sensitive-gate",
  zh: "亲近的人或家人捐肾可能是很私人的话题。您想怎样谈这个话题？",
  en: "Living kidney donation from someone close to you or a family member can feel very personal. How would you like to discuss it?",
};

export const SPOKEN_PROMPTS = [...SCRIPT, SENSITIVE_GATE];

export const PATIENT_FLOW: Section[] = ["values", "worries", "life", "treatment"];
