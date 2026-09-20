import { PDFDocument, rgb } from "pdf-lib";
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
  const paragraph = (text: string, size: number, indent = 0) => {
    const lineHeight = size * 1.6;
    const draw = (line: string) => {
      ensureSpace(lineHeight);
      y -= lineHeight;
      page.drawText(line, { x: margin + indent, y, size, font, color: rgb(0.12, 0.18, 0.2) });
    };
    for (const part of text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
      let line = "";
      // Keep Latin words together; Chinese and oversized words can wrap per character.
      for (const token of part.match(
        /[\p{Script=Latin}\p{Number}]+|[^\p{Script=Latin}\p{Number}]/gu,
      ) ?? []) {
        if (font.widthOfTextAtSize(line + token, size) > width - indent && line) {
          draw(line.trimEnd());
          line = "";
        }
        for (const character of token) {
          if (font.widthOfTextAtSize(line + character, size) > width - indent && line) {
            draw(line);
            line = "";
          }
          if (line || character.trim()) line += character;
        }
      }
      draw(line);
    }
  };

  paragraph(title, 22);
  y -= 16;
  for (const section of sections) {
    if (!section.answers.length) continue;
    ensureSpace(64);
    paragraph(section.heading, 15);
    y -= 4;
    for (const answer of section.answers) {
      paragraph(`• ${answer}`, 12, 10);
      y -= 5;
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
