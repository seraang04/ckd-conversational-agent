import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";
import { parseKb, renderKbModule } from "../scripts/build-treatment-kb.mjs";

const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const toDataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;

const markdown = await readFile(
  new URL("../docs/treatment-options-kb.md", import.meta.url),
  "utf8",
);
const dataSource = await readFile(
  new URL("../src/lib/treatment-options.data.ts", import.meta.url),
  "utf8",
);
const dataUrl = toDataUrl(ts.transpileModule(dataSource, { compilerOptions: options }).outputText);

const kbSource = await readFile(
  new URL("../src/lib/treatment-options.ts", import.meta.url),
  "utf8",
);
const kbJs = ts.transpileModule(
  kbSource.replace('"./treatment-options.data.ts"', JSON.stringify(dataUrl)),
  { compilerOptions: options },
).outputText;
const {
  KB_VERSION,
  OPTION_ORDER,
  EXPLAINABLE_DIMENSIONS,
  HANDOFF_DIMENSIONS,
  statementsFor,
  statementById,
  optionLabel,
  dimensionLabel,
  dimensionQuestionIds,
} = await import(toDataUrl(kbJs));
const { KB_STATEMENTS, KB_DIMENSIONS, KB_OPTIONS } = await import(dataUrl);

const scriptSource = await readFile(new URL("../src/lib/ckd-script.ts", import.meta.url), "utf8");
const { SCRIPT } = await import(
  toDataUrl(ts.transpileModule(scriptSource, { compilerOptions: options }).outputText)
);

test("generated data matches the markdown (run `npm run kb:build` if this fails)", () => {
  assert.equal(dataSource.replace(/\r\n/g, "\n"), renderKbModule(parseKb(markdown)));
  assert.match(KB_VERSION, /^v\d+(\.\d+)*$/);
});

test("options and dimensions match the typed lists", () => {
  assert.deepEqual(
    KB_OPTIONS.map((o) => o.id),
    [...OPTION_ORDER],
  );
  assert.deepEqual(
    KB_DIMENSIONS.map((d) => d.id),
    [...EXPLAINABLE_DIMENSIONS, ...HANDOFF_DIMENSIONS],
  );
  assert.equal(optionLabel("pd", "en"), "Peritoneal dialysis (PD)");
  assert.equal(optionLabel("pd", "zh"), "腹膜透析");
  assert.equal(dimensionLabel("home", "en"), "Where care happens and my home");
  assert.deepEqual(dimensionQuestionIds("longevity"), ["treatment-priorities"]);
});

test("every dimension's app questions exist in the script", () => {
  const scriptIds = new Set(SCRIPT.map((q) => q.id));
  for (const dimension of [...EXPLAINABLE_DIMENSIONS, ...HANDOFF_DIMENSIONS]) {
    const questions = dimensionQuestionIds(dimension);
    assert.ok(questions.length > 0, dimension);
    for (const id of questions) assert.ok(scriptIds.has(id), `${dimension}: ${id}`);
  }
});

test("ids are unique and consistent with option, dimension and tag", () => {
  assert.equal(new Set(KB_STATEMENTS.map((s) => s.id)).size, KB_STATEMENTS.length);
  const dimensions = [...EXPLAINABLE_DIMENSIONS, ...HANDOFF_DIMENSIONS];
  for (const s of KB_STATEMENTS) {
    const parts = s.id.split(".");
    assert.equal(parts[0], s.option, s.id);
    assert.ok([...OPTION_ORDER, "common"].includes(s.option), s.id);
    assert.ok(["helps", "harder", "practical", "ask-team"].includes(s.tag), s.id);
    assert.match(parts.at(-1), /^\d+$/, s.id);
    if (s.option === "common") {
      assert.equal(s.dimension, dimensions.includes(parts[1]) ? parts[1] : null, s.id);
      if (parts.length === 4) assert.equal(parts[2], s.tag, s.id);
    } else if (parts[1] === "summary") {
      assert.equal(parts.length, 3, s.id);
      assert.equal(s.dimension, null, s.id);
    } else {
      assert.equal(parts.length, 4, s.id);
      assert.equal(parts[1], s.dimension, s.id);
      assert.equal(parts[2], s.tag, s.id);
    }
    assert.equal(
      statementById(s.id),
      KB_STATEMENTS.find((x) => x.id === s.id),
    );
  }
  assert.equal(statementById("pd.nothing.helps.1"), undefined);
});

test("every option has a non-gated statement for every explainable dimension", () => {
  for (const option of OPTION_ORDER) {
    for (const dimension of EXPLAINABLE_DIMENSIONS) {
      assert.ok(
        statementsFor(option, dimension, { allowGated: false }).length > 0,
        `${option} × ${dimension}`,
      );
    }
  }
});

test("statementsFor keeps file order and drops gated statements unless allowed", () => {
  const ids = (allowGated) => statementsFor("tx", "time", { allowGated }).map((s) => s.id);
  assert.deepEqual(ids(true), ["tx.time.helps.1", "tx.time.harder.1", "tx.time.practical.1"]);
  assert.deepEqual(ids(false), ["tx.time.helps.1", "tx.time.harder.1"]);
});

test("every statement has English and Chinese text, with no EN: prefix in Chinese", () => {
  for (const s of KB_STATEMENTS) {
    assert.ok(s.en.trim(), s.id);
    assert.ok(s.zh.trim(), s.id);
    assert.doesNotMatch(s.zh, /EN:/, s.id);
  }
});

test("ask-team statements appear only under longevity or cost", () => {
  for (const s of KB_STATEMENTS.filter((s) => s.tag === "ask-team")) {
    assert.ok(HANDOFF_DIMENSIONS.includes(s.dimension), s.id);
  }
  for (const dimension of HANDOFF_DIMENSIONS) {
    const statements = KB_STATEMENTS.filter((s) => s.dimension === dimension);
    assert.ok(statements.length > 0, dimension);
    assert.ok(
      statements.every((s) => s.tag === "ask-team"),
      dimension,
    );
  }
});

test("exactly the two living-donation statements are gated", () => {
  assert.deepEqual(
    KB_STATEMENTS.filter((s) => s.gated).map((s) => s.id),
    ["tx.time.practical.1", "tx.family.practical.2"],
  );
});

test("the parser reports malformed blocks with a line number", () => {
  const good =
    "# KB — v1.0\n\n## 3. Options\n\n| ID | English | 中文 | x |\n|---|---|---|---|\n| `pd` | PD | 腹膜透析 | Yes |\n\n## 4. Dimensions\n\n| ID | English | 中文 | Fed by |\n|---|---|---|---|\n| `home` | Home | 家 | `treatment-location` |\n\n";
  const statement = (lines) => good + lines.join("\n") + "\n";
  assert.equal(
    parseKb(statement(["- `pd.home.helps.1` · helps · [NKF-PD]", "  EN: Home.", "  ZH: 家。"]))
      .statements.length,
    1,
  );
  const cases = [
    [["- `pd.home.helps.1` · helps", "  ZH: 家。"], /:16: .*EN:/],
    [["- `pd.home.helps.1` · helps", "  EN: Home."], /:17: .*ZH:/],
    [["- `pd.home.harder.1` · helps", "  EN: a", "  ZH: b"], /:15: .*tag is "helps"/],
    [["- `pd.home.helps.1` · helps · ⚠ GEN", "  EN: a", "  ZH: b"], /:15: unknown flag/],
    [["- `pd.roof.helps.1` · helps", "  EN: a", "  ZH: b"], /:15: .*dimension/],
    [["- `xx.home.helps.1` · helps", "  EN: a", "  ZH: b"], /:15: .*option/],
    [["- `pd.home.helps.1` helps", "  EN: a", "  ZH: b"], /:15: statement must look like/],
  ];
  for (const [lines, message] of cases) {
    assert.throws(() => parseKb(statement(lines)), message);
  }
  assert.throws(() => parseKb(good.replace("v1.0", "draft")), /:1: .*version/);
});
