import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const scriptSource = await readFile(new URL("../src/lib/ckd-script.ts", import.meta.url), "utf8");
const scriptJs = ts.transpileModule(scriptSource, { compilerOptions: options }).outputText;
const scriptUrl = `data:text/javascript;base64,${Buffer.from(scriptJs).toString("base64")}`;
const { SCRIPT } = await import(scriptUrl);
const TREATMENT_QUESTIONS = SCRIPT.filter((question) => question.section === "treatment");
const contextSource = await readFile(
  new URL("../src/lib/conversation.ts", import.meta.url),
  "utf8",
);
const contextJs = ts.transpileModule(
  contextSource.replace('"./ckd-script.ts"', JSON.stringify(scriptUrl)),
  { compilerOptions: options },
).outputText;
const { conversationContext, requiredQuestionForEarlyCompletion } = await import(
  `data:text/javascript;base64,${Buffer.from(contextJs).toString("base64")}`
);

const entry = (topic, visibility = "shared") => ({
  topic,
  question: "Question",
  answer: visibility === "shared" ? "Answer" : "",
  speaker: "patient",
  visibility,
});

test("private caregiver answers are hidden from the next-question planner", () => {
  const privateAnswer = "Something I do not want repeated";
  const entry = {
    topic: "caregiver-4",
    question: "Is there anything you would prefer to raise privately?",
    answer: privateAnswer,
    speaker: "caregiver",
    visibility: "private",
  };
  const caregiver = conversationContext("caregiver", [entry]);
  assert.equal(caregiver.history.length, 1);
  assert.equal(JSON.stringify(caregiver).includes(privateAnswer), false);
  assert.equal(
    caregiver.available.some((question) => question.id === "caregiver-4"),
    false,
  );
  assert.equal(conversationContext("patient", [entry]).history.length, 0);
});

test("skipped and deferred questions are not offered again", () => {
  const entries = ["values-1", "worries-1"].map((topic, index) => ({
    topic,
    question: "Question",
    answer: "",
    speaker: "patient",
    visibility: index === 0 ? "skipped" : "deferred",
  }));
  const patient = conversationContext("patient", entries);
  assert.equal(
    patient.available.some((question) => question.id === "values-1"),
    false,
  );
  assert.equal(
    patient.available.some((question) => question.id === "worries-1"),
    false,
  );
  assert.equal(
    patient.available.some((question) => question.id === "treatment-travel"),
    true,
  );
});

test("all five treatment questions are required for patients only", () => {
  const patient = conversationContext("patient", []);
  const caregiver = conversationContext("caregiver", []);
  const treatmentIds = TREATMENT_QUESTIONS.map((question) => question.id);

  assert.equal(treatmentIds.length, 5);
  assert.deepEqual(
    patient.requiredTopics.map((question) => question.id),
    treatmentIds,
  );
  assert.deepEqual(
    patient.available.filter((question) => question.section === "treatment").map((q) => q.id),
    treatmentIds,
  );
  assert.equal(
    caregiver.available.some((question) => question.section === "treatment"),
    false,
  );
  assert.equal(caregiver.requiredTopics.length, 0);
});

test("required treatment coverage prevents early completion past the turn limit", () => {
  const history = Array.from({ length: 12 }, (_, index) =>
    entry(index % 2 === 0 ? "values-1" : "worries-1"),
  );
  const patient = conversationContext("patient", history);

  assert.equal(patient.complete, false);
  assert.equal(patient.requiredTopics.length, 5);
  assert.equal(
    requiredQuestionForEarlyCompletion(patient.requiredTopics, true)?.id,
    "treatment-mobility",
  );
  assert.equal(requiredQuestionForEarlyCompletion(patient.requiredTopics, false), undefined);
});

test("answered, skipped and deferred required topics count as attempted and are not repeated", () => {
  const visibilities = ["shared", "skipped", "deferred", "shared", "deferred"];
  const history = TREATMENT_QUESTIONS.map((question, index) =>
    entry(question.id, visibilities[index]),
  );
  const patient = conversationContext("patient", history);

  assert.equal(patient.requiredTopics.length, 0);
  assert.equal(
    patient.available.some((question) => question.section === "treatment"),
    false,
  );
});

test("treatment questions gather practical factors before naming treatment options", () => {
  const content = TREATMENT_QUESTIONS.flatMap((question) => [
    question.en,
    ...(question.choices ?? []).map((choice) => choice.en),
  ]).join("\n");

  for (const pattern of [
    /home/i,
    /clinic or care centre/i,
    /mobility|transport/i,
    /independent/i,
    /flexib/i,
    /work|studies|activities/i,
    /how long I live/i,
  ]) {
    assert.match(content, pattern);
  }
  assert.doesNotMatch(
    content,
    /\bPD\b|\bHD\b|peritoneal dialysis|haemodialysis|transplant|kidney supportive care|\bKSC\b/i,
  );
});
