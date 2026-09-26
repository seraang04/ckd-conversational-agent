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
const {
  OPTIONS_SHOWN_QUESTION,
  buildOptionsShownAnswer,
  isOptionsShownEntry,
  readOptionsShown,
  readOptionsInformation,
  optionsInformationLines,
} = await import(
  await transpile("../src/lib/options-record.ts", {
    '"./ckd-script.ts"': scriptUrl,
    '"./treatment-options.ts"': kbUrl,
  })
);
const { conversationContext } = await import(
  await transpile("../src/lib/conversation.ts", { '"./ckd-script.ts"': scriptUrl })
);
const { KB_VERSION } = await import(kbUrl);

const entry = (topic, answer, visibility = "shared", speaker = "patient") => ({
  speaker,
  topic,
  question: "Question",
  answer,
  visibility,
});
const shownEntry = (source, priorities) =>
  entry("options-shown", buildOptionsShownAnswer(source, priorities));

test("the record is a short JSON string with the KB version, source and priorities", () => {
  assert.deepEqual(JSON.parse(buildOptionsShownAnswer("template", ["travel", "home"])), {
    kbVersion: KB_VERSION,
    source: "template",
    priorities: ["travel", "home"],
  });
  assert.deepEqual(OPTIONS_SHOWN_QUESTION, {
    id: "options-shown",
    zh: "Options step",
    en: "Options step",
  });
  assert.equal(isOptionsShownEntry({ topic: "options-shown" }), true);
  assert.equal(isOptionsShownEntry({ topic: "options-question" }), false);
});

test("readOptionsShown uses the latest shared patient record and tolerates bad data", () => {
  assert.equal(readOptionsShown([]), null);
  assert.deepEqual(
    readOptionsShown([shownEntry("template", ["travel"]), shownEntry("ai", ["home", "time"])]),
    { kbVersion: KB_VERSION, source: "ai", priorities: ["home", "time"] },
  );
  assert.equal(readOptionsShown([entry("options-shown", "not json")]), null);
  assert.equal(
    readOptionsShown([
      entry("options-shown", buildOptionsShownAnswer("ai", ["home"]), "shared", "caregiver"),
    ]),
    null,
  );
  assert.deepEqual(
    readOptionsShown([
      entry("options-shown", '{"kbVersion":"v1.0","source":"??","priorities":["home","cost","x"]}'),
    ]),
    { kbVersion: "v1.0", source: "template", priorities: ["home"] },
  );
});

test("readOptionsInformation collects shared reactions and questions only", () => {
  assert.equal(readOptionsInformation([entry("values-3", "Gardening")]), null);
  const info = readOptionsInformation([
    shownEntry("template", ["travel", "home"]),
    entry("options-home", "Having boxes at home worries me."),
    entry("options-travel", "Good to know I can still travel."),
    entry("options-travel", "Private thought", "private"),
    entry("options-question", "How long does the tube operation take?"),
    entry("options-question", "", "skipped"),
    entry("options-question", "Caregiver question", "shared", "caregiver"),
  ]);
  assert.deepEqual(info.reactions, [
    { dimension: "travel", answer: "Good to know I can still travel." },
    { dimension: "home", answer: "Having boxes at home worries me." },
  ]);
  assert.deepEqual(info.questions, ["How long does the tube operation take?"]);
});

test("the clinician summary section lists priorities, reactions and questions", () => {
  assert.deepEqual(optionsInformationLines(null), []);
  const lines = optionsInformationLines(
    readOptionsInformation([
      shownEntry("ai", ["travel", "home"]),
      entry("options-travel", "Good to know I can still travel."),
      entry("options-question", "Can my daughter learn PD?"),
    ]),
  );
  assert.deepEqual(lines, [
    "Options information shown",
    "Priorities used: Travel and overnight stays, Where care happens and my home",
    `Content: approved knowledge base ${KB_VERSION}, AI-selected and validated`,
    "Patient reaction (Travel and overnight stays): Good to know I can still travel.",
    "Patient question: Can my daughter learn PD?",
  ]);
  assert.match(
    optionsInformationLines(readOptionsInformation([shownEntry("template", [])]))[1],
    /Priorities used: none/,
  );
});

test("the question planner never sees options-step entries", () => {
  const entries = [
    entry("values-3", "Gardening"),
    shownEntry("template", ["travel"]),
    entry("options-travel", "Good to know."),
    entry("options-question", "What about costs?"),
  ];
  const context = conversationContext("patient", entries);
  assert.deepEqual(
    context.history.map((e) => e.topic),
    ["values-3"],
  );
});
