import type { Language } from "./language";
import {
  EXPLAINABLE_DIMENSIONS,
  OPTION_ORDER,
  statementById,
  type DimensionId,
  type OptionId,
} from "./treatment-options.ts";

/** Wording that recommends or ranks an option. Add new phrases here. */
export const FORBIDDEN_PHRASES: Record<Language, readonly string[]> = {
  en: [
    "recommend",
    "best for you",
    "most suitable",
    "suits you best",
    "you should choose",
    "the right choice for you",
    "better option",
    "I suggest",
    "ideal for you",
    "fits you best",
  ],
  zh: [
    "建议您",
    "推荐",
    "最适合",
    "最好的选择",
    "您应该选择",
    "更好的选择",
    "比较适合您",
    "适合您",
  ],
};

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// English phrases match at a word start and may run on ("recommend" catches
// "recommended"); Chinese has no word breaks, so it matches anywhere.
const PATTERNS: Record<Language, { phrase: string; pattern: RegExp }[]> = {
  en: FORBIDDEN_PHRASES.en.map((phrase) => ({
    phrase,
    pattern: new RegExp(`\\b${escapeRegExp(phrase).replace(/ /g, "\\s+")}`, "i"),
  })),
  zh: FORBIDDEN_PHRASES.zh.map((phrase) => ({
    phrase,
    pattern: new RegExp(escapeRegExp(phrase)),
  })),
};

/** Forbidden phrases found in the text, as they appear in FORBIDDEN_PHRASES. */
export function findForbiddenPhrases(text: string, language: Language): string[] {
  return PATTERNS[language].filter(({ pattern }) => pattern.test(text)).map((p) => p.phrase);
}

/** Model-written text shown alongside approved statements. */
export type LinkText = { en: string; zh: string };

export type OptionExplanation = {
  option: OptionId;
  /** Approved KB statement ids, shown as written. */
  statementIds: string[];
  /** Optional sentence tying this option's statements to what the patient said. */
  link?: LinkText;
};

export type DimensionExplanation = {
  dimension: DimensionId;
  /** Optional opening that names what the patient said about this dimension. */
  bridge?: LinkText;
  options: OptionExplanation[];
};

export type Explanation = { dimensions: DimensionExplanation[] };

function checkText(text: LinkText | undefined, where: string, problems: string[]) {
  if (!text) return;
  for (const language of ["en", "zh"] as const) {
    // Check every text against both lists: Chinese text can contain English words.
    const found = [
      ...findForbiddenPhrases(text[language], "en"),
      ...findForbiddenPhrases(text[language], "zh"),
    ];
    if (found.length) {
      problems.push(`${where} (${language}) uses forbidden wording: ${found.join(", ")}`);
    }
  }
}

/** Problems with a model-built explanation; an empty list means it is safe to show. */
export function validateExplanation(
  explanation: Explanation,
  { dimensions, allowGated }: { dimensions: readonly DimensionId[]; allowGated: boolean },
): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const item of explanation.dimensions) {
    const d = item.dimension;
    if (!EXPLAINABLE_DIMENSIONS.includes(d)) {
      if (!seen.has(d)) {
        problems.push(`${d}: this dimension is for the care team and cannot be explained`);
      }
      seen.add(d);
      continue;
    }
    if (!dimensions.includes(d)) problems.push(`${d}: the patient did not raise this dimension`);
    if (seen.has(d)) problems.push(`${d}: appears more than once`);
    seen.add(d);
    checkText(item.bridge, `${d} bridge`, problems);

    const order = item.options.map((o) => o.option);
    for (const option of OPTION_ORDER) {
      const count = order.filter((o) => o === option).length;
      if (count === 0) problems.push(`${d}: option ${option} is missing`);
      if (count > 1) problems.push(`${d}: option ${option} appears ${count} times`);
    }
    for (const option of order) {
      if (!OPTION_ORDER.includes(option)) problems.push(`${d}: unknown option ${option}`);
    }
    if (order.join() !== OPTION_ORDER.join() && order.length === OPTION_ORDER.length) {
      problems.push(`${d}: options must be in the order ${OPTION_ORDER.join(", ")}`);
    }

    for (const entry of item.options) {
      const where = `${d} / ${entry.option}`;
      if (!entry.statementIds.length) problems.push(`${where}: needs at least one statement`);
      for (const id of entry.statementIds) {
        const statement = statementById(id);
        if (!statement) {
          problems.push(`${where}: unknown statement ${id}`);
        } else if (statement.option !== entry.option || statement.dimension !== d) {
          problems.push(`${where}: statement ${id} belongs to a different option or dimension`);
        } else if (statement.gated && !allowGated) {
          problems.push(`${where}: statement ${id} mentions living donation, which is not allowed`);
        }
      }
      checkText(entry.link, `${where} link`, problems);
    }
  }

  for (const d of dimensions) {
    if (seen.has(d)) continue;
    problems.push(
      EXPLAINABLE_DIMENSIONS.includes(d)
        ? `${d}: missing from the explanation`
        : `${d}: this dimension is for the care team and cannot be explained`,
    );
  }
  return problems;
}
