import { PDFDocument, type PDFFont, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export async function createSummaryPdf(
  title: string,
  sections: { heading: string; answers: string[] }[],
  fontBytes: ArrayBuffer,
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Preserve the CJK OpenType font's glyph IDs. Subsetting this CFF font can
  // make PDF viewers display unrelated glyphs instead of the summary text.
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const latinFont = await pdf.embedFont(StandardFonts.Helvetica);
  const latinBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const latinCharacters = new Set(latinFont.getCharacterSet());
  const runs = (text: string, bold: boolean) => {
    const result: { text: string; font: PDFFont }[] = [];
    for (const character of text) {
      const selected = latinCharacters.has(character.codePointAt(0)!)
        ? (bold ? latinBold : latinFont)
        : font;
      const last = result[result.length - 1];
      if (last?.font === selected) last.text += character;
      else result.push({ text: character, font: selected });
    }
    return result;
  };
  const measure = (text: string, size: number, bold: boolean) =>
    runs(text, bold).reduce((total, run) => total + run.font.widthOfTextAtSize(run.text, size), 0);
  pdf.setTitle(title);
  let page = pdf.addPage();
  const margin = 48;
  let y = page.getHeight() - margin;
  const width = page.getWidth() - margin * 2;

  const ensureSpace = (height: number) => {
    if (y - height < margin) {
      page = pdf.addPage();
      y = page.getHeight() - margin;
    }
  };
  const paragraph = (text: string, size: number, bullet = false, bold = false) => {
    const indent = bullet ? 18 : 0;
    const lineHeight = size * 1.4;
    let firstLine = true;
    const draw = (line: string) => {
      ensureSpace(lineHeight);
      y -= lineHeight;
      const color = rgb(0.12, 0.18, 0.2);
      if (bullet && firstLine) {
        page.drawText("•", { x: margin + 4, y, size, font: latinFont, color });
      }
      let x = margin + indent;
      for (const run of runs(line, bold)) {
        page.drawText(run.text, { x, y, size, font: run.font, color });
        x += run.font.widthOfTextAtSize(run.text, size);
      }
      firstLine = false;
    };
    for (const part of text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
      let line = "";
      // Keep Latin words together; Chinese and oversized words can wrap per character.
      for (const token of part.match(
        /[\p{Script=Latin}\p{Number}]+(?:[’'][\p{Script=Latin}\p{Number}]+)*|[^\p{Script=Latin}\p{Number}]/gu,
      ) ?? []) {
        if (measure(line + token, size, bold) > width - indent && line) {
          draw(line.trimEnd());
          line = "";
        }
        for (const character of token) {
          if (measure(line + character, size, bold) > width - indent && line) {
            draw(line);
            line = "";
          }
          if (line || character.trim()) line += character;
        }
      }
      draw(line);
    }
  };

  paragraph(title, 22, false, true);
  y -= 12;
  for (const section of sections) {
    if (!section.answers.length) continue;
    ensureSpace(64);
    paragraph(section.heading, 14, false, true);
    y -= 4;
    for (const answer of section.answers) {
      paragraph(answer, 12, true);
      y -= 4;
    }
    y -= 12;
  }
  return pdf.save();
}

export async function downloadSummaryPdf(
  title: string,
  sections: { heading: string; answers: string[] }[],
  language: string,
) {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/NotoSansCJKsc-Regular.otf`);
  if (!response.ok) throw new Error("Could not load PDF font");
  const bytes = await createSummaryPdf(title, sections, await response.arrayBuffer());
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `conversation-summary-${language}.pdf`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
