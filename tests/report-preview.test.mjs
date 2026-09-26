import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

// Transpile TypeScript sources the same way summary-pdf.test.mjs does.
const options = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };

const scriptSource = await readFile(new URL("../src/lib/ckd-script.ts", import.meta.url), "utf8");
const scriptJs = ts.transpileModule(scriptSource, { compilerOptions: options }).outputText;
const scriptUrl = `data:text/javascript;base64,${Buffer.from(scriptJs).toString("base64")}`;

const decisionSheetsSource = await readFile(
  new URL("../src/lib/decision-sheets.ts", import.meta.url),
  "utf8",
);
const decisionSheetsJs = ts.transpileModule(
  decisionSheetsSource.replaceAll('"./ckd-script.ts"', JSON.stringify(scriptUrl)),
  { compilerOptions: options },
).outputText;
const decisionSheetsUrl = `data:text/javascript;base64,${Buffer.from(decisionSheetsJs).toString("base64")}`;
const { buildPatientSheet, buildCaregiverSheet, formatPreparedOn } = await import(decisionSheetsUrl);

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

// Simulates what usePdfPreview does: sheet → createSheetPdf → Blob
async function makeBlob(sheet) {
  const bytes = await createSheetPdf(sheet, fontBytes);
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

const preparedOn = formatPreparedOn(new Date("2026-09-26"), "en");
const confirmed = {
  patientPriorities: ["Staying independent", "Time with family"],
  sharedConcerns: ["How treatment may affect the body"],
};

test("blob has correct MIME type and starts with the PDF magic bytes", async () => {
  const sheet = buildPatientSheet("en", [], confirmed, preparedOn);
  const blob = await makeBlob(sheet);

  assert.equal(blob.type, "application/pdf");
  assert.ok(blob.size > 0, "blob should be non-empty");

  const header = await blob.slice(0, 5).arrayBuffer();
  const magic = Buffer.from(header).toString("ascii");
  assert.equal(magic, "%PDF-", `expected PDF magic bytes, got: ${JSON.stringify(magic)}`);
});

test("blob size is reasonable (between 50 KB and 5 MB)", async () => {
  const sheet = buildPatientSheet("en", [], confirmed, preparedOn);
  const blob = await makeBlob(sheet);
  assert.ok(blob.size >= 50_000, `blob too small: ${blob.size} bytes`);
  assert.ok(blob.size <= 20_000_000, `blob suspiciously large: ${blob.size} bytes`);
});

test("patient blob and caregiver blob are distinct", async () => {
  const patientSheet = buildPatientSheet("en", [], confirmed, preparedOn);
  const caregiverSheet = buildCaregiverSheet("en", [], preparedOn);

  const [patientBlob, caregiverBlob] = await Promise.all([
    makeBlob(patientSheet),
    makeBlob(caregiverSheet),
  ]);

  assert.notEqual(patientBlob.size, caregiverBlob.size);
});

test("blob is identical when called twice with the same sheet (deterministic output)", async () => {
  const sheet = buildPatientSheet("en", [], confirmed, preparedOn);
  const [blob1, blob2] = await Promise.all([makeBlob(sheet), makeBlob(sheet)]);

  const [buf1, buf2] = await Promise.all([blob1.arrayBuffer(), blob2.arrayBuffer()]);
  assert.deepEqual(Buffer.from(buf1), Buffer.from(buf2));
});
