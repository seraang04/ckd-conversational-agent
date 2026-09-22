import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/guided-answer.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { toggleChoice, moveChoice, formatChoices } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const choices = [
  { en: "Family", zh: "家人" },
  { en: "Independence", zh: "独立" },
  { en: "Not sure", zh: "不确定", exclusive: true },
];

test("multi-select adds and removes answers, keeping exclusive answers separate", () => {
  assert.deepEqual(toggleChoice([0], 1, choices, "multiple"), [0, 1]);
  assert.deepEqual(toggleChoice([0, 1], 0, choices, "multiple"), [1]);
  assert.deepEqual(toggleChoice([0, 1], 2, choices, "multiple"), [2]);
  assert.deepEqual(toggleChoice([2], 1, choices, "multiple"), [1]);
  assert.deepEqual(toggleChoice([2], 2, choices, "multiple"), []);
  assert.deepEqual(toggleChoice([0], 1, choices, "single"), [1]);
});

test("ranking preserves chosen order and supports bounded moves and removal", () => {
  const selected = toggleChoice([1], 0, choices, "ranking");
  assert.deepEqual(selected, [1, 0]);
  assert.deepEqual(moveChoice(selected, 1, -1), [0, 1]);
  assert.deepEqual(moveChoice(selected, 0, 1), [0, 1]);
  assert.deepEqual(moveChoice(selected, 0, -1), selected);
  assert.deepEqual(moveChoice(selected, 1, 1), selected);
  assert.deepEqual(toggleChoice(selected, 1, choices, "ranking"), [0]);
  assert.deepEqual(selected, [1, 0]);
});

test("saved answers distinguish rankings from unordered selections in both languages", () => {
  assert.equal(
    formatChoices([1, 0], choices, "ranking", "en"),
    "Priorities (most important first):\n1. Independence\n2. Family",
  );
  assert.equal(formatChoices([0, 1], choices, "multiple", "zh"), "选择的担忧：\n• 家人\n• 独立");
  assert.equal(formatChoices([0], choices, "single", "en"), "Family");
  assert.equal(formatChoices([], choices, "ranking", "en"), "");
});
