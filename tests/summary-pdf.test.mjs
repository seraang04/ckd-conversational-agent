import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PDFDocument, PDFName, decodePDFRawStream } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import ts from "typescript";

const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };

const toDataUrl = (src) =>
  `data:text/javascript;base64,${Buffer.from(src).toString("base64")}`;
const transpile = (src) => ts.transpileModule(src, { compilerOptions: options }).outputText;

const scriptSource = await readFile(new URL("../src/lib/ckd-script.ts", import.meta.url), "utf8");
const scriptUrl = toDataUrl(transpile(scriptSource));

const kbDataSource = await readFile(new URL("../src/lib/treatment-options.data.ts", import.meta.url), "utf8");
const kbDataUrl = toDataUrl(transpile(kbDataSource));

const treatmentOptionsSource = await readFile(new URL("../src/lib/treatment-options.ts", import.meta.url), "utf8");
const treatmentOptionsUrl = toDataUrl(
  transpile(treatmentOptionsSource.replaceAll('"./treatment-options.data.ts"', JSON.stringify(kbDataUrl))),
);

const decisionSheetsSource = await readFile(
  new URL("../src/lib/decision-sheets.ts", import.meta.url),
  "utf8",
);
const profileSource = await readFile(new URL("../src/lib/patient-profile.ts", import.meta.url), "utf8");

// Two-pass to handle the circular decision-sheets ↔ patient-profile dependency.
const sheetsUrlForProfile = toDataUrl(
  transpile(
    decisionSheetsSource
      .replaceAll('"./ckd-script.ts"', JSON.stringify(scriptUrl))
      .replaceAll('"./patient-profile.ts"', JSON.stringify(
        toDataUrl("export function buildPatientProfile(){ return { priorities:[], handoffs:[], all:[] }; }"),
      ))
      .replaceAll('"./treatment-options.ts"', JSON.stringify(treatmentOptionsUrl)),
  ),
);
const profileUrl = toDataUrl(
  transpile(
    profileSource
      .replaceAll('"./ckd-script.ts"', JSON.stringify(scriptUrl))
      .replaceAll('"./decision-sheets.ts"', JSON.stringify(sheetsUrlForProfile))
      .replaceAll('"./treatment-options.ts"', JSON.stringify(treatmentOptionsUrl)),
  ),
);
const decisionSheetsJs = transpile(
  decisionSheetsSource
    .replaceAll('"./ckd-script.ts"', JSON.stringify(scriptUrl))
    .replaceAll('"./patient-profile.ts"', JSON.stringify(profileUrl))
    .replaceAll('"./treatment-options.ts"', JSON.stringify(treatmentOptionsUrl)),
);
const decisionSheetsUrl = toDataUrl(decisionSheetsJs);
const { buildPatientSheet, buildCaregiverSheet } = await import(decisionSheetsUrl);

const summaryPdfSource = await readFile(
  new URL("../src/lib/summary-pdf.ts", import.meta.url),
  "utf8",
);
const summaryPdfJs = ts.transpileModule(
  summaryPdfSource
    .replace('"./decision-sheets.ts"', JSON.stringify(decisionSheetsUrl))
    .replace('"pdf-lib"', JSON.stringify(import.meta.resolve("pdf-lib")))
    .replace('"@pdf-lib/fontkit"', JSON.stringify(import.meta.resolve("@pdf-lib/fontkit"))),
  { compilerOptions: options },
).outputText;
const { createSheetPdf } = await import(
  `data:text/javascript;base64,${Buffer.from(summaryPdfJs).toString("base64")}`
);

const font = await readFile(new URL("../public/fonts/NotoSansCJKsc-Regular.otf", import.meta.url));
const fontBytes = font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength);

const confirmed = {
  patientPriorities: [
    "希望有更多时间陪伴家人 / More time with family",
    "希望继续在家附近散步 / Keep walking near home",
  ],
  sharedConcerns: ["治疗对身体的影响 / How treatment may affect the body"],
};

function patientEntries(language) {
  const enSheet = language === "en";
  return [
    {
      speaker: "patient",
      topic: "values-1",
      visibility: "shared",
      answer: enSheet
        ? "Priorities (most important first):\n1. Staying independent\n2. Time with family\n3. Feeling comfortable"
        : "优先事项（最重要的排在前面）：\n1. 保持独立\n2. 和家人相处\n3. 感觉舒适",
    },
    {
      speaker: "patient",
      topic: "treatment-location",
      visibility: "shared",
      answer: enSheet
        ? "Selected concerns:\n• A mix of care at home and at a centre could work for me"
        : "选择的担忧：\n• 在家和到中心接受护理都可以",
    },
    {
      speaker: "patient",
      topic: "values-3",
      visibility: "shared",
      answer: enSheet ? "Gardening on the balcony." : "在阳台上种花。",
    },
    {
      speaker: "patient",
      topic: "life-2",
      visibility: "shared",
      answer: enSheet ? "The bus stop is a bit far." : "巴士站有点远。",
    },
    {
      speaker: "patient",
      topic: "life-3",
      visibility: "shared",
      answer: enSheet ? "My daughter helps out." : "我女儿会帮忙。",
    },
    {
      speaker: "patient",
      topic: "worries-1",
      visibility: "shared",
      answer: enSheet
        ? "Selected concerns:\n• Costs\n• Impact on family"
        : "选择的担忧：\n• 费用\n• 对家人的影响",
    },
    {
      speaker: "patient",
      topic: "options-shown",
      visibility: "shared",
      answer: '{"kbVersion":"v1.0","source":"template","priorities":["travel","home"]}',
    },
    {
      speaker: "patient",
      topic: "options-question",
      visibility: "shared",
      answer: enSheet
        ? "Could my daughter learn to do peritoneal dialysis at home with me?"
        : "我女儿可以学会在家帮我做腹膜透析吗？",
    },
    {
      speaker: "patient",
      topic: "options-question",
      visibility: "shared",
      answer: enSheet ? "How long is the wait for a kidney?" : "等肾要等多久？",
    },
    {
      speaker: "patient",
      topic: "sensitive-1",
      visibility: "deferred",
      answer: "",
    },
  ];
}

function caregiverEntries(language) {
  const enSheet = language === "en";
  return [
    {
      speaker: "caregiver",
      topic: "caregiver-2",
      visibility: "shared",
      answer: enSheet
        ? "I drive her to appointments and help with meals."
        : "我开车送她去看诊，也帮忙准备三餐。",
    },
    {
      speaker: "caregiver",
      topic: "caregiver-3",
      visibility: "shared",
      answer: enSheet
        ? "Selected concerns:\n• Time and daily routines\n• My own wellbeing"
        : "选择的担忧：\n• 时间与日常安排\n• 自己的身心健康",
    },
    {
      speaker: "caregiver",
      topic: "caregiver-4",
      visibility: "private",
      answer: enSheet ? "I'm worried I can't keep this up much longer." : "我担心自己撑不了太久。",
    },
  ];
}

for (const language of ["en", "zh"]) {
  test(`patient sheet in ${language} renders to at most 2 A4 pages`, async () => {
    const sheet = buildPatientSheet(language, patientEntries(language), confirmed, "2026-09-24");
    const bytes = await createSheetPdf(sheet, fontBytes);
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() <= 2, `Expected ≤ 2 pages, got ${pdf.getPageCount()}`);
    const page = pdf.getPage(0);
    assert.equal(page.getWidth(), 595.28);
    assert.equal(page.getHeight(), 841.89);
  });

  test(`caregiver sheet in ${language} renders to exactly 1 A4 page`, async () => {
    const sheet = buildCaregiverSheet(language, caregiverEntries(language), "2026-09-24");
    const bytes = await createSheetPdf(sheet, fontBytes);
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 1);
  });
}

test("a very long answer overflows onto more than one page", async () => {
  const longConfirmed = {
    patientPriorities: ["与家人共度时光。".repeat(400)],
    sharedConcerns: [],
  };
  const sheet = buildPatientSheet("zh", [], longConfirmed, "2026-09-24");
  const bytes = await createSheetPdf(sheet, fontBytes);
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
});

test("the CJK font is embedded unsubset, and the title's glyph IDs appear in the content stream", async () => {
  const sheet = buildPatientSheet("zh", patientEntries("zh"), confirmed, "2026-09-24");
  const bytes = await createSheetPdf(sheet, fontBytes);
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPage(0);
  const fonts = page.node.Resources().lookup(PDFName.of("Font"));
  const type0Key = fonts.keys().find((key) => {
    const dict = fonts.lookup(key);
    return dict.lookup(PDFName.of("Subtype")) === PDFName.of("Type0");
  });
  assert.ok(type0Key, "expected a Type0 (composite CJK) font on the page");
  const fontDictionary = fonts.lookup(type0Key);
  const descendant = fontDictionary.lookup(PDFName.of("DescendantFonts")).lookup(0);
  const descriptor = descendant.lookup(PDFName.of("FontDescriptor"));
  const embedded = descriptor.lookup(PDFName.of("FontFile3")) ?? descriptor.lookup(PDFName.of("FontFile2"));
  assert.deepEqual(Buffer.from(decodePDFRawStream(embedded).decode()), font);

  const expectedGlyphs = fontkit
    .create(font)
    .layout(sheet.title)
    .glyphs.map((glyph) => glyph.id.toString(16).padStart(4, "0").toUpperCase())
    .join("");
  const contents = page.node.Contents();
  const commands = Array.from({ length: contents.size() }, (_, index) =>
    Buffer.from(decodePDFRawStream(contents.lookup(index)).decode()).toString(),
  ).join("\n");
  assert.ok(commands.includes(`<${expectedGlyphs}> Tj`));
});

test("English sheets draw Latin text with Helvetica, not the CJK font", async () => {
  const sheet = buildPatientSheet("en", patientEntries("en"), confirmed, "2026-09-24");
  const bytes = await createSheetPdf(sheet, fontBytes);
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPage(0);
  const fonts = page.node.Resources().lookup(PDFName.of("Font"));
  const names = fonts.keys().map((key) => fonts.lookup(key).get(PDFName.of("BaseFont")).toString());
  assert.ok(names.includes("/Helvetica"));
  assert.ok(names.includes("/Helvetica-Bold"));
});
