import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/summary-pdf.ts", import.meta.url), "utf8");
const js = ts.transpileModule(
  source
    .replace('"pdf-lib"', JSON.stringify(import.meta.resolve("pdf-lib")))
    .replace('"@pdf-lib/fontkit"', JSON.stringify(import.meta.resolve("@pdf-lib/fontkit"))),
  { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
).outputText;
const { createSummaryPdf } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const font = await readFile(new URL("../public/fonts/NotoSansCJKsc-Regular.otf", import.meta.url));
const fontBytes = font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength);

test("creates a PDF with English and Chinese summary text", async () => {
  const bytes = await createSummaryPdf(
    "对话摘要 / Conversation summary",
    [
      {
        heading: "您在意的事",
        answers: ["我希望有更多时间陪伴家人。", "Time with family matters to me."],
      },
    ],
    fontBytes,
  );
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getTitle(), "对话摘要 / Conversation summary");
});

test("paginates long summaries including Chinese without spaces and long words", async () => {
  const bytes = await createSummaryPdf(
    "Summary",
    [{ heading: "What matters", answers: ["与家人共度时光。".repeat(350), "word".repeat(500)] }],
    fontBytes,
  );
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
});
