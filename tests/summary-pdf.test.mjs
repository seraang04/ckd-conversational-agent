import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PDFDocument, PDFName, decodePDFRawStream } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
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

test("preserves the bundled CFF font and its glyph IDs for PDF viewers", async () => {
  const title = "对话摘要";
  const bytes = await createSummaryPdf(title, [], fontBytes);
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPage(0);
  const fonts = page.node.Resources().lookup(PDFName.of("Font"));
  const fontDictionary = fonts.lookup(fonts.keys()[0]);
  const descendant = fontDictionary.lookup(PDFName.of("DescendantFonts")).lookup(0);
  const descriptor = descendant.lookup(PDFName.of("FontDescriptor"));
  const embedded = descriptor.lookup(PDFName.of("FontFile3"))
    ?? descriptor.lookup(PDFName.of("FontFile2"));
  assert.deepEqual(Buffer.from(decodePDFRawStream(embedded).decode()), font);

  const expectedGlyphs = fontkit.create(font).layout(title).glyphs
    .map((glyph) => glyph.id.toString(16).padStart(4, "0").toUpperCase()).join("");
  const contents = page.node.Contents();
  const commands = Array.from({ length: contents.size() }, (_, index) =>
    Buffer.from(decodePDFRawStream(contents.lookup(index)).decode()).toString(),
  ).join("\n");
  assert.ok(commands.includes(`<${expectedGlyphs}> Tj`));
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


test("uses proportional Latin punctuation and hanging indents for wrapped bullets", async () => {
  const bytes = await createSummaryPdf(
    "Conversation summary",
    [{ heading: "Discuss at your appointment", answers: [
      "Treatment’s effects on the body. You said “no.” " + "Support at home. ".repeat(20),
    ] }],
    fontBytes,
  );
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPage(0);
  const fonts = page.node.Resources().lookup(PDFName.of("Font"));
  const names = fonts.keys().map((key) => fonts.lookup(key).get(PDFName.of("BaseFont")).toString());
  assert.ok(names.includes("/Helvetica"));
  assert.ok(names.includes("/Helvetica-Bold"));
  assert.equal(new Set(names).size, 2, "English punctuation should not use the CJK font");
  const contents = page.node.Contents();
  const commands = Array.from({ length: contents.size() }, (_, index) =>
    Buffer.from(decodePDFRawStream(contents.lookup(index)).decode()).toString(),
  ).join("\n");
  assert.equal((commands.match(/1 0 0 1 52 [\d.]+ Tm/g) ?? []).length, 1, "one bullet marker");
  assert.ok((commands.match(/1 0 0 1 66 [\d.]+ Tm/g) ?? []).length > 1,
    "all wrapped answer lines use the text indent");
  assert.ok(commands.includes("54726561746D656E749273"), "curly apostrophe uses Latin encoding");
});
