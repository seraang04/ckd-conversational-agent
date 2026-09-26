import { SCRIPT } from "./ckd-script.ts";
import {
  validateExplanation,
  type DimensionExplanation,
  type Explanation,
  type LinkText,
} from "./option-validation.ts";
import {
  OPTION_ORDER,
  dimensionLabel,
  optionLabel,
  statementsFor,
  type DimensionId,
} from "./treatment-options.ts";

// Builds the "how options differ on what matters to you" explanation. Facts are
// only ever KB statement ids; the AI may pick ids and write short bridge/link
// sentences, and anything it returns is validated before use.

export type PriorityInput = {
  dimension: DimensionId;
  evidence: { topic: string; label: string; rank?: number }[];
};

export type OptionsRequest = {
  priorities: PriorityInput[];
  allowGated: boolean;
  language: "en" | "zh";
  /** Free-text answers (question + answer) from the patient, for richer bridge phrasing. */
  patientContext?: { question: string; answer: string }[];
};

export type OptionsResult = { explanation: Explanation; source: "ai" | "template" };

/** Calls the model with the step's instructions; resolves to parsed JSON or null. */
export type AskAi = (input: string, schema: Record<string, unknown>) => Promise<unknown>;

const TEMPLATE_BRIDGE: LinkText = {
  en: "You told us this matters to you.",
  zh: "您说过这对您很重要。",
};

const MAX_SENTENCE_LENGTH = 200;

/** Every allowed statement for each option, with no AI wording. Always valid. */
export function buildTemplateExplanation(
  dimensions: readonly DimensionId[],
  { allowGated }: { allowGated: boolean },
): Explanation {
  return {
    dimensions: dimensions.map((dimension) => ({
      dimension,
      bridge: TEMPLATE_BRIDGE,
      options: OPTION_ORDER.map((option) => ({
        option,
        statementIds: statementsFor(option, dimension, { allowGated }).map((s) => s.id),
      })),
    })),
  };
}

/** Strict JSON schema where each dimension/option pair can only name its own statement ids. */
export function buildOptionsSchema(
  dimensions: readonly DimensionId[],
  allowGated: boolean,
): Record<string, unknown> {
  const optionSchema = (dimension: DimensionId) => ({
    anyOf: OPTION_ORDER.map((option) => ({
      type: "object",
      additionalProperties: false,
      required: ["option", "statementIds", "linkZh", "linkEn"],
      properties: {
        option: { type: "string", enum: [option] },
        statementIds: {
          type: "array",
          items: {
            type: "string",
            enum: statementsFor(option, dimension, { allowGated }).map((s) => s.id),
          },
        },
        linkZh: { type: "string" },
        linkEn: { type: "string" },
      },
    })),
  });
  return {
    type: "object",
    additionalProperties: false,
    required: ["dimensions"],
    properties: {
      dimensions: {
        type: "array",
        items: {
          anyOf: dimensions.map((dimension) => ({
            type: "object",
            additionalProperties: false,
            required: ["dimension", "bridgeZh", "bridgeEn", "options"],
            properties: {
              dimension: { type: "string", enum: [dimension] },
              bridgeZh: { type: "string" },
              bridgeEn: { type: "string" },
              options: { type: "array", items: optionSchema(dimension) },
            },
          })),
        },
      },
    },
  };
}

function choiceZh(topic: string, labelEn: string) {
  return SCRIPT.find((q) => q.id === topic)?.choices?.find((c) => c.en === labelEn)?.zh ?? "";
}

/** The data the model sees: what the patient chose, and the statements it may pick from. */
export function buildOptionsPrompt(request: OptionsRequest): string {
  return JSON.stringify(
    {
      patientLanguage: request.language,
      ...(request.patientContext?.length
        ? { patientContext: request.patientContext }
        : {}),
      dimensions: request.priorities.map(({ dimension, evidence }) => ({
        dimension,
        name: { en: dimensionLabel(dimension, "en"), zh: dimensionLabel(dimension, "zh") },
        patientChose: evidence.map((e) => ({
          question: e.topic,
          en: e.label,
          zh: choiceZh(e.topic, e.label),
          ...(e.rank ? { rank: e.rank } : {}),
        })),
        options: OPTION_ORDER.map((option) => ({
          option,
          name: { en: optionLabel(option, "en"), zh: optionLabel(option, "zh") },
          statements: statementsFor(option, dimension, { allowGated: request.allowGated }).map(
            (s) => ({ id: s.id, tag: s.tag, en: s.en, zh: s.zh }),
          ),
        })),
      })),
      output:
        "For each dimension, in the order given: bridgeZh/bridgeEn is one short sentence linking the patient's own choices to this dimension. Where patientContext is provided, you may draw on the patient's own words to make the bridge sentence more specific and personal — but never invent details not present in their answers. If a patient chose two options that are opposites on the same dimension (e.g. 'flexible schedule' and 'predictable routine'), do NOT list both as if equally held — instead, note the trade-off or prioritise whichever was ranked higher (lower rank number = more important). For each option, in the order given, choose statementIds from that option's statements only (at least one). linkZh/linkEn is optional: at most one short sentence, or an empty string.",
    },
    null,
    2,
  );
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Turn raw model output into an Explanation, collecting shape problems. */
function readAiExplanation(raw: unknown, problems: string[]): Explanation | null {
  if (!isRecord(raw) || !Array.isArray(raw["dimensions"])) {
    problems.push("AI output is not an object with a dimensions array");
    return null;
  }
  const dimensions: DimensionExplanation[] = [];
  for (const item of raw["dimensions"]) {
    if (!isRecord(item) || !Array.isArray(item["options"])) {
      problems.push("AI output has a malformed dimension");
      return null;
    }
    const dimension = text(item["dimension"]) as DimensionId;
    const bridge = { en: text(item["bridgeEn"]), zh: text(item["bridgeZh"]) };
    if (!bridge.en || !bridge.zh)
      problems.push(`${dimension}: bridge must be written in both languages`);
    const options: DimensionExplanation["options"] = [];
    for (const entry of item["options"]) {
      if (!isRecord(entry) || !Array.isArray(entry["statementIds"])) {
        problems.push(`${dimension}: AI output has a malformed option`);
        return null;
      }
      const ids = entry["statementIds"].map(text);
      if (new Set(ids).size !== ids.length) {
        problems.push(`${dimension} / ${text(entry["option"])}: repeats a statement`);
      }
      const link = { en: text(entry["linkEn"]), zh: text(entry["linkZh"]) };
      if (Boolean(link.en) !== Boolean(link.zh)) {
        problems.push(
          `${dimension} / ${text(entry["option"])}: link must be in both languages or neither`,
        );
      }
      for (const sentence of [link.en, link.zh]) {
        if (sentence.length > MAX_SENTENCE_LENGTH) {
          problems.push(`${dimension} / ${text(entry["option"])}: link is too long`);
        }
      }
      options.push({
        option: text(entry["option"]) as DimensionExplanation["options"][number]["option"],
        statementIds: ids,
        ...(link.en || link.zh ? { link } : {}),
      });
    }
    for (const sentence of [bridge.en, bridge.zh]) {
      if (sentence.length > MAX_SENTENCE_LENGTH) problems.push(`${dimension}: bridge is too long`);
    }
    dimensions.push({ dimension, bridge, options });
  }
  return { dimensions };
}

/**
 * Picking only the "helps" or only the "harder" statements for an option would
 * steer by omission, so when the KB has both for a pair the AI must keep both.
 */
function balanceProblems(explanation: Explanation, allowGated: boolean): string[] {
  const problems: string[] = [];
  for (const { dimension, options } of explanation.dimensions) {
    for (const { option, statementIds } of options) {
      if (!OPTION_ORDER.includes(option)) continue;
      const available = statementsFor(option, dimension, { allowGated });
      const chosen = available.filter((s) => statementIds.includes(s.id));
      for (const tag of ["helps", "harder"] as const) {
        if (available.some((s) => s.tag === tag) && !chosen.some((s) => s.tag === tag)) {
          problems.push(`${dimension} / ${option}: left out every "${tag}" statement`);
        }
      }
    }
  }
  return problems;
}

/**
 * The AI version when it is configured, answers within the timeout and passes
 * every check; otherwise the template. Problems are logged, never shown.
 */
export async function explainOptions(
  request: OptionsRequest,
  askAi: AskAi | null,
  {
    timeoutMs = 15000,
    log = console.warn,
  }: { timeoutMs?: number; log?: (...args: unknown[]) => void } = {},
): Promise<OptionsResult> {
  const dimensions = request.priorities.map((p) => p.dimension);
  const template: OptionsResult = {
    explanation: buildTemplateExplanation(dimensions, { allowGated: request.allowGated }),
    source: "template",
  };
  if (!dimensions.length) return template;
  if (!askAi) {
    log("[options-step] AI is not configured; using the template");
    return template;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let raw: unknown;
  try {
    raw = await Promise.race([
      askAi(buildOptionsPrompt(request), buildOptionsSchema(dimensions, request.allowGated)),
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
      }),
    ]);
  } catch (error) {
    log("[options-step] AI call failed; using the template:", error);
    return template;
  } finally {
    clearTimeout(timer);
  }
  if (raw === "timeout") {
    log(`[options-step] AI took longer than ${timeoutMs} ms; using the template`);
    return template;
  }

  const problems: string[] = [];
  const explanation = readAiExplanation(raw, problems);
  if (explanation) {
    problems.push(
      ...validateExplanation(explanation, { dimensions, allowGated: request.allowGated }),
      ...balanceProblems(explanation, request.allowGated),
    );
  }
  if (!explanation || problems.length) {
    log("[options-step] AI explanation rejected; using the template:", problems);
    return template;
  }
  return { explanation, source: "ai" };
}
