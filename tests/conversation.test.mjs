import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const scriptSource = await readFile(new URL("../src/lib/ckd-script.ts", import.meta.url), "utf8");
const scriptJs = ts.transpileModule(scriptSource, { compilerOptions: options }).outputText;
const scriptUrl = `data:text/javascript;base64,${Buffer.from(scriptJs).toString("base64")}`;
const contextSource = await readFile(
  new URL("../src/lib/conversation.ts", import.meta.url),
  "utf8",
);
const contextJs = ts.transpileModule(
  contextSource.replace('"./ckd-script.ts"', JSON.stringify(scriptUrl)),
  { compilerOptions: options },
).outputText;
const { conversationContext } = await import(
  `data:text/javascript;base64,${Buffer.from(contextJs).toString("base64")}`
);

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
    patient.available.some((question) => question.id === "life-2"),
    true,
  );
});
