// Parses docs/treatment-options-kb.md (the clinician-edited source of truth) and
// writes src/lib/treatment-options.data.ts. Run with `npm run kb:build`.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const KB_PATH = fileURLToPath(new URL("../docs/treatment-options-kb.md", import.meta.url));
export const DATA_PATH = fileURLToPath(
  new URL("../src/lib/treatment-options.data.ts", import.meta.url),
);

const TAGS = ["helps", "harder", "practical", "ask-team"];
const STATEMENT_LINE = /^- `([^`]+)` · ([a-z-]+)(?: · \[([^\]]*)\])?(?: · ⚠ ([A-Z]+))?\s*$/;

class KbError extends Error {
  constructor(line, message) {
    super(`docs/treatment-options-kb.md:${line}: ${message}`);
  }
}

/** Rows of the first markdown table after the heading that starts with `heading`. */
function tableAfter(lines, heading) {
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) throw new KbError(1, `missing section "${heading}"`);
  let i = start + 1;
  while (i < lines.length && !lines[i].startsWith("|")) {
    if (lines[i].startsWith("#")) throw new KbError(start + 1, `no table under "${heading}"`);
    i += 1;
  }
  const rows = [];
  // Skip the header and |---| separator rows.
  for (i += 2; i < lines.length && lines[i].startsWith("|"); i += 1) {
    rows.push({
      line: i + 1,
      cells: lines[i]
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim()),
    });
  }
  if (!rows.length) throw new KbError(start + 1, `empty table under "${heading}"`);
  return rows;
}

function backtickId(cell, line) {
  const match = /^`([a-z-]+)`$/.exec(cell);
  if (!match) throw new KbError(line, `expected an id like \`pd\`, got "${cell}"`);
  return match[1];
}

export function parseKb(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

  const version = /^# .*\b(v\d+(?:\.\d+)*)\s*$/.exec(lines[0] ?? "")?.[1];
  if (!version) throw new KbError(1, 'title line must end with a version such as "v1.0"');

  const options = tableAfter(lines, "## 3. Options").map(({ line, cells }) => ({
    id: backtickId(cells[0], line),
    en: cells[1],
    zh: cells[2],
  }));
  const dimensions = tableAfter(lines, "## 4. Dimensions").map(({ line, cells }) => ({
    id: backtickId(cells[0], line),
    en: cells[1],
    zh: cells[2],
    // Every backticked token in the column except tag names (e.g. "always `ask-team`").
    questions: [...(cells[3] ?? "").matchAll(/`([^`]+)`/g)]
      .map((m) => m[1])
      .filter((token) => !TAGS.includes(token)),
  }));
  for (const [kind, list] of [
    ["option", options],
    ["dimension", dimensions],
  ]) {
    for (const item of list) {
      if (!item.en || !item.zh) throw new KbError(1, `${kind} "${item.id}" needs English and 中文`);
    }
  }
  const optionIds = options.map((o) => o.id);
  const dimensionIds = dimensions.map((d) => d.id);

  const statements = [];
  let fenced = false;
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i];
    if (text.startsWith("```")) fenced = !fenced;
    if (fenced || !text.startsWith("- `")) continue;
    const line = i + 1;

    const match = STATEMENT_LINE.exec(text);
    if (!match) {
      throw new KbError(line, "statement must look like: - `id` · tag · [SOURCES] · ⚠ GATE");
    }
    const [, id, tag, sourceList, flag] = match;
    if (!TAGS.includes(tag)) throw new KbError(line, `unknown tag "${tag}"`);
    if (flag !== undefined && flag !== "GATE") throw new KbError(line, `unknown flag "⚠ ${flag}"`);
    const sources = sourceList === undefined ? [] : sourceList.split(",").map((s) => s.trim());
    if (sources.some((s) => !s)) throw new KbError(line, "empty source in [SOURCES]");

    const parts = id.split(".");
    const [option, second] = parts;
    const n = parts.at(-1);
    if (!/^\d+$/.test(n ?? "")) throw new KbError(line, `id "${id}" must end with a number`);
    let dimension = null;
    if (option === "common") {
      // common.topic.n or common.topic.tag.n; the topic is a dimension when it names one.
      if (parts.length === 4 && parts[2] !== tag) {
        throw new KbError(line, `id "${id}" says "${parts[2]}" but the tag is "${tag}"`);
      }
      if (parts.length !== 3 && parts.length !== 4) {
        throw new KbError(line, `id "${id}" must be common.topic.n or common.topic.tag.n`);
      }
      if (dimensionIds.includes(second)) dimension = second;
    } else if (optionIds.includes(option)) {
      if (second === "summary" && parts.length === 3) {
        // option.summary.n
      } else if (parts.length === 4 && dimensionIds.includes(second)) {
        if (parts[2] !== tag) {
          throw new KbError(line, `id "${id}" says "${parts[2]}" but the tag is "${tag}"`);
        }
        dimension = second;
      } else {
        throw new KbError(
          line,
          `id "${id}" must be option.summary.n or option.dimension.tag.n with a dimension from section 4`,
        );
      }
    } else {
      throw new KbError(line, `id "${id}" must start with an option from section 3 or "common"`);
    }
    if (statements.some((s) => s.id === id)) throw new KbError(line, `duplicate id "${id}"`);

    const en = /^ {2}EN: (.+)$/.exec(lines[i + 1] ?? "")?.[1]?.trim();
    const zh = /^ {2}ZH: (.+)$/.exec(lines[i + 2] ?? "")?.[1]?.trim();
    if (!en) throw new KbError(line + 1, `"${id}" must be followed by an indented "EN: ..." line`);
    if (!zh) throw new KbError(line + 2, `"${id}" needs an indented "ZH: ..." line after EN`);

    statements.push({ id, option, dimension, tag, en, zh, sources, gated: flag === "GATE" });
    i += 2;
  }
  if (fenced) throw new KbError(lines.length, "unclosed ``` code block");
  if (!statements.length) throw new KbError(1, "no statements found");

  return { version, options, dimensions, statements };
}

export function renderKbModule(kb) {
  const constant = (name, value) =>
    `export const ${name} = ${JSON.stringify(value, null, 2)} as const;\n`;
  return [
    "// GENERATED by scripts/build-treatment-kb.mjs from docs/treatment-options-kb.md.",
    "// Do not edit by hand: edit the markdown, then run `npm run kb:build`.",
    "",
    constant("KB_VERSION", kb.version),
    constant("KB_OPTIONS", kb.options),
    constant("KB_DIMENSIONS", kb.dimensions),
    constant("KB_STATEMENTS", kb.statements),
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const kb = parseKb(await readFile(KB_PATH, "utf8"));
    await writeFile(DATA_PATH, renderKbModule(kb));
    console.log(
      `Wrote src/lib/treatment-options.data.ts (${kb.version}, ${kb.statements.length} statements)`,
    );
  } catch (error) {
    console.error(error instanceof KbError ? error.message : error);
    process.exit(1);
  }
}
