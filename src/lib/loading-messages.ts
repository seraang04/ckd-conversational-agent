export type LoadingMessage = {
  zh: string;
  en: string;
};

export const QUESTION_LOADING_MESSAGES: readonly LoadingMessage[] = [
  {
    zh: "当护理计划能反映对您重要的事时，它会更贴合您的需要。",
    en: "Care planning works best when it reflects what matters to you.",
  },
  {
    zh: "共同决策会同时考虑医疗证据，以及您的偏好和价值观。",
    en: "Shared decisions combine medical evidence with your preferences and values.",
  },
  {
    zh: "参与医疗决定没有唯一的正确方式。",
    en: "There is no single right way to take part in a healthcare decision.",
  },
  {
    zh: "把信息分成简短清楚的部分，通常更容易理解。",
    en: "Information is often easier to understand when explained in small, clear parts.",
  },
  {
    zh: "提问是参与医疗决定的正常一部分。",
    en: "Questions are a normal part of making healthcare decisions.",
  },
  {
    zh: "有时间思考，可以帮助人们作出更适合自己生活的决定。",
    en: "Having time to think can help people make decisions that fit their lives.",
  },
  {
    zh: "当需要或意愿改变时，护理决定也可以重新检讨。",
    en: "Care decisions can be reviewed as needs or wishes change.",
  },
  {
    zh: "在患者愿意的情况下，家人、朋友或照顾者可以一起参与护理讨论。",
    en: "Family members, friends, or caregivers can join care discussions when the patient wishes.",
  },
  {
    zh: "一位您信任的人可以帮忙记笔记，并记住讨论内容。",
    en: "A trusted person can take notes and help remember what was discussed.",
  },
  {
    zh: "看诊前写下问题，可以帮助您在看诊时记得提出。",
    en: "Writing questions before an appointment can make them easier to remember.",
  },
  {
    zh: "每个人对治疗的好处和负担，重视程度可能不同。",
    en: "Different people may value the benefits and burdens of treatment differently.",
  },
  {
    zh: "日常生活、工作、家庭和舒适度都会影响护理选择。",
    en: "Daily routines, work, family, and comfort can all shape care choices.",
  },
  {
    zh: "时间、交通和费用等实际顾虑，也是医疗决定的一部分。",
    en: "Practical concerns such as time, travel, and cost are part of healthcare decisions.",
  },
  {
    zh: "比较每个选择的好处、风险和日常影响，可以让选择更清楚。",
    en: "Comparing the benefits, risks, and daily impact of each option can make choices clearer.",
  },
  {
    zh: "明确下一步和检讨日期，可以让护理计划更容易跟进。",
    en: "Clear next steps and review dates can make a care plan easier to follow.",
  },
  {
    zh: "用自己的话说出重点，可以帮助护理团队更了解您。",
    en: "Sharing priorities in your own words helps the care team understand you.",
  },
  {
    zh: "复述自己的理解，可以发现还有哪些地方需要说明。",
    en: "Repeating what you understood can reveal what still needs explaining.",
  },
  {
    zh: "决策辅助工具能支持您与护理团队的沟通。",
    en: "Decision aids are designed to support conversations with your care team.",
  },
  {
    zh: "肾脏护理通常由不同的医疗人员共同参与。",
    en: "Kidney care often involves different health professionals working together.",
  },
  {
    zh: "简短列出最重要的事项，可以让看诊讨论更集中。",
    en: "A short list of priorities can help keep an appointment focused.",
  },
];

export function questionLoadingMessage(progress: number): LoadingMessage {
  const index = Math.abs(Math.trunc(progress)) % QUESTION_LOADING_MESSAGES.length;
  return QUESTION_LOADING_MESSAGES[index]!;
}
