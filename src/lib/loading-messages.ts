export type LoadingMessage = {
  zh: string;
  en: string;
};

export const QUESTION_LOADING_MESSAGES: readonly LoadingMessage[] = [
  {
    zh: "肾脏护理包括化验结果，也包括您想怎样生活。",
    en: "Kidney care includes test results and the life you want to live.",
  },
  {
    zh: "告诉护理团队，您最希望治疗能让您继续做什么。",
    en: "Tell your care team what you most want treatment to help you keep doing.",
  },
  {
    zh: "疲倦、睡不好、皮肤痒、浮肿、食欲变化或气喘，都值得告诉护理团队。",
    en: "Tiredness, poor sleep, itching, swelling, appetite changes, and breathlessness are worth mentioning.",
  },
  {
    zh: "一项治疗可能在医学上有帮助，也可能打乱日常生活；两方面都重要。",
    en: "A treatment can help medically and still disrupt daily life. Both matter.",
  },
  {
    zh: "工作、照顾家人、交通、费用、饮食和信仰，都会影响护理计划是否可行。",
    en: "Work, caregiving, transport, cost, food, and faith can affect whether a care plan is workable.",
  },
  {
    zh: "如果一个计划在家里太难执行，请告诉护理团队。",
    en: "If a plan is too hard to manage at home, tell the care team.",
  },
  {
    zh: "询问每个选择会怎样影响您的时间、体力、独立生活和舒适度。",
    en: "Ask what each option could mean for your time, energy, independence, and comfort.",
  },
  {
    zh: "肾功能化验结果不能说明全部情况；症状和日常活动能力也很重要。",
    en: "Kidney test results do not show the whole picture. Symptoms and daily function matter too.",
  },
  {
    zh: "不同的肾脏治疗，对时间、交通、饮食、药物和家中支援的要求不同。",
    en: "Different kidney treatments place different demands on time, travel, diet, medicines, and support at home.",
  },
  {
    zh: "家人可以帮忙记住细节，但讨论仍应以对您重要的事为主。",
    en: "A family member can help remember details, but the conversation should still reflect what matters to you.",
  },
  {
    zh: "可以询问接受治疗、不接受治疗，各自可能会怎样，以及何时会发生。",
    en: "Ask what may happen with treatment, without treatment, and over what period of time.",
  },
  {
    zh: "听到不明白的医学词语时，请护理团队用日常用语解释。",
    en: "When a medical term is unclear, ask your care team to explain it in everyday language.",
  },
  {
    zh: "写下一个您离开诊室前最想得到答案的问题。",
    en: "Write down the one question you most want answered before leaving the appointment.",
  },
  {
    zh: "看肾科时，带上目前服用的药物、维生素和补充剂清单。",
    en: "Bring a current list of medicines, vitamins, and supplements to your kidney appointment.",
  },
  {
    zh: "告诉护理团队，哪些副作用或治疗负担对您最难承受。",
    en: "Tell the care team which side effects or treatment burdens would be hardest for you.",
  },
  {
    zh: "良好的肾脏护理计划应包括：症状改变或用药有困难时，该联系谁。",
    en: "A good kidney care plan includes who to contact if symptoms change or medicines become difficult.",
  },
  {
    zh: "当健康、支援或重点改变时，治疗选择可以重新讨论。",
    en: "Treatment choices can be revisited when your health, support, or priorities change.",
  },
  {
    zh: "不同患者对寿命、独立生活、舒适度和在家时间的重视程度不同。",
    en: "People may value longer life, independence, comfort, and time at home differently.",
  },
  {
    zh: "可提供支援的人员包括肾科护士、营养师、药剂师、社工、心理师和肾病同路人。",
    en: "Support can include a renal nurse, dietitian, pharmacist, social worker, psychologist, or kidney peer.",
  },
  {
    zh: "同意计划前，确认自己明白下一步是什么，以及为什么重要。",
    en: "Before agreeing to a plan, check that you understand the next step and why it matters.",
  },
];

export function questionLoadingMessage(progress: number): LoadingMessage {
  const index = Math.abs(Math.trunc(progress)) % QUESTION_LOADING_MESSAGES.length;
  return QUESTION_LOADING_MESSAGES[index]!;
}
