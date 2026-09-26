import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const toDataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const transpile = async (path, replacements = {}) => {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) {
    source = source.replace(from, JSON.stringify(to));
  }
  return toDataUrl(ts.transpileModule(source, { compilerOptions: options }).outputText);
};

const dataUrl = await transpile("../src/lib/treatment-options.data.ts");
const kbUrl = await transpile("../src/lib/treatment-options.ts", {
  '"./treatment-options.data.ts"': dataUrl,
});
const { OPTION_ORDER, statementsFor } = await import(kbUrl);
const { findForbiddenPhrases, validateExplanation, FORBIDDEN_PHRASES } = await import(
  await transpile("../src/lib/option-validation.ts", { '"./treatment-options.ts"': kbUrl })
);

/** A valid explanation using every non-gated statement for each dimension. */
const explain = (dimensions, allowGated = false) => ({
  dimensions: dimensions.map((dimension) => ({
    dimension,
    bridge: { en: "You said travel matters to you.", zh: "您说旅行对您很重要。" },
    options: OPTION_ORDER.map((option) => ({
      option,
      statementIds: statementsFor(option, dimension, { allowGated }).map((s) => s.id),
      link: { en: "This is how it works for travel.", zh: "这是关于旅行的情况。" },
    })),
  })),
});
const check = (explanation, dimensions = ["travel", "time"], allowGated = false) =>
  validateExplanation(explanation, { dimensions, allowGated });
const optionFor = (explanation, dimension, option) =>
  explanation.dimensions
    .find((d) => d.dimension === dimension)
    .options.find((o) => o.option === option);

test("finds every listed English phrase, case-insensitively", () => {
  for (const phrase of FORBIDDEN_PHRASES.en) {
    assert.deepEqual(findForbiddenPhrases(`Well, ${phrase.toUpperCase()}.`, "en"), [phrase]);
  }
  assert.deepEqual(findForbiddenPhrases("PD is recommended for people like you", "en"), [
    "recommend",
  ]);
  assert.deepEqual(findForbiddenPhrases("this is the\nbetter  option", "en"), ["better option"]);
  assert.deepEqual(findForbiddenPhrases("You said travel matters to you.", "en"), []);
});

test("finds every listed Chinese phrase", () => {
  for (const phrase of ["建议您", "推荐", "最适合", "最好的选择", "您应该选择", "更好的选择"]) {
    assert.ok(findForbiddenPhrases(`对您来说，${phrase}。`, "zh").includes(phrase), phrase);
  }
  assert.deepEqual(findForbiddenPhrases("腹膜透析比较适合您", "zh"), ["比较适合您", "适合您"]);
  assert.deepEqual(findForbiddenPhrases("您说旅行对您很重要。", "zh"), []);
  assert.deepEqual(findForbiddenPhrases("推荐", "en"), []);
});

test("a complete explanation in the right order is valid", () => {
  assert.deepEqual(check(explain(["travel", "time"])), []);
  assert.deepEqual(check({ dimensions: [] }, []), []);
});

test("every option must appear exactly once per dimension", () => {
  const missing = explain(["travel", "time"]);
  missing.dimensions[0].options = missing.dimensions[0].options.filter((o) => o.option !== "ckm");
  assert.ok(check(missing).includes("travel: option ckm is missing"));

  const twice = explain(["travel", "time"]);
  twice.dimensions[1].options.push(structuredClone(twice.dimensions[1].options[0]));
  assert.ok(check(twice).includes("time: option pd appears 2 times"));
});

test("options must be in OPTION_ORDER", () => {
  const reordered = explain(["travel", "time"]);
  reordered.dimensions[0].options.reverse();
  assert.deepEqual(check(reordered), ["travel: options must be in the order pd, hd, tx, ckm"]);
});

test("statement ids must exist and belong to that option and dimension", () => {
  const unknown = explain(["travel", "time"]);
  optionFor(unknown, "travel", "pd").statementIds.push("pd.travel.helps.9");
  assert.deepEqual(check(unknown), ["travel / pd: unknown statement pd.travel.helps.9"]);

  const wrongOption = explain(["travel", "time"]);
  optionFor(wrongOption, "travel", "pd").statementIds.push("hd.travel.harder.1");
  const wrongDimension = explain(["travel", "time"]);
  optionFor(wrongDimension, "travel", "pd").statementIds.push("pd.home.helps.1");
  const common = explain(["travel", "time"]);
  optionFor(common, "travel", "pd").statementIds.push("common.suitability.1");
  for (const [explanation, id] of [
    [wrongOption, "hd.travel.harder.1"],
    [wrongDimension, "pd.home.helps.1"],
    [common, "common.suitability.1"],
  ]) {
    assert.deepEqual(check(explanation), [
      `travel / pd: statement ${id} belongs to a different option or dimension`,
    ]);
  }
});

test("gated statements are rejected unless allowed", () => {
  const gated = explain(["time", "family"], true);
  assert.ok(optionFor(gated, "time", "tx").statementIds.includes("tx.time.practical.1"));
  assert.deepEqual(check(gated, ["time", "family"], true), []);
  assert.deepEqual(check(gated, ["time", "family"], false), [
    "time / tx: statement tx.time.practical.1 mentions living donation, which is not allowed",
    "family / tx: statement tx.family.practical.2 mentions living donation, which is not allowed",
  ]);
});

test("each option needs at least one statement per dimension", () => {
  const empty = explain(["travel", "time"]);
  optionFor(empty, "time", "ckm").statementIds = [];
  assert.deepEqual(check(empty), ["time / ckm: needs at least one statement"]);
});

test("bridge and link text may not use forbidden wording in either language", () => {
  const english = explain(["travel", "time"]);
  english.dimensions[0].bridge.en = "Since travel matters, I suggest PD.";
  const chinese = explain(["travel", "time"]);
  optionFor(chinese, "time", "hd").link.zh = "血液透析是更好的选择。";
  const mixed = explain(["travel", "time"]);
  optionFor(mixed, "travel", "tx").link.zh = "移植 is the best for you.";
  assert.deepEqual(check(english), ["travel bridge (en) uses forbidden wording: I suggest"]);
  assert.deepEqual(check(chinese), ["time / hd link (zh) uses forbidden wording: 更好的选择"]);
  assert.deepEqual(check(mixed), ["travel / tx link (zh) uses forbidden wording: best for you"]);
});

test("dimensions must match what the patient raised", () => {
  assert.deepEqual(check(explain(["travel"])), ["time: missing from the explanation"]);
  assert.deepEqual(check(explain(["travel", "time", "home"])), [
    "home: the patient did not raise this dimension",
  ]);
  const repeated = explain(["travel", "travel", "time"]);
  assert.deepEqual(check(repeated), ["travel: appears more than once"]);
  const handoff = { dimensions: [{ dimension: "cost", options: [] }] };
  assert.deepEqual(check(handoff, ["cost"]), [
    "cost: this dimension is for the care team and cannot be explained",
  ]);
  assert.deepEqual(check({ dimensions: [] }, ["longevity"]), [
    "longevity: this dimension is for the care team and cannot be explained",
  ]);
});
