import { OPTIONS_QUESTION_TOPIC, SCRIPT } from "./ckd-script.ts";
import type { ScriptQuestion } from "./ckd-script.ts";

export type Language = "en" | "zh";

export type SheetEntry = {
  speaker: string;
  topic: string;
  answer: string;
  visibility: string;
};

export type ConfirmedSummary = {
  patientPriorities: string[];
  sharedConcerns: string[];
};

/** One row of the patient's "The life I want to maintain" fields, besides Hobbies. */
export const LIFE_FIELDS = [
  { id: "work", zh: "工作", en: "Work" },
  { id: "family", zh: "家庭责任", en: "Family responsibilities" },
  { id: "travel", zh: "旅行", en: "Travel" },
  { id: "independence", zh: "独立自主", en: "Independence" },
] as const;

export type LifeDetails = Partial<Record<(typeof LIFE_FIELDS)[number]["id"], string>>;

export type SheetBlock =
  | { type: "section"; heading: string }
  | { type: "bullets"; items: string[]; blankLines: number }
  | { type: "fields"; rows: { label: string; value: string }[] }
  | {
      type: "stars";
      columns: [string, string];
      rows: { label: string; stars: number | null; note: string }[];
      caption: string;
    }
  | { type: "checkboxes"; items: { label: string; checked: boolean }[] }
  | { type: "grid"; columns: string[]; rows: string[]; selected: (number | null)[] }
  | { type: "lines"; count: number }
  | { type: "note"; text: string };

/** One row of the caregiver's "What I can help with" grid. */
export const HELP_ROWS = [
  { id: "transport", zh: "陪同前往复诊", en: "Getting to appointments" },
  { id: "daily_help", zh: "日常居家帮助", en: "Day-to-day help at home" },
  {
    id: "home_treatment",
    zh: "协助居家治疗（例如居家透析）",
    en: "Helping with treatment at home (e.g. home dialysis)",
  },
  { id: "emotional_support", zh: "情感支持", en: "Emotional support" },
  { id: "paperwork", zh: "文书与财务事务", en: "Paperwork and finances" },
] as const;

export const HELP_ANSWERS = ["yes", "sometimes", "not_able", "not_sure"] as const;
export type HelpAnswer = (typeof HELP_ANSWERS)[number];
export type HelpCapacity = Partial<Record<(typeof HELP_ROWS)[number]["id"], HelpAnswer>>;

export type Sheet = {
  kind: "patient" | "caregiver";
  title: string;
  subtitle: string;
  identity: { label: string; value: string }[];
  blocks: SheetBlock[];
  footer: string;
};

function t(zh: string, en: string, language: Language) {
  return language === "zh" ? zh : en;
}

function findQuestion(topic: string): ScriptQuestion | undefined {
  return SCRIPT.find((q) => q.id === topic);
}

function findEntry(entries: SheetEntry[], speaker: string, topic: string): SheetEntry | undefined {
  return entries.find((e) => e.speaker === speaker && e.topic === topic);
}

function sharedAnswer(entries: SheetEntry[], speaker: string, topic: string): string {
  const entry = findEntry(entries, speaker, topic);
  if (!entry || entry.visibility !== "shared") return "";
  return entry.answer.trim();
}

/**
 * Splits a saved guided answer back into the choice indices it represents
 * (matching either language's labels) and any free text that followed.
 */
export function parseGuidedAnswer(
  answer: string,
  question: ScriptQuestion | undefined,
): { selected: number[]; free: string } {
  const trimmed = answer.trim();
  if (!trimmed) return { selected: [], free: "" };
  const choices = question?.choices;
  if (!choices || !choices.length) return { selected: [], free: trimmed };

  const paragraphs = trimmed.split(/\n\s*\n/);
  const first = paragraphs[0]!;
  const rest = paragraphs.slice(1).join("\n\n").trim();

  const lines = first.split("\n");
  const listLines = lines.filter((line) => /^(\d+\.|•)\s+/.test(line.trim()));

  const labelToIndex = new Map<string, number>();
  choices.forEach((choice, index) => {
    labelToIndex.set(choice.en.trim(), index);
    labelToIndex.set(choice.zh.trim(), index);
  });

  if (listLines.length) {
    const selected: number[] = [];
    for (const line of listLines) {
      const label = line.trim().replace(/^(\d+\.|•)\s+/, "").trim();
      const index = labelToIndex.get(label);
      if (index !== undefined) selected.push(index);
    }
    if (selected.length) return { selected, free: rest };
  }

  // Single-choice answers are just the label with no heading/list markup.
  if (lines.length === 1) {
    const index = labelToIndex.get(lines[0]!.trim());
    if (index !== undefined) return { selected: [index], free: rest };
  }

  return { selected: [], free: trimmed };
}

/** Stars shown for a given rank position (1st = 5 stars, down to a floor of 1). */
export function starsForRank(rank: number): number {
  return Math.max(1, 6 - rank);
}

function rankedLabelIndex(selected: number[], choices: { en: string }[], targetEn: string): number {
  const choiceIndex = choices.findIndex((c) => c.en === targetEn);
  if (choiceIndex === -1) return -1;
  return selected.indexOf(choiceIndex);
}

function rankNote(rank: number, language: Language): string {
  return t(`排第 ${rank}`, `Ranked #${rank}`, language);
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

/**
 * The patient's priorities straight from their shared values-1 answer, for a
 * report made before there is a confirmed summary to draw on.
 */
export function prioritiesFromEntries(entries: SheetEntry[], language: Language): string[] {
  const entry = findEntry(entries, "patient", "values-1");
  if (!entry || entry.visibility !== "shared") return [];
  const question = findQuestion("values-1");
  const parsed = parseGuidedAnswer(entry.answer, question);
  const labels = parsed.selected
    .map((index) => question?.choices?.[index])
    .filter((choice): choice is NonNullable<typeof choice> => !!choice)
    .filter((choice) => choice.en !== "Something else")
    .map((choice) => choice[language]);
  return dedupe([...labels, ...(parsed.free ? [parsed.free] : [])]);
}

export function formatPreparedOn(date: Date, language: Language): string {
  return date.toLocaleDateString(language === "en" ? "en-SG" : "zh-CN", {
    day: "numeric",
    month: language === "en" ? "short" : "long",
    year: "numeric",
  });
}

export function buildPatientSheet(
  language: Language,
  entries: SheetEntry[],
  confirmed: ConfirmedSummary,
  preparedOn: string,
  lifeDetails: LifeDetails = {},
): Sheet {
  const tt = (zh: string, en: string) => t(zh, en, language);
  const blocks: SheetBlock[] = [];

  blocks.push({ type: "section", heading: tt("对我来说最重要的事", "What matters most to me") });
  const priorities = dedupe(confirmed.patientPriorities);
  blocks.push({
    type: "bullets",
    items: priorities,
    blankLines: priorities.length ? 0 : 2,
  });

  blocks.push({ type: "section", heading: tt("我想维持的生活", "The life I want to maintain") });
  blocks.push({
    type: "fields",
    rows: [
      ...LIFE_FIELDS.map((field) => ({
        label: tt(field.zh, field.en),
        value: (lifeDetails[field.id] ?? "").trim(),
      })),
      { label: tt("爱好", "Hobbies"), value: sharedAnswer(entries, "patient", "values-3") },
    ],
  });

  blocks.push({ type: "section", heading: tt("我的治疗优先事项", "My treatment priorities") });
  const values1 = findQuestion("values-1");
  const values1Entry = findEntry(entries, "patient", "values-1");
  const values1Parsed =
    values1Entry && values1Entry.visibility === "shared"
      ? parseGuidedAnswer(values1Entry.answer, values1)
      : { selected: [], free: "" };
  const values1Choices = values1?.choices ?? [];

  const location = findQuestion("treatment-location");
  const locationEntry = findEntry(entries, "patient", "treatment-location");
  const locationParsed =
    locationEntry && locationEntry.visibility === "shared"
      ? parseGuidedAnswer(locationEntry.answer, location)
      : { selected: [], free: "" };
  // treatment-location is multiple choice: the first of these found among the
  // selected choices sets the row; any other choice leaves it blank.
  const homeStarsByChoice: Record<string, number> = {
    "I would prefer to receive most care at home if possible": 5,
    "A mix of care at home and at a centre could work for me": 3,
    "I would feel safer at a clinic or care centre with staff nearby": 1,
  };
  const homeChoice = locationParsed.selected
    .map((index) => location?.choices?.[index])
    .find((choice) => choice && choice.en in homeStarsByChoice);
  const homeStars = homeChoice ? homeStarsByChoice[homeChoice.en]! : null;
  const homeNote = homeChoice ? homeChoice[language] : "";

  // One row per option the patient was offered in the conversation, worded
  // the same way; "Something else" is only added below when it was ranked.
  const starsRows: { label: string; stars: number | null; note: string }[] = [
    ...values1Choices
      .filter((choice) => choice.en !== "Something else")
      .map((choice) => {
        const rank = rankedLabelIndex(values1Parsed.selected, values1Choices, choice.en);
        return {
          label: choice[language],
          stars: rank === -1 ? null : starsForRank(rank + 1),
          note: rank === -1 ? "" : rankNote(rank + 1, language),
        };
      }),
    { label: tt("在家接受治疗", "Staying at home for treatment"), stars: homeStars, note: homeNote },
  ];

  const somethingElseRank = rankedLabelIndex(values1Parsed.selected, values1Choices, "Something else");
  if (somethingElseRank !== -1) {
    starsRows.push({
      label: tt("其他", "Something else"),
      stars: starsForRank(somethingElseRank + 1),
      note: rankNote(somethingElseRank + 1, language),
    });
  }

  blocks.push({
    type: "stars",
    columns: [tt("优先事项", "Priority"), tt("重要程度", "Importance")],
    rows: starsRows,
    caption: tt(
      "星级来自对话内容；空白代表对话中未涉及，可手动填写。",
      "Stars reflect what came up in the conversation; empty rows weren't covered and can be shaded in by hand.",
    ),
  });

  blocks.push({ type: "section", heading: tt("我的支持系统", "My support") });
  blocks.push({
    type: "fields",
    rows: [
      { label: tt("主要照顾者", "Main caregiver"), value: sharedAnswer(entries, "patient", "life-3") },
      { label: tt("其他支持", "Other support"), value: "" },
      { label: tt("交通", "Transport"), value: sharedAnswer(entries, "patient", "life-2") },
      { label: tt("居家考量", "Home considerations"), value: "" },
    ],
  });

  blocks.push({ type: "section", heading: tt("我的问题/担忧", "My questions/concerns") });
  const worries1 = findQuestion("worries-1");
  const worries1Entry = findEntry(entries, "patient", "worries-1");
  const worries1Parsed =
    worries1Entry && worries1Entry.visibility === "shared"
      ? parseGuidedAnswer(worries1Entry.answer, worries1)
      : { selected: [], free: "" };
  const worries1Labels = worries1Parsed.selected
    .map((index) => worries1?.choices?.[index])
    .filter((choice): choice is NonNullable<typeof choice> => !!choice && !choice.exclusive)
    .filter((choice) => choice.en !== "Something else")
    .map((choice) => choice[language]);

  // Sourced only from the patient's own worries-1 answer, never the
  // AI-synthesised "shared concerns" — that category tends to restate the
  // same worry in different words, which printed as visible duplicates.
  const concernItems: string[] = dedupe([
    ...worries1Labels,
    ...(worries1Parsed.free ? [worries1Parsed.free] : []),
  ]);

  const sensitiveEntry = findEntry(entries, "patient", "sensitive-1");
  if (sensitiveEntry && (sensitiveEntry.visibility === "deferred" || sensitiveEntry.visibility === "private")) {
    concernItems.push(
      tt(
        "在门诊时讨论：肾移植或家人捐肾",
        "To discuss at my appointment: kidney transplant or family donation",
      ),
    );
  }

  blocks.push({
    type: "bullets",
    items: concernItems,
    blankLines: concernItems.length ? 0 : 2,
  });

  blocks.push({
    type: "section",
    heading: tt("已与医疗团队讨论的选项", "Options discussed with my healthcare team"),
  });
  blocks.push({
    type: "checkboxes",
    items: [
      { label: tt("肾移植", "Transplant"), checked: false },
      { label: tt("腹膜透析 (PD)", "Peritoneal dialysis (PD)"), checked: false },
      { label: tt("血液透析 (HD)", "Haemodialysis (HD)"), checked: false },
      { label: tt("居家血液透析", "Home haemodialysis"), checked: false },
      {
        label: tt(
          "保守肾脏管理／其他适合的治疗方案",
          "Conservative kidney management / other appropriate pathway",
        ),
        checked: false,
      },
    ],
  });

  // The options checkboxes above stay blank: the chatbot is not the healthcare
  // team. Questions the patient asked during the options step go here instead.
  const stillToUnderstand = dedupe(
    entries
      .filter(
        (e) =>
          e.speaker === "patient" && e.topic === OPTIONS_QUESTION_TOPIC && e.visibility === "shared",
      )
      .map((e) => e.answer),
  );
  blocks.push({
    type: "fields",
    rows: [
      { label: tt("我目前的倾向", "My current preference"), value: "" },
      {
        label: tt("我还需要了解的事", "What I still need to understand"),
        value: stillToUnderstand.join(language === "en" ? "; " : "；"),
      },
    ],
  });

  return {
    kind: "patient",
    title: tt("我的肾脏治疗决定", "MY KIDNEY TREATMENT DECISION"),
    subtitle: tt("我作为患者的记录", "My notes as a patient"),
    identity: [
      { label: tt("姓名", "Name"), value: "" },
      { label: tt("日期", "Date"), value: preparedOn },
    ],
    blocks,
    footer: tt(
      "这不是最终决定，而是与我的医疗团队及在意我的人展开对话的起点。",
      "This is not a final decision. It is a starting point for a conversation with my healthcare team and the people who matter to me.",
    ),
  };
}

export function buildCaregiverSheet(
  language: Language,
  entries: SheetEntry[],
  preparedOn: string,
  helpCapacity: HelpCapacity = {},
): Sheet {
  const tt = (zh: string, en: string) => t(zh, en, language);
  const blocks: SheetBlock[] = [];

  const howIHelp = sharedAnswer(entries, "caregiver", "caregiver-2");
  blocks.push({ type: "section", heading: tt("我目前提供的帮助", "How I help now") });
  blocks.push({
    type: "bullets",
    items: howIHelp ? [howIHelp] : [],
    blankLines: howIHelp ? 0 : 2,
  });

  blocks.push({ type: "section", heading: tt("我能帮忙的事", "What I can help with") });
  blocks.push({
    type: "grid",
    columns: [tt("可以", "Yes"), tt("有时可以", "Sometimes"), tt("无法", "Not able"), tt("不确定", "Not sure")],
    rows: HELP_ROWS.map((row) => tt(row.zh, row.en)),
    selected: HELP_ROWS.map((row) => {
      const answer = helpCapacity[row.id];
      const index = answer ? HELP_ANSWERS.indexOf(answer) : -1;
      return index === -1 ? null : index;
    }),
  });

  blocks.push({
    type: "section",
    heading: tt("我自己的责任与限制", "My own commitments and limits"),
  });
  blocks.push({
    type: "fields",
    rows: [
      { label: tt("工作", "Work"), value: "" },
      { label: tt("我照顾的其他人", "Others I care for"), value: "" },
      { label: tt("我自己的健康", "My own health"), value: "" },
      { label: tt("我每周能付出的时间", "Time I can give each week"), value: "" },
    ],
  });

  blocks.push({ type: "section", heading: tt("让我担心的事", "What's weighing on me") });
  const caregiver3 = findQuestion("caregiver-3");
  const caregiver3Entry = findEntry(entries, "caregiver", "caregiver-3");
  const caregiver3Parsed =
    caregiver3Entry && caregiver3Entry.visibility === "shared"
      ? parseGuidedAnswer(caregiver3Entry.answer, caregiver3)
      : { selected: [], free: "" };
  const caregiver3Labels = caregiver3Parsed.selected
    .map((index) => caregiver3?.choices?.[index])
    .filter((choice): choice is NonNullable<typeof choice> => !!choice)
    .map((choice) => choice[language]);
  const weighingItems = [...caregiver3Labels, ...(caregiver3Parsed.free ? [caregiver3Parsed.free] : [])];
  blocks.push({
    type: "bullets",
    items: weighingItems,
    blankLines: weighingItems.length ? 0 : 2,
  });

  blocks.push({
    type: "section",
    heading: tt("我希望获得的支持", "Support I'd like for myself"),
  });
  blocks.push({
    type: "checkboxes",
    items: [
      { label: tt("照顾者培训", "Caregiver training"), checked: false },
      { label: tt("喘息服务——暂时休息一下", "Respite – a break from caring"), checked: false },
      { label: tt("财务咨询或援助", "Financial advice or assistance"), checked: false },
      {
        label: tt("找人倾诉（辅导或支持小组）", "Someone to talk to (counselling or a support group)"),
        checked: false,
      },
      { label: tt("有关治疗方案的信息", "Information about the treatment options"), checked: false },
    ],
  });

  const caregiver4Entry = findEntry(entries, "caregiver", "caregiver-4");
  const privateAnswer =
    caregiver4Entry && caregiver4Entry.visibility === "private" ? caregiver4Entry.answer.trim() : "";
  const privateDeferred = caregiver4Entry?.visibility === "deferred";
  const privateWordChecked = !!(privateAnswer || privateDeferred);
  blocks.push({
    type: "checkboxes",
    items: [
      {
        label: tt(
          "我想私下与肾科协调员谈谈",
          "I'd like a private word with the renal coordinator",
        ),
        checked: privateWordChecked,
      },
    ],
  });
  // This is her own copy, so what she shared privately is safe to print here
  // — it's only ever kept off the patient's sheet. If she deferred it instead
  // of writing anything down, there's nothing to print, just the checkbox.
  if (privateDeferred && !privateAnswer) {
    blocks.push({
      type: "note",
      text: tt(
        "这件事会留到看诊时再和协调员私下谈。",
        "This will be raised privately with the coordinator at the appointment.",
      ),
    });
  }

  blocks.push({ type: "section", heading: tt("给医疗团队的问题", "Questions for the care team") });
  blocks.push({
    type: "bullets",
    items: privateAnswer ? [privateAnswer] : [],
    blankLines: privateAnswer ? 0 : 3,
  });
  if (privateAnswer) blocks.push({ type: "lines", count: 2 });

  return {
    kind: "caregiver",
    title: tt("一起照顾", "CARING TOGETHER"),
    subtitle: tt("我作为照顾者的记录", "My notes as a caregiver"),
    identity: [
      { label: tt("我的姓名", "My name"), value: "" },
      { label: tt("照顾的对象", "Caring for"), value: "" },
      { label: tt("关系", "Relationship"), value: "" },
      { label: tt("日期", "Date"), value: preparedOn },
    ],
    blocks,
    footer: tt(
      "照顾好自己也很重要。这不是决定或承诺，而是帮助医疗团队了解哪些支持是可行的，以及您可能需要哪些支持。",
      "Looking after yourself matters too. This is not a decision or a commitment. It helps the care team understand what support is realistic, and what support you may need.",
    ),
  };
}
