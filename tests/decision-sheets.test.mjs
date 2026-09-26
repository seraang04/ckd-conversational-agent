import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };

const scriptSource = await readFile(new URL("../src/lib/ckd-script.ts", import.meta.url), "utf8");
const scriptJs = ts.transpileModule(scriptSource, { compilerOptions: options }).outputText;
const scriptUrl = `data:text/javascript;base64,${Buffer.from(scriptJs).toString("base64")}`;

const sheetsSource = await readFile(
  new URL("../src/lib/decision-sheets.ts", import.meta.url),
  "utf8",
);
const sheetsJs = ts.transpileModule(
  sheetsSource.replaceAll('"./ckd-script.ts"', JSON.stringify(scriptUrl)),
  { compilerOptions: options },
).outputText;
const {
  parseGuidedAnswer,
  starsForRank,
  buildPatientSheet,
  buildCaregiverSheet,
  HELP_ROWS,
  LIFE_FIELDS,
} = await import(`data:text/javascript;base64,${Buffer.from(sheetsJs).toString("base64")}`);

const { SCRIPT } = await import(scriptUrl);
const findQuestion = (id) => SCRIPT.find((q) => q.id === id);

const emptyConfirmed = { patientPriorities: [], sharedConcerns: [] };

test("parseGuidedAnswer: ranking in English", () => {
  const question = findQuestion("values-1");
  const answer =
    "Priorities (most important first):\n1. Staying independent\n2. Time with family\n3. Feeling comfortable";
  const { selected, free } = parseGuidedAnswer(answer, question);
  assert.deepEqual(
    selected,
    ["Staying independent", "Time with family", "Feeling comfortable"].map((label) =>
      question.choices.findIndex((c) => c.en === label),
    ),
  );
  assert.equal(free, "");
});

test("parseGuidedAnswer: ranking in Chinese, with trailing free text", () => {
  const question = findQuestion("values-1");
  const answer = "优先事项（最重要的排在前面）：\n1. 保持独立\n2. 和家人相处\n\n还想多陪陪孙子";
  const { selected, free } = parseGuidedAnswer(answer, question);
  assert.deepEqual(selected, [
    question.choices.findIndex((c) => c.zh === "保持独立"),
    question.choices.findIndex((c) => c.zh === "和家人相处"),
  ]);
  assert.equal(free, "还想多陪陪孙子");
});

test("parseGuidedAnswer: multiple in English", () => {
  const question = findQuestion("worries-1");
  const answer = "Selected concerns:\n• Costs\n• Impact on family";
  const { selected, free } = parseGuidedAnswer(answer, question);
  assert.deepEqual(selected, [
    question.choices.findIndex((c) => c.en === "Costs"),
    question.choices.findIndex((c) => c.en === "Impact on family"),
  ]);
  assert.equal(free, "");
});

test("parseGuidedAnswer: multiple in Chinese", () => {
  const question = findQuestion("worries-1");
  const answer = "选择的担忧：\n• 费用\n• 对家人的影响";
  const { selected } = parseGuidedAnswer(answer, question);
  assert.deepEqual(selected, [
    question.choices.findIndex((c) => c.zh === "费用"),
    question.choices.findIndex((c) => c.zh === "对家人的影响"),
  ]);
});

test("parseGuidedAnswer: single choice in English and Chinese", () => {
  const question = findQuestion("treatment-location");
  const en = parseGuidedAnswer("I have no strong preference about location", question);
  assert.deepEqual(en.selected, [
    question.choices.findIndex((c) => c.en === "I have no strong preference about location"),
  ]);
  const zh = parseGuidedAnswer("对地点没有特别偏好", question);
  assert.deepEqual(zh.selected, [question.choices.findIndex((c) => c.zh === "对地点没有特别偏好")]);
});

test("parseGuidedAnswer: plain free text with no matching choices falls back to free", () => {
  const question = findQuestion("values-1");
  const answer = "I'm not sure what matters most right now.";
  const { selected, free } = parseGuidedAnswer(answer, question);
  assert.deepEqual(selected, []);
  assert.equal(free, answer);

  const noChoices = findQuestion("values-3");
  const result = parseGuidedAnswer("I enjoy gardening", noChoices);
  assert.deepEqual(result.selected, []);
  assert.equal(result.free, "I enjoy gardening");
});

test("starsForRank floors at 1 and peaks at 5", () => {
  assert.equal(starsForRank(1), 5);
  assert.equal(starsForRank(2), 4);
  assert.equal(starsForRank(3), 3);
  assert.equal(starsForRank(4), 2);
  assert.equal(starsForRank(5), 1);
  assert.equal(starsForRank(6), 1);
});

test("patient sheet: ranking produces correct stars, preferring care at home gives 5, Longevity is null", () => {
  const entries = [
    {
      speaker: "patient",
      topic: "values-1",
      visibility: "shared",
      answer:
        "Priorities (most important first):\n1. Staying independent\n2. Time with family\n3. Continuing work or activities I enjoy\n4. Feeling comfortable",
    },
    {
      speaker: "patient",
      topic: "treatment-location",
      visibility: "shared",
      answer:
        "Selected concerns:\n• My home has a clean, quiet and private space for care\n• I would prefer to receive most care at home if possible",
    },
  ];
  const sheet = buildPatientSheet("en", entries, emptyConfirmed, "2026-09-24");
  const starsBlock = sheet.blocks.find((b) => b.type === "stars");
  assert.ok(starsBlock);

  const byLabel = Object.fromEntries(starsBlock.rows.map((r) => [r.label, r]));
  assert.equal(byLabel["Independence"].stars, 5);
  assert.equal(byLabel["Time with family"].stars, 4);
  assert.equal(byLabel["Work or activities I enjoy"].stars, 3);
  assert.equal(byLabel["Feeling comfortable"].stars, 2);
  assert.equal(byLabel["Staying at home for treatment"].stars, 5);
  assert.equal(
    byLabel["Staying at home for treatment"].note,
    "I would prefer to receive most care at home if possible",
  );
  assert.equal(byLabel["Longevity"].stars, null);
  assert.equal(byLabel["Flexibility"].stars, null);
  assert.equal(byLabel["Minimising treatment burden"].stars, null);
});

test("the patient's own private answer never appears on either sheet", () => {
  const privatePatient = "Something the patient said only in private about transplant fears";
  const entries = [
    { speaker: "patient", topic: "sensitive-1", visibility: "private", answer: privatePatient },
  ];
  const patientSheet = buildPatientSheet("en", entries, emptyConfirmed, "2026-09-24");
  const caregiverSheet = buildCaregiverSheet("en", entries, "2026-09-24");

  assert.equal(JSON.stringify(patientSheet).includes(privatePatient), false);
  assert.equal(JSON.stringify(caregiverSheet).includes(privatePatient), false);
});

test("the caregiver's private question for the coordinator is printed only on her own sheet", () => {
  const privateCaregiver = "Something the caregiver only wants the coordinator to know";
  const entries = [
    { speaker: "caregiver", topic: "caregiver-4", visibility: "private", answer: privateCaregiver },
  ];
  const patientSheet = buildPatientSheet("en", entries, emptyConfirmed, "2026-09-24");
  const caregiverSheet = buildCaregiverSheet("en", entries, "2026-09-24");

  assert.equal(JSON.stringify(patientSheet).includes(privateCaregiver), false);
  const questionsBlock = caregiverSheet.blocks.find(
    (b) => b.type === "bullets" && b.items.includes(privateCaregiver),
  );
  assert.ok(questionsBlock);
});

test("caregiver text never appears on the patient sheet, and patient text never appears on the caregiver sheet", () => {
  const patientText = "My daughter helps me get dressed every morning";
  const caregiverText = "I drive him to every appointment and it's exhausting";
  const entries = [
    { speaker: "patient", topic: "life-3", visibility: "shared", answer: patientText },
    { speaker: "caregiver", topic: "caregiver-2", visibility: "shared", answer: caregiverText },
  ];
  const patientSheet = buildPatientSheet("en", entries, emptyConfirmed, "2026-09-24");
  const caregiverSheet = buildCaregiverSheet("en", entries, "2026-09-24");

  assert.equal(JSON.stringify(patientSheet).includes(caregiverText), false);
  assert.equal(JSON.stringify(patientSheet).includes(patientText), true);
  assert.equal(JSON.stringify(caregiverSheet).includes(patientText), false);
  assert.equal(JSON.stringify(caregiverSheet).includes(caregiverText), true);
});

test("all treatment option checkboxes on the patient sheet are unchecked", () => {
  const sheet = buildPatientSheet("en", [], emptyConfirmed, "2026-09-24");
  const checkboxBlocks = sheet.blocks.filter((b) => b.type === "checkboxes");
  assert.ok(checkboxBlocks.length > 0);
  for (const block of checkboxBlocks) {
    for (const item of block.items) {
      assert.equal(item.checked, false);
    }
  }
});

test("caregiver sheet: private-word checkbox is checked when caregiver-4 is private with an answer", () => {
  const answer = "I want to talk about respite care without my husband hearing";
  const entries = [{ speaker: "caregiver", topic: "caregiver-4", visibility: "private", answer }];
  const sheet = buildCaregiverSheet("en", entries, "2026-09-24");
  const checkboxBlocks = sheet.blocks.filter((b) => b.type === "checkboxes");
  const privateWordBlock = checkboxBlocks.find((b) =>
    b.items.some((i) => i.label.includes("private word")),
  );
  assert.ok(privateWordBlock);
  assert.equal(privateWordBlock.items[0].checked, true);
  // Her own answer is printed under "Questions for the care team" instead of
  // a generic "not printed" note, since this is her own copy of the sheet.
  assert.equal(sheet.blocks.some((b) => b.type === "note"), false);
  const questionsBlock = sheet.blocks.find((b) => b.type === "bullets" && b.items.includes(answer));
  assert.ok(questionsBlock);
});

test("caregiver sheet: private-word checkbox stays unchecked when caregiver-4 is absent or empty", () => {
  const sheetNoEntry = buildCaregiverSheet("en", [], "2026-09-24");
  const noEntryBlock = sheetNoEntry.blocks
    .filter((b) => b.type === "checkboxes")
    .find((b) => b.items.some((i) => i.label.includes("private word")));
  assert.equal(noEntryBlock.items[0].checked, false);

  const sheetEmptyPrivate = buildCaregiverSheet(
    "en",
    [{ speaker: "caregiver", topic: "caregiver-4", visibility: "private", answer: "   " }],
    "2026-09-24",
  );
  const emptyBlock = sheetEmptyPrivate.blocks
    .filter((b) => b.type === "checkboxes")
    .find((b) => b.items.some((i) => i.label.includes("private word")));
  assert.equal(emptyBlock.items[0].checked, false);
});

test("caregiver sheet: private-word checkbox is checked when caregiver-4 is deferred, with a note and nothing printed", () => {
  const sheet = buildCaregiverSheet(
    "en",
    [{ speaker: "caregiver", topic: "caregiver-4", visibility: "deferred", answer: "" }],
    "2026-09-24",
  );
  const block = sheet.blocks
    .filter((b) => b.type === "checkboxes")
    .find((b) => b.items.some((i) => i.label.includes("private word")));
  assert.equal(block.items[0].checked, true);
  assert.ok(sheet.blocks.some((b) => b.type === "note"));
  const sectionIndex = sheet.blocks.findIndex(
    (b) => b.type === "section" && b.heading === "Questions for the care team",
  );
  const questionsBlock = sheet.blocks[sectionIndex + 1];
  assert.equal(questionsBlock.type, "bullets");
  assert.equal(questionsBlock.items.length, 0);
  assert.equal(questionsBlock.blankLines, 3);
});

test("caregiver sheet: 'What I can help with' grid defaults to all-blank when no capacity is inferred", () => {
  const sheet = buildCaregiverSheet("en", [], "2026-09-24");
  const grid = sheet.blocks.find((b) => b.type === "grid");
  assert.ok(grid);
  assert.equal(grid.rows.length, HELP_ROWS.length);
  assert.deepEqual(
    grid.selected,
    HELP_ROWS.map(() => null),
  );
});

test("caregiver sheet: inferred capacity fills the matching column, unmentioned rows stay blank", () => {
  const sheet = buildCaregiverSheet("en", [], "2026-09-24", {
    transport: "yes",
    daily_help: "not_sure",
    home_treatment: "not_able",
  });
  const grid = sheet.blocks.find((b) => b.type === "grid");
  const columns = ["Yes", "Sometimes", "Not able", "Not sure"];
  const byId = Object.fromEntries(HELP_ROWS.map((row, index) => [row.id, index]));
  assert.equal(grid.selected[byId.transport], columns.indexOf("Yes"));
  assert.equal(grid.selected[byId.daily_help], columns.indexOf("Not sure"));
  assert.equal(grid.selected[byId.home_treatment], columns.indexOf("Not able"));
  assert.equal(grid.selected[byId.emotional_support], null);
  assert.equal(grid.selected[byId.paperwork], null);
});

test("patient sheet: 'The life I want to maintain' fields default to blank when no life details are inferred", () => {
  const sheet = buildPatientSheet("en", [], emptyConfirmed, "2026-09-24");
  const fields = sheet.blocks.find((b) => b.type === "fields" && b.rows.some((r) => r.label === "Work"));
  assert.ok(fields);
  for (const field of LIFE_FIELDS) {
    const row = fields.rows.find((r) => r.label === field.en);
    assert.equal(row.value, "");
  }
});

test("patient sheet: inferred life details fill the matching field, unmentioned fields stay blank", () => {
  const sheet = buildPatientSheet("en", [], emptyConfirmed, "2026-09-24", {
    work: "Still working part-time as an accountant",
    independence: "Wants to keep driving herself",
  });
  const fields = sheet.blocks.find((b) => b.type === "fields" && b.rows.some((r) => r.label === "Work"));
  const byLabel = Object.fromEntries(fields.rows.map((r) => [r.label, r.value]));
  assert.equal(byLabel["Work"], "Still working part-time as an accountant");
  assert.equal(byLabel["Independence"], "Wants to keep driving herself");
  assert.equal(byLabel["Family responsibilities"], "");
  assert.equal(byLabel["Travel"], "");
});

test("patient sheet: Hobbies still comes from values-3, unaffected by life details", () => {
  const entries = [
    { speaker: "patient", topic: "values-3", visibility: "shared", answer: "Gardening on weekends" },
  ];
  const sheet = buildPatientSheet("en", entries, emptyConfirmed, "2026-09-24", { work: "Retired" });
  const fields = sheet.blocks.find((b) => b.type === "fields" && b.rows.some((r) => r.label === "Hobbies"));
  const byLabel = Object.fromEntries(fields.rows.map((r) => [r.label, r.value]));
  assert.equal(byLabel["Hobbies"], "Gardening on weekends");
  assert.equal(byLabel["Work"], "Retired");
});

test("patient sheet: 'What I still need to understand' lists the patient's shared options questions", () => {
  const entries = [
    {
      speaker: "patient",
      topic: "options-question",
      visibility: "shared",
      answer: "Can my daughter learn PD?",
    },
    {
      speaker: "patient",
      topic: "options-question",
      visibility: "shared",
      answer: "How long is the wait for a kidney?",
    },
    {
      speaker: "patient",
      topic: "options-question",
      visibility: "shared",
      answer: "Can my daughter learn PD?",
    },
    {
      speaker: "patient",
      topic: "options-question",
      visibility: "private",
      answer: "Private question",
    },
    { speaker: "patient", topic: "options-question", visibility: "skipped", answer: "" },
    {
      speaker: "caregiver",
      topic: "options-question",
      visibility: "shared",
      answer: "Caregiver question",
    },
  ];
  const fieldValue = (sheet, label) =>
    sheet.blocks
      .filter((b) => b.type === "fields")
      .flatMap((b) => b.rows)
      .find((r) => r.label === label)?.value;

  const en = buildPatientSheet("en", entries, emptyConfirmed, "2026-09-24");
  assert.equal(
    fieldValue(en, "What I still need to understand"),
    "Can my daughter learn PD?; How long is the wait for a kidney?",
  );
  assert.equal(fieldValue(en, "My current preference"), "");
  const zh = buildPatientSheet("zh", entries, emptyConfirmed, "2026-09-24");
  assert.equal(
    fieldValue(zh, "我还需要了解的事"),
    "Can my daughter learn PD?；How long is the wait for a kidney?",
  );
  assert.equal(
    fieldValue(
      buildPatientSheet("en", [], emptyConfirmed, "2026-09-24"),
      "What I still need to understand",
    ),
    "",
  );
});

test("patient sheet: the options checkboxes are never ticked, even after the options step", () => {
  const entries = [
    {
      speaker: "patient",
      topic: "options-shown",
      visibility: "shared",
      answer: '{"kbVersion":"v1.0","source":"template","priorities":["travel","home"]}',
    },
    {
      speaker: "patient",
      topic: "options-question",
      visibility: "shared",
      answer: "Is PD painful?",
    },
  ];
  const sheet = buildPatientSheet("en", entries, emptyConfirmed, "2026-09-24");
  const checkboxes = sheet.blocks.filter((b) => b.type === "checkboxes");
  assert.equal(checkboxes.length, 1);
  assert.ok(checkboxes[0].items.every((item) => item.checked === false));
});

test("the options-shown record never appears on either sheet", () => {
  const record = '{"kbVersion":"v1.0","source":"ai","priorities":["travel"]}';
  const entries = [
    { speaker: "patient", topic: "options-shown", visibility: "shared", answer: record },
  ];
  for (const language of ["en", "zh"]) {
    const patientSheet = buildPatientSheet(language, entries, emptyConfirmed, "2026-09-24");
    const caregiverSheet = buildCaregiverSheet(language, entries, "2026-09-24");
    for (const sheet of [patientSheet, caregiverSheet]) {
      const text = JSON.stringify(sheet);
      assert.equal(text.includes("kbVersion"), false);
      assert.equal(text.includes("Options step"), false);
    }
  }
});
