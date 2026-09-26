import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { persona, picked, ranked, said } from "./fixtures/personas.mjs";

const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const toDataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const transpile = async (path, replacements = {}) => {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) {
    source = source.replaceAll(from, JSON.stringify(to));
  }
  return toDataUrl(ts.transpileModule(source, { compilerOptions: options }).outputText);
};

const scriptUrl = await transpile("../src/lib/ckd-script.ts");
const sheetsUrl = await transpile("../src/lib/decision-sheets.ts", {
  '"./ckd-script.ts"': scriptUrl,
});
const dataUrl = await transpile("../src/lib/treatment-options.data.ts");
const kbUrl = await transpile("../src/lib/treatment-options.ts", {
  '"./treatment-options.data.ts"': dataUrl,
});
const { buildPatientProfile, CHOICE_DIMENSIONS } = await import(
  await transpile("../src/lib/patient-profile.ts", {
    '"./ckd-script.ts"': scriptUrl,
    '"./decision-sheets.ts"': sheetsUrl,
    '"./treatment-options.ts"': kbUrl,
  })
);
const { SCRIPT } = await import(scriptUrl);

const summarise = (profile) =>
  Object.fromEntries(profile.all.map((i) => [i.dimension, i.strength]));

test("every mapped label is a real choice, and exclusive choices map to nothing", () => {
  for (const [topic, mappings] of Object.entries(CHOICE_DIMENSIONS)) {
    const question = SCRIPT.find((q) => q.id === topic);
    assert.ok(question?.choices, topic);
    for (const label of Object.keys(mappings)) {
      const choice = question.choices.find((c) => c.en === label);
      assert.ok(choice, `${topic}: "${label}" is not a choice`);
      assert.ok(!choice.exclusive, `${topic}: "${label}" is exclusive`);
    }
  }
});

test("persona: independent, works, and travels often", () => {
  const profile = buildPatientProfile(persona("independent-traveller").entries);

  assert.deepEqual(profile.priorities, ["independence", "travel", "work"]);
  assert.deepEqual(profile.handoffs, []);
  assert.deepEqual(summarise(profile), {
    independence: "high",
    travel: "high",
    work: "medium",
    family: "medium",
    flexibility: "medium",
  });
  const independence = profile.all.find((i) => i.dimension === "independence");
  assert.deepEqual(independence.evidence, [
    { topic: "values-1", label: "Staying independent", rank: 1 },
    {
      topic: "treatment-independence",
      label: "I would like to learn and manage as much day-to-day care as I can",
    },
  ]);
  assert.deepEqual(independence.details, ["manage_myself"]);
  assert.deepEqual(profile.all.find((i) => i.dimension === "flexibility").details, [
    "prefers_flexible",
  ]);
  assert.deepEqual(profile.all.find((i) => i.dimension === "travel").evidence, [
    {
      topic: "treatment-travel",
      label: "Being able to travel or stay away overnight is important to me",
    },
    {
      topic: "treatment-priorities",
      label: "Being able to travel or stay away overnight",
      rank: 1,
    },
  ]);
});

test("persona: uses a walker and relies on their daughter (answered in Chinese)", () => {
  const profile = buildPatientProfile(persona("walker-with-daughter").entries);

  assert.deepEqual(profile.priorities, ["family", "body", "comfort"]);
  assert.deepEqual(profile.handoffs, ["cost"]);
  assert.deepEqual(summarise(profile), {
    family: "high",
    body: "medium",
    comfort: "medium",
    cost: "medium",
  });
  // Evidence uses the English choice label, whatever language was answered in.
  assert.deepEqual(
    profile.all.find((i) => i.dimension === "body").evidence.map((e) => e.label),
    [
      "I use a walking aid, walker or wheelchair",
      "I sometimes need another person's help",
      "How treatment may affect my body",
    ],
  );
});

test("persona: wants a fixed routine and prefers the centre", () => {
  const profile = buildPatientProfile(persona("routine-and-centre").entries);

  assert.deepEqual(profile.priorities, ["flexibility", "time", "home"]);
  assert.deepEqual(profile.handoffs, ["longevity"]);
  const byDimension = Object.fromEntries(profile.all.map((i) => [i.dimension, i]));
  assert.equal(byDimension.flexibility.strength, "high");
  assert.deepEqual(byDimension.flexibility.details, ["prefers_routine"]);
  // Ranked 2nd (medium) and 4th (low): the stronger one is kept, both are evidence.
  assert.equal(byDimension.time.strength, "medium");
  assert.deepEqual(
    byDimension.time.evidence.map((e) => e.rank),
    [2, 4],
  );
  assert.deepEqual(byDimension.home.details, ["prefers_centre", "home_limits"]);
  assert.deepEqual(byDimension.independence.details, ["staff_manage"]);
});

test("persona: answers 'Not sure yet' everywhere", () => {
  const profile = buildPatientProfile(persona("not-sure").entries);
  assert.deepEqual(profile, { priorities: [], handoffs: [], all: [] });
});

test("persona: private sensitive answer and caregiver answers are ignored", () => {
  const profile = buildPatientProfile(persona("private-and-caregiver").entries);
  assert.deepEqual(profile.priorities, ["comfort"]);
  assert.deepEqual(profile.handoffs, []);
  assert.deepEqual(profile.all, [
    {
      dimension: "comfort",
      strength: "high",
      evidence: [{ topic: "values-1", label: "Feeling comfortable", rank: 1 }],
      details: [],
    },
  ]);
});

test("rank strength: 1st high, 2nd–3rd medium, lower low; at most 3 priorities", () => {
  const profile = buildPatientProfile([
    said(
      "values-1",
      ranked(
        "Time with family",
        "Staying independent",
        "Continuing work or activities I enjoy",
        "Feeling comfortable",
      ),
    ),
  ]);
  assert.deepEqual(summarise(profile), {
    family: "high",
    independence: "medium",
    work: "medium",
    comfort: "low",
  });
  assert.deepEqual(profile.priorities, ["family", "independence", "work"]);
});

test("a mix of home and centre, and travel difficulties, map as expected", () => {
  const profile = buildPatientProfile([
    said("treatment-location", picked("A mix of care at home and at a centre could work for me")),
    said(
      "treatment-travel",
      picked(
        "Distance, cost or waiting time can make travel difficult",
        "Frequent trips away from home would be difficult to arrange",
      ),
    ),
  ]);
  assert.deepEqual(profile.priorities, ["home", "time"]);
  assert.deepEqual(profile.all[0].details, ["mix"]);
  assert.equal(profile.all[1].evidence.length, 2);
});
