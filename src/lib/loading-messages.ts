export type LoadingMessage = {
  zh: string;
  en: string;
};

export const QUESTION_LOADING_MESSAGES: readonly LoadingMessage[] = [
  {
    zh: "对您重要的事，是规划良好护理的一部分。",
    en: "What matters to you is part of good care planning.",
  },
  {
    zh: "您的偏好、信念和价值观可以帮助引导医疗决定。",
    en: "Your preferences, beliefs, and values can guide healthcare decisions.",
  },
  {
    zh: "您可以按自己愿意的程度参与护理决定。",
    en: "You can take part in care decisions as much as you want.",
  },
  {
    zh: "您可以要求把信息分成更小、更清楚的部分来说明。",
    en: "You can ask for information in smaller, clearer parts.",
  },
  {
    zh: "如果没听明白，您可以请护理团队再解释一次。",
    en: "You can ask your care team to explain something again.",
  },
  {
    zh: "在作出护理决定前，您可以要求多一点时间考虑。",
    en: "You can ask for more time before making a care decision.",
  },
  {
    zh: "您可以改变想法，也可以日后重新讨论决定。",
    en: "You can change your mind and review a decision later.",
  },
  {
    zh: "如果您愿意，可以请家人、朋友或照顾者一起参与。",
    en: "You can involve a family member, friend, or caregiver if you wish.",
  },
  {
    zh: "您信任的人可以帮忙记笔记，并记住讨论内容。",
    en: "A trusted person can take notes and help remember what was discussed.",
  },
  {
    zh: "看诊前写下问题，可以帮助您记得要问什么。",
    en: "Writing down questions before an appointment can help you remember them.",
  },
  {
    zh: "每个人对治疗的好处和负担，重视程度可能不同。",
    en: "Different people may value the benefits and burdens of treatment differently.",
  },
  {
    zh: "您的日常生活、工作、家庭和舒适度都与护理选择有关。",
    en: "Your daily routine, work, family, and comfort are relevant to care choices.",
  },
  {
    zh: "时间、交通和费用等实际顾虑都值得讨论。",
    en: "Practical concerns such as time, travel, and cost are worth discussing.",
  },
  {
    zh: "护理团队可以说明每个选择的好处、风险和实际影响。",
    en: "Your care team can explain the benefits, risks, and practical effects of each option.",
  },
  {
    zh: "您可以询问下一步是什么，以及何时会再检讨计划。",
    en: "You can ask what happens next and when the plan will be reviewed.",
  },
  {
    zh: "用自己的话表达，可以帮助护理团队了解什么对您重要。",
    en: "Your own words help the care team understand what is important to you.",
  },
  {
    zh: "如果有不清楚的地方，您可以要求再次讨论某个选择。",
    en: "You can ask to discuss an option again if anything is unclear.",
  },
  {
    zh: "决策辅助工具用来支持沟通，不能取代护理团队。",
    en: "Decision aids support conversations; they do not replace your care team.",
  },
  {
    zh: "肾脏护理可能由不同的医疗人员共同参与。",
    en: "Kidney care can involve different health professionals working as a team.",
  },
  {
    zh: "简短列出您的重点，可以帮助看诊时更集中地讨论。",
    en: "A short list of your priorities can help focus the appointment.",
  },
];

export function questionLoadingMessage(progress: number): LoadingMessage {
  const index = Math.abs(Math.trunc(progress)) % QUESTION_LOADING_MESSAGES.length;
  return QUESTION_LOADING_MESSAGES[index]!;
}
