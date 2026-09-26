import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const sourcePath = new URL("../src/lib/loading-messages.ts", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { QUESTION_LOADING_MESSAGES, questionLoadingMessage } = await import(moduleUrl);

test("loading messages progress through 20 unique bilingual statements before repeating", () => {
  assert.equal(QUESTION_LOADING_MESSAGES.length, 20);
  assert.equal(new Set(QUESTION_LOADING_MESSAGES.map(({ en }) => en)).size, 20);
  assert.equal(new Set(QUESTION_LOADING_MESSAGES.map(({ zh }) => zh)).size, 20);

  for (const [index, message] of QUESTION_LOADING_MESSAGES.entries()) {
    assert.deepEqual(questionLoadingMessage(index), message);
    assert.ok(message.en.trim());
    assert.ok(message.zh.trim());
  }

  assert.deepEqual(questionLoadingMessage(20), QUESTION_LOADING_MESSAGES[0]);
});
