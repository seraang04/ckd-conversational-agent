import { OPTIONS_QUESTION_TOPIC, OPTIONS_SHOWN_TOPIC, optionsReactionTopic } from "./ckd-script.ts";
import {
  EXPLAINABLE_DIMENSIONS,
  KB_VERSION,
  dimensionLabel,
  type DimensionId,
} from "./treatment-options.ts";

// The options step saves one "options-shown" entry recording what it showed.
// It is data about the app, not something the patient said, so it is kept out
// of the transcript, summaries and sheets, and only read back here.

type Entry = { speaker: string; topic: string; answer: string; visibility: string };

export type OptionsShown = {
  kbVersion: string;
  source: "ai" | "template";
  priorities: DimensionId[];
};

export type OptionsInformation = {
  shown: OptionsShown | null;
  reactions: { dimension: DimensionId; answer: string }[];
  questions: string[];
};

export const OPTIONS_SHOWN_QUESTION = {
  id: OPTIONS_SHOWN_TOPIC,
  zh: "Options step",
  en: "Options step",
};

export function isOptionsShownEntry(entry: Pick<Entry, "topic">): boolean {
  return entry.topic === OPTIONS_SHOWN_TOPIC;
}

export function buildOptionsShownAnswer(
  source: OptionsShown["source"],
  priorities: readonly DimensionId[],
): string {
  return JSON.stringify({ kbVersion: KB_VERSION, source, priorities });
}

const patientShared = (e: Entry) =>
  e.speaker === "patient" && e.visibility === "shared" && e.answer.trim() !== "";

/** The latest "options-shown" record, or null if there is none or it is unreadable. */
export function readOptionsShown(entries: readonly Entry[]): OptionsShown | null {
  const entry = entries.filter((e) => patientShared(e) && isOptionsShownEntry(e)).at(-1);
  if (!entry) return null;
  try {
    const value = JSON.parse(entry.answer) as Record<string, unknown>;
    const priorities = Array.isArray(value["priorities"])
      ? value["priorities"].filter((d): d is DimensionId =>
          (EXPLAINABLE_DIMENSIONS as readonly unknown[]).includes(d),
        )
      : [];
    return {
      kbVersion: typeof value["kbVersion"] === "string" ? value["kbVersion"] : "",
      source: value["source"] === "ai" ? "ai" : "template",
      priorities,
    };
  } catch {
    return null;
  }
}

/** What the options step showed plus the patient's shared reactions and questions. */
export function readOptionsInformation(entries: readonly Entry[]): OptionsInformation | null {
  const shared = entries.filter(patientShared);
  const info: OptionsInformation = {
    shown: readOptionsShown(entries),
    reactions: EXPLAINABLE_DIMENSIONS.flatMap((dimension) =>
      shared
        .filter((e) => e.topic === optionsReactionTopic(dimension))
        .map((e) => ({ dimension, answer: e.answer.trim() })),
    ),
    questions: shared.filter((e) => e.topic === OPTIONS_QUESTION_TOPIC).map((e) => e.answer.trim()),
  };
  return info.shown || info.reactions.length || info.questions.length ? info : null;
}

/** Clinician-summary lines for the "Options information shown" section, in English. */
export function optionsInformationLines(info: OptionsInformation | null): string[] {
  if (!info) return [];
  const lines = ["Options information shown"];
  if (info.shown) {
    const priorities = info.shown.priorities.map((d) => dimensionLabel(d, "en"));
    lines.push(`Priorities used: ${priorities.join(", ") || "none"}`);
    lines.push(
      `Content: approved knowledge base ${info.shown.kbVersion || "(unknown version)"}, ${
        info.shown.source === "ai" ? "AI-selected and validated" : "standard template"
      }`,
    );
  }
  for (const { dimension, answer } of info.reactions) {
    lines.push(`Patient reaction (${dimensionLabel(dimension, "en")}): ${answer}`);
  }
  for (const question of info.questions) lines.push(`Patient question: ${question}`);
  return lines;
}
