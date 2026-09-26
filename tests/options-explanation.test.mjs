import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

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
const dataUrl = await transpile("../src/lib/treatment-options.data.ts");
const kbUrl = await transpile("../src/lib/treatment-options.ts", {
  '"./treatment-options.data.ts"': dataUrl,
});
const validationUrl = await transpile("../src/lib/option-validation.ts", {
  '"./treatment-options.ts"': kbUrl,
});
const { OPTION_ORDER, statementsFor } = await import(kbUrl);
const { validateExplanation, findForbiddenPhrases } = await import(validationUrl);
const { explainOptions, buildTemplateExplanation, buildOptionsSchema, buildOptionsPrompt } =
  await import(
    await transpile("../src/lib/options-explanation.ts", {
      '"./ckd-script.ts"': scriptUrl,
      '"./option-validation.ts"': validationUrl,
      '"./treatment-options.ts"': kbUrl,
    })
  );

const request = {
  priorities: [
    {
      dimension: "travel",
      evidence: [
        {
          topic: "treatment-priorities",
          label: "Being able to travel or stay away overnight",
          rank: 1,
        },
      ],
    },
    {
      dimension: "home",
      evidence: [
        {
          topic: "treatment-location",
          label: "I would prefer to receive most care at home if possible",
        },
      ],
    },
  ],
  allowGated: false,
  language: "en",
};

/** A well-formed model answer that keeps every allowed statement. */
const validAiResult = () => ({
  dimensions: request.priorities.map(({ dimension }) => ({
    dimension,
    bridgeZh: "您说过能去旅行或在外过夜很重要。",
    bridgeEn: "You said being able to travel or stay away overnight matters to you.",
    options: OPTION_ORDER.map((option) => ({
      option,
      statementIds: statementsFor(option, dimension, { allowGated: false }).map((s) => s.id),
      linkZh: option === "pd" ? "这是关于出门在外的情况。" : "",
      linkEn: option === "pd" ? "This is about being away from home." : "",
    })),
  })),
});

/** Runs explainOptions with a mocked AI and a captured log. */
async function run(aiResult, overrides = {}) {
  const calls = [];
  const logs = [];
  const askAi =
    overrides.askAi !== undefined
      ? overrides.askAi
      : async (input, schema) => {
          calls.push({ input, schema });
          return typeof aiResult === "function" ? aiResult() : aiResult;
        };
  const result = await explainOptions(overrides.request ?? request, askAi, {
    timeoutMs: overrides.timeoutMs ?? 1000,
    log: (...args) => logs.push(args),
  });
  return { result, calls, logs };
}
const template = buildTemplateExplanation(["travel", "home"], { allowGated: false });

test("a valid AI result is used", async () => {
  const { result, calls, logs } = await run(validAiResult());
  assert.equal(result.source, "ai");
  assert.equal(calls.length, 1);
  assert.deepEqual(logs, []);
  const travel = result.explanation.dimensions[0];
  assert.equal(travel.bridge.en, validAiResult().dimensions[0].bridgeEn);
  assert.deepEqual(travel.options[0].link, {
    en: "This is about being away from home.",
    zh: "这是关于出门在外的情况。",
  });
  assert.equal("link" in travel.options[1], false, "empty links are dropped");
});

test("a forbidden phrase falls back to the template", async () => {
  const ai = validAiResult();
  ai.dimensions[1].options[2].linkEn = "A transplant is the better option for you.";
  ai.dimensions[1].options[2].linkZh = "移植是更好的选择。";
  const { result, logs } = await run(ai);
  assert.equal(result.source, "template");
  assert.deepEqual(result.explanation, template);
  assert.match(JSON.stringify(logs), /better option/);
  assert.match(JSON.stringify(logs), /更好的选择/);
});

test("a result missing an option falls back to the template", async () => {
  const ai = validAiResult();
  ai.dimensions[0].options = ai.dimensions[0].options.filter((o) => o.option !== "ckm");
  const { result, logs } = await run(ai);
  assert.equal(result.source, "template");
  assert.deepEqual(result.explanation, template);
  assert.match(JSON.stringify(logs), /travel: option ckm is missing/);
});

test("invalid JSON (aiJson returns null) falls back to the template", async () => {
  const { result, logs } = await run(null);
  assert.equal(result.source, "template");
  assert.deepEqual(result.explanation, template);
  assert.equal(logs.length, 1);
});

test("a malformed object, a thrown error, a timeout or no AI all fall back", async () => {
  for (const [ai, overrides] of [
    [{ dimensions: [{ dimension: "travel" }] }, {}],
    [{ unexpected: true }, {}],
    [
      null,
      {
        askAi: async () => {
          throw new Error("AI request failed (500)");
        },
      },
    ],
    [null, { askAi: () => new Promise(() => {}), timeoutMs: 20 }],
    [null, { askAi: null }],
  ]) {
    const { result, logs } = await run(ai, overrides);
    assert.equal(result.source, "template");
    assert.deepEqual(result.explanation, template);
    assert.equal(logs.length, 1);
  }
});

test("other rule breaks from the model fall back to the template", async () => {
  const cases = [
    [
      "repeated statement",
      (ai) => ai.dimensions[1].options[2].statementIds.push("tx.home.practical.1"),
      /home \/ tx: repeats a statement/,
    ],
    [
      "wrong statement for the pair",
      (ai) => ai.dimensions[0].options[0].statementIds.push("hd.travel.harder.1"),
      /hd\.travel\.harder\.1 belongs to a different option/,
    ],
    [
      "options out of order",
      (ai) => ai.dimensions[0].options.reverse(),
      /options must be in the order/,
    ],
    [
      "missing bridge",
      (ai) => {
        ai.dimensions[0].bridgeZh = "";
      },
      /bridge must be written in both languages/,
    ],
    [
      "link in one language only",
      (ai) => {
        ai.dimensions[0].options[1].linkEn = "Just English.";
      },
      /link must be in both languages or neither/,
    ],
    [
      "overlong bridge",
      (ai) => {
        ai.dimensions[0].bridgeEn = "word ".repeat(60);
      },
      /bridge is too long/,
    ],
    [
      "only the helps statements",
      (ai) => {
        ai.dimensions[1].options[0].statementIds = ["pd.home.helps.1"];
      },
      /home \/ pd: left out every \\"harder\\" statement/,
    ],
  ];
  for (const [name, breakIt, reason] of cases) {
    const ai = validAiResult();
    breakIt(ai);
    const { result, logs } = await run(ai);
    assert.equal(result.source, "template", name);
    assert.match(JSON.stringify(logs), reason, name);
  }
  // A gated statement is rejected when the gate did not allow it.
  const gatedRequest = { ...request, priorities: [{ dimension: "time", evidence: [] }] };
  const gatedAi = {
    dimensions: [
      {
        dimension: "time",
        bridgeZh: "您说过时间很重要。",
        bridgeEn: "You said time matters to you.",
        options: OPTION_ORDER.map((option) => ({
          option,
          statementIds: statementsFor(option, "time", { allowGated: true }).map((s) => s.id),
          linkZh: "",
          linkEn: "",
        })),
      },
    ],
  };
  const gated = await run(gatedAi, { request: gatedRequest });
  assert.equal(gated.result.source, "template");
  assert.match(JSON.stringify(gated.logs), /tx\.time\.practical\.1 mentions living donation/);
  const allowed = await run(gatedAi, { request: { ...gatedRequest, allowGated: true } });
  assert.equal(allowed.result.source, "ai");
});

test("the template is always valid and has no AI wording", () => {
  for (const allowGated of [false, true]) {
    const dimensions = ["independence", "flexibility", "time", "family", "comfort"];
    const explanation = buildTemplateExplanation(dimensions, { allowGated });
    assert.deepEqual(validateExplanation(explanation, { dimensions, allowGated }), []);
    for (const d of explanation.dimensions) {
      assert.deepEqual(findForbiddenPhrases(d.bridge.en, "en"), []);
      assert.deepEqual(findForbiddenPhrases(d.bridge.zh, "zh"), []);
      for (const o of d.options) assert.equal(o.link, undefined);
    }
  }
  const time = buildTemplateExplanation(["time"], { allowGated: true }).dimensions[0];
  assert.ok(time.options[2].statementIds.includes("tx.time.practical.1"));
});

test("the schema limits each dimension/option pair to its own statement ids", () => {
  const schema = buildOptionsSchema(["travel", "time"], false);
  const dimensionSchemas = schema.properties.dimensions.items.anyOf;
  assert.deepEqual(
    dimensionSchemas.map((s) => s.properties.dimension.enum),
    [["travel"], ["time"]],
  );
  const timeOptions = dimensionSchemas[1].properties.options.items.anyOf;
  assert.deepEqual(
    timeOptions.map((s) => s.properties.option.enum),
    OPTION_ORDER.map((o) => [o]),
  );
  assert.deepEqual(timeOptions[2].properties.statementIds.items.enum, [
    "tx.time.helps.1",
    "tx.time.harder.1",
  ]);
  for (const s of [...dimensionSchemas, ...timeOptions]) {
    assert.equal(s.additionalProperties, false);
    assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
  }
  const gated = buildOptionsSchema(["time"], true).properties.dimensions.items.anyOf[0];
  assert.ok(
    gated.properties.options.items.anyOf[2].properties.statementIds.items.enum.includes(
      "tx.time.practical.1",
    ),
  );
});

test("the prompt carries the patient's choices in both languages and only allowed statements", async () => {
  const { calls } = await run(validAiResult());
  const prompt = JSON.parse(calls[0].input);
  assert.deepEqual(prompt.dimensions[1].patientChose, [
    {
      question: "treatment-location",
      en: "I would prefer to receive most care at home if possible",
      zh: "如果可以，希望主要在家接受护理",
    },
  ]);
  assert.equal(prompt.dimensions[0].patientChose[0].rank, 1);
  assert.deepEqual(calls[0].schema, buildOptionsSchema(["travel", "home"], false));
  const gatedPrompt = buildOptionsPrompt({
    ...request,
    priorities: [{ dimension: "time", evidence: [] }],
  });
  assert.doesNotMatch(gatedPrompt, /tx\.time\.practical\.1/);
});

test("no priorities means no AI call", async () => {
  const { result, calls } = await run(validAiResult(), {
    request: { ...request, priorities: [] },
  });
  assert.deepEqual(result, { explanation: { dimensions: [] }, source: "template" });
  assert.equal(calls.length, 0);
});
