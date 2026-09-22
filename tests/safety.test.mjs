import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/safety.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { assessSafety } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);

test("explicit English, Chinese, and mixed-language danger interrupts even without AI", async () => {
  for (const answer of [
    "I want to die",
    "我不想活了",
    "我想自殺",
    "I feel 很累，想死",
    "My father said: I want to die",
  ]) {
    assert.deepEqual(
      await assessSafety(answer, () => {
        throw new Error("offline");
      }),
      { status: "risk" },
    );
  }
});

test("indirect risk is screened by the classifier", async () => {
  assert.deepEqual(
    await assessSafety("Everyone would be better off without me", async () => ({
      distressed: true,
    })),
    { status: "risk" },
  );
});

test("ordinary worry only proceeds after explicit classifier clearance", async () => {
  assert.deepEqual(
    await assessSafety("I worry about transport to my appointment", async () => ({
      distressed: false,
    })),
    { status: "clear" },
  );
});

test("missing, malformed, failed and timed-out checks never clear the answer", async () => {
  for (const classify of [
    async () => null,
    async () => ({}),
    async () => ({ distressed: "false" }),
    async () => {
      throw new Error("offline");
    },
    () => new Promise(() => {}),
  ]) {
    assert.deepEqual(await assessSafety("I feel tired", classify, 5), { status: "unavailable" });
  }
});

test("conservative fast path also flags negated explicit phrases for human review", async () => {
  assert.deepEqual(await assessSafety("I am not suicidal", async () => ({ distressed: false })), {
    status: "risk",
  });
});
