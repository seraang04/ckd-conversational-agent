import {
  type Color,
  type PDFFont,
  type PDFPage,
  PDFDocument,
  StandardFonts,
  rgb,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Sheet, SheetBlock } from "./decision-sheets.ts";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const DARK = rgb(0.12, 0.14, 0.16);
const GREY = rgb(0.5, 0.52, 0.55);
const LINE_GREY = rgb(0.78, 0.79, 0.81);
const WHITE = rgb(1, 1, 1);

const THEMES: Record<Sheet["kind"], { accent: Color; tint: Color }> = {
  patient: { accent: rgb(0.1, 0.4, 0.41), tint: rgb(0.92, 0.96, 0.95) },
  caregiver: { accent: rgb(0.22, 0.33, 0.56), tint: rgb(0.93, 0.95, 0.99) },
};

// A five-pointed star in a 24x24 box, used instead of a ★ glyph so it renders
// identically regardless of which fonts a viewer has installed.
const STAR_PATH =
  "M12 1.5 L14.77 8.35 L22.24 9.15 L16.62 14.06 L18.18 21.35 L12 17.62 L5.82 21.35 L7.38 14.06 L1.76 9.15 L9.23 8.35 Z";

const FIT_SCALES = [1, 0.92, 0.85, 0.78, 0.72];

function metrics(scale: number) {
  const s = (n: number) => n * scale;
  return {
    scale,
    headerHeight: s(58),
    headerTitleBaseline: s(28),
    headerSubtitleBaseline: s(45),
    titleSize: s(19),
    subtitleSize: s(11),
    identityTopGap: s(24),
    identityRowHeight: s(20),
    identityLabelSize: s(9.5),
    blockGap: s(9),
    sectionHeadingSize: s(12.5),
    sectionRuleGap: s(5),
    sectionAfterGap: s(6),
    bodySize: s(10),
    lineHeight: s(13.5),
    bulletIndent: s(14),
    fieldLabelSize: s(10),
    fieldRowGap: s(3),
    starLabelSize: s(10),
    starHeaderHeight: s(18),
    starRowHeight: s(21),
    starSize: s(11),
    starGap: s(3),
    starNoteSize: s(9),
    starCaptionSize: s(8.5),
    starCaptionGap: s(6),
    checkboxSize: s(10),
    checkboxRowHeight: s(19),
    checkboxLabelSize: s(10),
    gridHeaderHeight: s(20),
    gridRowHeight: s(20),
    gridLabelSize: s(9.5),
    circleRadius: s(4.5),
    ruleLineGap: s(22),
    noteSize: s(9),
    footerPadding: s(10),
    footerTextSize: s(9.5),
    // treatment-comparison block
    tcDimHeadingSize: s(10),
    tcDimHeadingGap: s(5),
    tcOptionLabelSize: s(9),
    tcBarHeight: s(7),
    tcBarGap: s(3),
    tcCountSize: s(8),
    tcStatementSize: s(8),
    tcStatementLineHeight: s(11),
    tcOptionGap: s(6),
    tcDimGap: s(8),
  };
}

type Metrics = ReturnType<typeof metrics>;

type Fonts = {
  cjk: PDFFont;
  latin: PDFFont;
  latinBold: PDFFont;
  latinCharacters: Set<number>;
};

function runsFor(fonts: Fonts, text: string, bold: boolean) {
  const result: { text: string; font: PDFFont }[] = [];
  for (const character of text) {
    const selected = fonts.latinCharacters.has(character.codePointAt(0)!)
      ? bold
        ? fonts.latinBold
        : fonts.latin
      : fonts.cjk;
    const last = result[result.length - 1];
    if (last?.font === selected) last.text += character;
    else result.push({ text: character, font: selected });
  }
  return result;
}

function measureText(fonts: Fonts, text: string, size: number, bold: boolean) {
  return runsFor(fonts, text, bold).reduce(
    (total, run) => total + run.font.widthOfTextAtSize(run.text, size),
    0,
  );
}

// Keep Latin words together; Chinese and oversized words can wrap per character.
const WORD_TOKENS = /[\p{Script=Latin}\p{Number}]+(?:['’][\p{Script=Latin}\p{Number}]+)*|[^\p{Script=Latin}\p{Number}]/gu;

function wrapText(fonts: Fonts, text: string, size: number, bold: boolean, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const part of text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    let line = "";
    for (const token of part.match(WORD_TOKENS) ?? []) {
      if (measureText(fonts, line + token, size, bold) > maxWidth && line) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const character of token) {
        if (measureText(fonts, line + character, size, bold) > maxWidth && line) {
          lines.push(line);
          line = "";
        }
        if (line || character.trim()) line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawRun(
  page: PDFPage,
  x: number,
  y: number,
  text: string,
  size: number,
  bold: boolean,
  color: Color,
  fonts: Fonts,
) {
  let cx = x;
  for (const run of runsFor(fonts, text, bold)) {
    page.drawText(run.text, { x: cx, y, size, font: run.font, color });
    cx += run.font.widthOfTextAtSize(run.text, size);
  }
  return cx;
}

// Labels are bilingual, so a Chinese-ending label gets a fullwidth colon.
function colonFor(label: string) {
  return /[一-鿿]$/.test(label) ? "：" : ":";
}

/**
 * Lays out and draws one sheet on a fresh document, returning how many pages
 * it took. Callers re-run this at a smaller scale until it fits on one page.
 */
function renderSheet(pdf: PDFDocument, sheet: Sheet, fonts: Fonts, m: Metrics) {
  const theme = THEMES[sheet.kind];
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let pageCount = 1;
  let y = PAGE_HEIGHT;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageCount += 1;
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensureSpace = (height: number) => {
    if (y - height < MARGIN) newPage();
  };
  const advance = (height: number) => {
    ensureSpace(height);
    y -= height;
  };
  const underline = (x: number, width: number, atY: number) => {
    page.drawLine({
      start: { x, y: atY },
      end: { x: x + width, y: atY },
      thickness: 0.75,
      color: LINE_GREY,
    });
  };

  // ---- Header ----
  // A sheet without a subtitle gets a shorter bar, sized down by exactly the
  // gap the subtitle line would have used, so there's no dead colour band.
  const hasSubtitle = sheet.subtitle.trim().length > 0;
  const headerHeight = hasSubtitle
    ? m.headerHeight
    : m.headerHeight - (m.headerSubtitleBaseline - m.headerTitleBaseline);
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - headerHeight,
    width: PAGE_WIDTH,
    height: headerHeight,
    color: theme.accent,
  });
  drawRun(
    page,
    MARGIN,
    PAGE_HEIGHT - m.headerTitleBaseline,
    sheet.title,
    m.titleSize,
    true,
    WHITE,
    fonts,
  );
  if (hasSubtitle) {
    drawRun(
      page,
      MARGIN,
      PAGE_HEIGHT - m.headerSubtitleBaseline,
      sheet.subtitle,
      m.subtitleSize,
      false,
      WHITE,
      fonts,
    );
  }
  y = PAGE_HEIGHT - headerHeight - m.identityTopGap;

  // ---- Identity ----
  if (sheet.identity.length) {
    advance(m.identityRowHeight);
    const columnWidth = CONTENT_WIDTH / sheet.identity.length;
    sheet.identity.forEach((field, index) => {
      const x = MARGIN + index * columnWidth;
      const label = `${field.label}${colonFor(field.label)}`;
      const labelWidth = measureText(fonts, label, m.identityLabelSize, true);
      drawRun(page, x, y, label, m.identityLabelSize, true, DARK, fonts);
      const valueX = x + labelWidth + 4;
      const valueWidth = columnWidth - labelWidth - 12;
      if (field.value.trim()) {
        drawRun(page, valueX, y, field.value, m.identityLabelSize, false, DARK, fonts);
      } else if (valueWidth > 8) {
        underline(valueX, valueWidth, y - 1);
      }
    });
  }

  // ---- Blocks ----
  const drawSection = (heading: string) => {
    advance(m.sectionHeadingSize * 1.25);
    drawRun(page, MARGIN, y, heading, m.sectionHeadingSize, true, theme.accent, fonts);
    advance(m.sectionRuleGap);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_WIDTH, y },
      thickness: 1,
      color: theme.accent,
    });
    y -= m.sectionAfterGap;
  };

  const drawBullets = (items: string[], blankLines: number) => {
    const textX = MARGIN + m.bulletIndent;
    const maxWidth = CONTENT_WIDTH - m.bulletIndent;
    if (!items.length) {
      for (let i = 0; i < blankLines; i++) {
        advance(m.lineHeight);
        underline(MARGIN, CONTENT_WIDTH, y);
      }
      return;
    }
    for (const item of items) {
      const lines = wrapText(fonts, item, m.bodySize, false, maxWidth);
      lines.forEach((line, index) => {
        advance(m.lineHeight);
        if (index === 0) {
          page.drawCircle({ x: MARGIN + 3, y: y + m.bodySize * 0.32, size: 1.6, color: theme.accent });
        }
        drawRun(page, textX, y, line, m.bodySize, false, DARK, fonts);
      });
    }
    advance(m.lineHeight);
    underline(MARGIN, CONTENT_WIDTH, y);
  };

  const drawFields = (rows: { label: string; value: string }[]) => {
    const labelWidth = Math.min(
      Math.max(
        ...rows.map((row) => measureText(fonts, `${row.label}${colonFor(row.label)}`, m.fieldLabelSize, true)),
        CONTENT_WIDTH * 0.3,
      ),
      CONTENT_WIDTH * 0.42,
    );
    const valueX = MARGIN + labelWidth + 8;
    const valueWidth = CONTENT_WIDTH - labelWidth - 8;
    for (const row of rows) {
      const label = `${row.label}${colonFor(row.label)}`;
      const value = row.value.trim();
      const lines = value ? wrapText(fonts, value, m.fieldLabelSize, false, valueWidth) : [""];
      lines.forEach((line, index) => {
        advance(m.lineHeight);
        if (index === 0) drawRun(page, MARGIN, y, label, m.fieldLabelSize, true, DARK, fonts);
        if (line) drawRun(page, valueX, y, line, m.fieldLabelSize, false, DARK, fonts);
        else if (index === 0) underline(valueX, valueWidth, y - 1);
      });
      advance(m.fieldRowGap);
    }
  };

  const drawStars = (
    columns: [string, string],
    rows: { label: string; stars: number | null; note: string }[],
    caption: string,
  ) => {
    const starsX = MARGIN + CONTENT_WIDTH * 0.5;
    const noteX = starsX + 5 * (m.starSize + m.starGap) + 8;
    advance(m.starHeaderHeight);
    page.drawRectangle({
      x: MARGIN,
      y,
      width: CONTENT_WIDTH,
      height: m.starHeaderHeight,
      color: theme.tint,
    });
    drawRun(page, MARGIN + 6, y + m.starHeaderHeight * 0.3, columns[0], m.starLabelSize, true, DARK, fonts);
    drawRun(page, starsX, y + m.starHeaderHeight * 0.3, columns[1], m.starLabelSize, true, DARK, fonts);

    for (const row of rows) {
      advance(m.starRowHeight);
      const starTopY = y + (m.starRowHeight + m.starSize) / 2;
      drawRun(page, MARGIN + 6, y + m.starRowHeight * 0.32, row.label, m.starLabelSize, false, DARK, fonts);
      for (let i = 0; i < 5; i++) {
        const filled = row.stars !== null && i < row.stars;
        const x = starsX + i * (m.starSize + m.starGap);
        page.drawSvgPath(STAR_PATH, {
          x,
          y: starTopY,
          scale: m.starSize / 24,
          ...(filled ? { color: theme.accent } : { borderColor: LINE_GREY, borderWidth: 0.75 }),
        });
      }
      if (row.note) {
        drawRun(page, noteX, y + m.starRowHeight * 0.32, row.note, m.starNoteSize, false, GREY, fonts);
      }
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + CONTENT_WIDTH, y },
        thickness: 0.5,
        color: LINE_GREY,
      });
    }
    advance(m.starCaptionGap);
    const captionLines = wrapText(fonts, caption, m.starCaptionSize, false, CONTENT_WIDTH);
    for (const line of captionLines) {
      advance(m.starCaptionSize * 1.3);
      drawRun(page, MARGIN, y, line, m.starCaptionSize, false, GREY, fonts);
    }
  };

  const drawTick = (x: number, boxY: number, size: number) => {
    page.drawLine({
      start: { x: x + size * 0.18, y: boxY + size * 0.5 },
      end: { x: x + size * 0.42, y: boxY + size * 0.22 },
      thickness: 1.1,
      color: theme.accent,
    });
    page.drawLine({
      start: { x: x + size * 0.42, y: boxY + size * 0.22 },
      end: { x: x + size * 0.85, y: boxY + size * 0.82 },
      thickness: 1.1,
      color: theme.accent,
    });
  };

  const drawCheckboxes = (items: { label: string; checked: boolean }[]) => {
    // Columns are laid out as one block so the two columns stay aligned;
    // long checkbox groups are expected to fit within a single page.
    const columns = items.length > 2 ? 2 : 1;
    const columnWidth = CONTENT_WIDTH / columns;
    const rowsPerColumn = Math.ceil(items.length / columns);
    const maxTextWidth = columnWidth - m.checkboxSize - 10;
    const heights = items.map((item) =>
      Math.max(
        m.checkboxRowHeight,
        wrapText(fonts, item.label, m.checkboxLabelSize, false, maxTextWidth).length * m.lineHeight,
      ),
    );
    const columnHeights = Array.from({ length: columns }, (_, column) => {
      let total = 0;
      for (let row = 0; row < rowsPerColumn; row++) {
        const height = heights[column * rowsPerColumn + row];
        if (height !== undefined) total += height;
      }
      return total;
    });
    const blockHeight = Math.max(...columnHeights);
    ensureSpace(blockHeight);
    const top = y;
    for (let column = 0; column < columns; column++) {
      let localY = top;
      const columnX = MARGIN + column * columnWidth;
      for (let row = 0; row < rowsPerColumn; row++) {
        const index = column * rowsPerColumn + row;
        const item = items[index];
        if (!item) continue;
        const rowHeight = heights[index]!;
        localY -= rowHeight;
        const boxY = localY + (rowHeight - m.checkboxSize) / 2;
        page.drawSquare({
          x: columnX,
          y: boxY,
          size: m.checkboxSize,
          borderColor: DARK,
          borderWidth: 1,
        });
        if (item.checked) drawTick(columnX, boxY, m.checkboxSize);
        const lines = wrapText(fonts, item.label, m.checkboxLabelSize, false, maxTextWidth);
        lines.forEach((line, lineIndex) => {
          drawRun(
            page,
            columnX + m.checkboxSize + 8,
            localY + rowHeight - m.lineHeight * (lineIndex + 1) + m.lineHeight * 0.22,
            line,
            m.checkboxLabelSize,
            false,
            DARK,
            fonts,
          );
        });
      }
    }
    y = top - blockHeight;
  };

  const drawGrid = (columns: string[], rows: string[], selected: (number | null)[]) => {
    const labelWidth = CONTENT_WIDTH * 0.34;
    const colWidth = (CONTENT_WIDTH - labelWidth) / columns.length;
    advance(m.gridHeaderHeight);
    page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: m.gridHeaderHeight, color: theme.tint });
    columns.forEach((label, index) => {
      const cx = MARGIN + labelWidth + index * colWidth + colWidth / 2;
      const textWidth = measureText(fonts, label, m.gridLabelSize, true);
      drawRun(page, cx - textWidth / 2, y + m.gridHeaderHeight * 0.32, label, m.gridLabelSize, true, DARK, fonts);
    });
    rows.forEach((rowLabel, rowIndex) => {
      const lines = wrapText(fonts, rowLabel, m.gridLabelSize, false, labelWidth - 6);
      const rowHeight = Math.max(m.gridRowHeight, lines.length * m.lineHeight);
      advance(rowHeight);
      lines.forEach((line, index) => {
        drawRun(
          page,
          MARGIN,
          y + rowHeight - m.lineHeight * (index + 1) + m.lineHeight * 0.22,
          line,
          m.gridLabelSize,
          false,
          DARK,
          fonts,
        );
      });
      columns.forEach((_, index) => {
        const cx = MARGIN + labelWidth + index * colWidth + colWidth / 2;
        const filled = selected[rowIndex] === index;
        page.drawCircle({
          x: cx,
          y: y + rowHeight / 2,
          size: m.circleRadius,
          ...(filled ? { color: theme.accent } : { borderColor: GREY, borderWidth: 1 }),
        });
      });
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: MARGIN + CONTENT_WIDTH, y },
        thickness: 0.5,
        color: LINE_GREY,
      });
    });
  };

  const drawLines = (count: number) => {
    for (let i = 0; i < count; i++) {
      advance(m.ruleLineGap);
      underline(MARGIN, CONTENT_WIDTH, y);
    }
  };

  const drawNote = (note: string) => {
    const maxWidth = CONTENT_WIDTH - m.bulletIndent;
    const lines = wrapText(fonts, note, m.noteSize, false, maxWidth);
    for (const line of lines) {
      advance(m.noteSize * 1.4);
      drawRun(page, MARGIN + m.bulletIndent, y, line, m.noteSize, false, GREY, fonts);
    }
  };

  const PRO_COLOR = rgb(0.18, 0.52, 0.44);
  const CON_COLOR = rgb(0.78, 0.79, 0.81);

  /** Measure how tall one option column would be, given a colWidth. */
  const measureOptionHeight = (
    opt: { prosCount: number; consCount: number; statements: { tag: string; text: string }[] },
    barWidth: number,
  ): number => {
    let h = m.tcOptionLabelSize * 1.4;
    h += m.tcBarHeight + m.tcBarGap;
    h += m.tcCountSize * 1.3;
    for (const stmt of opt.statements) {
      const lines = wrapText(fonts, stmt.text, m.tcStatementSize, false, barWidth - 10);
      h += lines.length * m.tcStatementLineHeight;
    }
    return h;
  };

  /** Draw one option at a given (x, startY), moving downward. Returns the final y. */
  const drawOption = (
    opt: { optionLabel: string; prosCount: number; consCount: number; statements: { tag: "helps" | "harder" | "practical"; text: string }[] },
    x: number,
    startY: number,
    barWidth: number,
  ): number => {
    let localY = startY;
    const total = opt.prosCount + opt.consCount;

    localY -= m.tcOptionLabelSize * 1.4;
    drawRun(page, x, localY, opt.optionLabel, m.tcOptionLabelSize, true, DARK, fonts);

    localY -= m.tcBarHeight + m.tcBarGap;
    page.drawRectangle({ x, y: localY, width: barWidth, height: m.tcBarHeight, color: CON_COLOR });
    if (total > 0 && opt.prosCount > 0) {
      const proWidth = Math.round((opt.prosCount / total) * barWidth);
      page.drawRectangle({ x, y: localY, width: proWidth, height: m.tcBarHeight, color: PRO_COLOR });
    }

    localY -= m.tcCountSize * 1.3;
    const countLabel =
      opt.prosCount > 0 && opt.consCount > 0
        ? `${opt.prosCount} pros · ${opt.consCount} cons`
        : opt.prosCount > 0
          ? `${opt.prosCount} pros`
          : opt.consCount > 0
            ? `${opt.consCount} cons`
            : "—";
    drawRun(page, x, localY, countLabel, m.tcCountSize, false, GREY, fonts);

    const helps = opt.statements.filter((s) => s.tag === "helps");
    const practical = opt.statements.filter((s) => s.tag === "practical");
    const harder = opt.statements.filter((s) => s.tag === "harder");
    for (const stmt of [...helps, ...practical, ...harder]) {
      const prefix = stmt.tag === "harder" ? "– " : "+ ";
      const prefixColor = stmt.tag === "harder" ? GREY : PRO_COLOR;
      const textColor = stmt.tag === "harder" ? GREY : DARK;
      const lines = wrapText(fonts, stmt.text, m.tcStatementSize, false, barWidth - 10);
      for (let li = 0; li < lines.length; li++) {
        localY -= m.tcStatementLineHeight;
        if (li === 0) {
          drawRun(page, x, localY, prefix, m.tcStatementSize, false, prefixColor, fonts);
          drawRun(page, x + 8, localY, lines[li]!, m.tcStatementSize, false, textColor, fonts);
        } else {
          drawRun(page, x + 8, localY, lines[li]!, m.tcStatementSize, false, textColor, fonts);
        }
      }
    }
    return localY;
  };

  const drawTreatmentComparison = (
    block: Extract<import("./decision-sheets.ts").SheetBlock, { type: "treatment-comparison" }>,
  ) => {
    const colWidth = CONTENT_WIDTH / 2;
    const barWidth = colWidth - 12;

    const drawOptionsGrid = (
      options: { optionLabel: string; prosCount: number; consCount: number; statements: { tag: "helps" | "harder" | "practical"; text: string }[] }[],
    ) => {
      for (let row = 0; row < 2; row++) {
        const leftOpt = options[row * 2];
        const rightOpt = options[row * 2 + 1];

        const leftHeight = leftOpt ? measureOptionHeight(leftOpt, barWidth) : 0;
        const rightHeight = rightOpt ? measureOptionHeight(rightOpt, barWidth) : 0;
        const rowHeight = Math.max(leftHeight, rightHeight);

        ensureSpace(rowHeight + m.tcOptionGap);
        const rowStartY = y;

        if (leftOpt) drawOption(leftOpt, MARGIN, rowStartY, barWidth);
        if (rightOpt) drawOption(rightOpt, MARGIN + colWidth, rowStartY, barWidth);

        y = rowStartY - rowHeight;

        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: MARGIN + CONTENT_WIDTH, y },
          thickness: 0.5,
          color: LINE_GREY,
        });
        y -= m.tcOptionGap;
      }
    };

    // Overall summary — replaces per-dimension breakdown
    const isChinese = /[一-鿿]/.test(sheet.title);
    const aggregateHeading = isChinese ? "综合概览" : "Overall summary";

    advance(m.tcDimHeadingSize * 1.3);
    drawRun(page, MARGIN, y, aggregateHeading, m.tcDimHeadingSize, true, theme.accent, fonts);
    advance(m.tcDimHeadingGap);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_WIDTH, y },
      thickness: 0.5,
      color: LINE_GREY,
    });

    drawOptionsGrid(block.aggregate);
  };

  const drawBlock = (block: SheetBlock) => {
    advance(m.blockGap);
    switch (block.type) {
      case "section":
        drawSection(block.heading);
        break;
      case "bullets":
        drawBullets(block.items, block.blankLines);
        break;
      case "fields":
        drawFields(block.rows);
        break;
      case "stars":
        drawStars(block.columns, block.rows, block.caption);
        break;
      case "checkboxes":
        drawCheckboxes(block.items);
        break;
      case "grid":
        drawGrid(block.columns, block.rows, block.selected);
        break;
      case "lines":
        drawLines(block.count);
        break;
      case "note":
        drawNote(block.text);
        break;
      case "treatment-comparison":
        drawTreatmentComparison(block);
        break;
    }
  };

  for (const block of sheet.blocks) drawBlock(block);

  // ---- Footer ----
  const footerLines = wrapText(fonts, sheet.footer, m.footerTextSize, false, CONTENT_WIDTH - m.footerPadding * 2);
  const footerHeight = footerLines.length * (m.footerTextSize * 1.35) + m.footerPadding * 2;
  advance(footerHeight + m.blockGap);
  const footerTop = y + footerHeight;
  page.drawRectangle({
    x: MARGIN,
    y,
    width: CONTENT_WIDTH,
    height: footerHeight,
    color: theme.tint,
    borderColor: theme.accent,
    borderWidth: 1,
  });
  let footerY = footerTop - m.footerPadding - m.footerTextSize;
  for (const line of footerLines) {
    drawRun(page, MARGIN + m.footerPadding, footerY, line, m.footerTextSize, false, DARK, fonts);
    footerY -= m.footerTextSize * 1.35;
  }

  return pageCount;
}

export async function createSheetPdf(sheet: Sheet, fontBytes: ArrayBuffer): Promise<Uint8Array> {
  let lastResult: { pdf: PDFDocument; pageCount: number } | null = null;
  for (const scale of FIT_SCALES) {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    // Preserve the CJK OpenType font's glyph IDs. Subsetting this CFF font can
    // make PDF viewers display unrelated glyphs instead of the summary text.
    const cjk = await pdf.embedFont(fontBytes, { subset: false });
    const latin = await pdf.embedFont(StandardFonts.Helvetica);
    const latinBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const latinCharacters = new Set(latin.getCharacterSet());
    pdf.setTitle(sheet.title);

    const pageCount = renderSheet(pdf, sheet, { cjk, latin, latinBold, latinCharacters }, metrics(scale));
    lastResult = { pdf, pageCount };
    if (pageCount <= 1) break;
  }
  return lastResult!.pdf.save();
}

// The CJK font is large, so it's fetched once and reused for every preview.
let fontBytes: Promise<ArrayBuffer> | null = null;

function loadFont() {
  fontBytes ??= fetch(`${import.meta.env.BASE_URL}fonts/NotoSansCJKsc-Regular.otf`).then(
    (response) => {
      if (!response.ok) throw new Error("Could not load PDF font");
      return response.arrayBuffer();
    },
  );
  fontBytes.catch(() => {
    fontBytes = null;
  });
  return fontBytes;
}

export async function sheetPdfBlob(sheet: Sheet): Promise<Blob> {
  const bytes = await createSheetPdf(sheet, await loadFont());
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export function prefetchPdfAssets() {
  loadFont();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
