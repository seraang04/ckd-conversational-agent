import type { Language } from "./language";
import {
  KB_DIMENSIONS,
  KB_OPTIONS,
  KB_STATEMENTS,
  KB_VERSION as GENERATED_KB_VERSION,
} from "./treatment-options.data.ts";

// Facts come only from docs/treatment-options-kb.md via the generated data file.
// If the markdown adds an option, dimension or tag, the assignments below stop
// type-checking until these unions are updated too.

export type OptionId = "pd" | "hd" | "tx" | "ckm";
export type DimensionId =
  | "independence"
  | "flexibility"
  | "work"
  | "travel"
  | "time"
  | "family"
  | "home"
  | "body"
  | "comfort"
  | "longevity"
  | "cost";
export type StatementTag = "helps" | "harder" | "practical" | "ask-team";

export type Statement = {
  readonly id: string;
  /** "common" statements apply to every option. */
  readonly option: OptionId | "common";
  /** null for option summaries and common statements that are not about a dimension. */
  readonly dimension: DimensionId | null;
  readonly tag: StatementTag;
  readonly en: string;
  readonly zh: string;
  readonly sources: readonly string[];
  /** Mentions living donation; only shown if the sensitive-topic gate allows it. */
  readonly gated: boolean;
};

type Labelled<Id> = { readonly id: Id; readonly en: string; readonly zh: string };

const OPTIONS: readonly Labelled<OptionId>[] = KB_OPTIONS;
const DIMENSIONS: readonly (Labelled<DimensionId> & { readonly questions: readonly string[] })[] =
  KB_DIMENSIONS;
const STATEMENTS: readonly Statement[] = KB_STATEMENTS;

export const KB_VERSION: string = GENERATED_KB_VERSION;

/** Fixed display order. Never reorder by what the patient said. */
export const OPTION_ORDER: readonly OptionId[] = ["pd", "hd", "tx", "ckm"];

/** Dimensions the chatbot may explain from approved statements. */
export const EXPLAINABLE_DIMENSIONS: readonly DimensionId[] = [
  "independence",
  "flexibility",
  "work",
  "travel",
  "time",
  "family",
  "home",
  "body",
  "comfort",
];

/** Dimensions that are always handed to the care team (ask-team). */
export const HANDOFF_DIMENSIONS: readonly DimensionId[] = ["longevity", "cost"];

export function statementsFor(
  option: OptionId,
  dimension: DimensionId,
  { allowGated }: { allowGated: boolean },
): Statement[] {
  return STATEMENTS.filter(
    (s) => s.option === option && s.dimension === dimension && (allowGated || !s.gated),
  );
}

export function statementById(id: string): Statement | undefined {
  return STATEMENTS.find((s) => s.id === id);
}

export function optionLabel(id: OptionId, language: Language): string {
  const option = OPTIONS.find((o) => o.id === id);
  return option ? option[language] : id;
}

export function dimensionLabel(id: DimensionId, language: Language): string {
  const dimension = DIMENSIONS.find((d) => d.id === id);
  return dimension ? dimension[language] : id;
}

/** App question ids that feed a dimension ("Fed by app questions" in the KB). */
export function dimensionQuestionIds(id: DimensionId): readonly string[] {
  return DIMENSIONS.find((d) => d.id === id)?.questions ?? [];
}
