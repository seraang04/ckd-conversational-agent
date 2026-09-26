import { SCRIPT } from "./ckd-script.ts";
import { parseGuidedAnswer, type SheetEntry } from "./decision-sheets.ts";
import { HANDOFF_DIMENSIONS, type DimensionId } from "./treatment-options.ts";

// Turns the patient's saved choice answers into the dimensions they care about,
// without AI. Only choice labels are read; free text is never interpreted here.

export type Strength = "high" | "medium" | "low";

export type Evidence = { topic: string; label: string; rank?: number };

export type ProfileItem = {
  dimension: DimensionId;
  strength: Strength;
  evidence: Evidence[];
  details: string[];
};

export type PatientProfile = {
  /** Up to 3 dimensions that can be explained, strongest first. */
  priorities: DimensionId[];
  /** Longevity and/or cost, if raised: always handed to the care team. */
  handoffs: DimensionId[];
  all: ProfileItem[];
};

type Mapping = { dimension: DimensionId; detail?: string };

/**
 * English choice label -> dimension, per question. Choices not listed (including
 * the exclusive "Not sure yet" / "No ..." answers) produce nothing.
 */
export const CHOICE_DIMENSIONS: Record<string, Record<string, Mapping>> = {
  "values-1": {
    "Staying independent": { dimension: "independence" },
    "Time with family": { dimension: "family" },
    "Continuing work or activities I enjoy": { dimension: "work" },
    "Feeling comfortable": { dimension: "comfort" },
  },
  "treatment-priorities": {
    "Fitting care around work, studies or other responsibilities": { dimension: "work" },
    "Keeping my daily schedule flexible": {
      dimension: "flexibility",
      detail: "prefers_flexible",
    },
    "Having a predictable routine that is easy to plan around": {
      dimension: "flexibility",
      detail: "prefers_routine",
    },
    "Being able to travel or stay away overnight": { dimension: "travel" },
    "Reducing the amount of time spent on care each day": { dimension: "time" },
    "Reducing the number of appointments or trips": { dimension: "time" },
    "Having my care team explain how different choices may affect how long I live": {
      dimension: "longevity",
    },
  },
  "treatment-independence": {
    "I would like to learn and manage as much day-to-day care as I can": {
      dimension: "independence",
      detail: "manage_myself",
    },
    "I would prefer the day-to-day care steps to be as simple as possible": {
      dimension: "independence",
      detail: "simple_steps",
    },
    "I am willing to manage some tasks with regular guidance from my care team": {
      dimension: "independence",
      detail: "some_with_guidance",
    },
    "I would prefer care staff to manage most care tasks": {
      dimension: "independence",
      detail: "staff_manage",
    },
    "How involved I want to be may change with how I am feeling": {
      dimension: "independence",
      detail: "varies",
    },
  },
  "treatment-location": {
    "I would prefer to receive most care at home if possible": {
      dimension: "home",
      detail: "prefers_home",
    },
    "I would feel safer at a clinic or care centre with staff nearby": {
      dimension: "home",
      detail: "prefers_centre",
    },
    "A mix of care at home and at a centre could work for me": { dimension: "home", detail: "mix" },
    "Space or storage at home is limited": { dimension: "home", detail: "home_limits" },
    "Household or family responsibilities could make care at home difficult": {
      dimension: "home",
      detail: "home_limits",
    },
  },
  "treatment-travel": {
    "Being able to travel or stay away overnight is important to me": { dimension: "travel" },
    "Frequent trips away from home would be difficult to arrange": { dimension: "time" },
    "Distance, cost or waiting time can make travel difficult": { dimension: "time" },
  },
  "treatment-mobility": {
    "I have some difficulty walking, standing or using stairs": { dimension: "body" },
    "I use a walking aid, walker or wheelchair": { dimension: "body" },
    "I sometimes need another person's help": { dimension: "body" },
    "My energy or mobility can change from day to day": { dimension: "body" },
  },
  "worries-1": {
    "How treatment may affect my body": { dimension: "body" },
    "Impact on family": { dimension: "family" },
    Costs: { dimension: "cost" },
  },
};

const STRENGTH_ORDER: Strength[] = ["high", "medium", "low"];

function rankStrength(rank: number): Strength {
  return rank === 1 ? "high" : rank <= 3 ? "medium" : "low";
}

export function buildPatientProfile(entries: readonly SheetEntry[]): PatientProfile {
  const items: ProfileItem[] = [];

  for (const entry of entries) {
    if (entry.speaker !== "patient" || entry.visibility !== "shared") continue;
    const mappings = CHOICE_DIMENSIONS[entry.topic];
    const question = SCRIPT.find((q) => q.id === entry.topic);
    if (!mappings || !question?.choices) continue;
    const ranking = question.answerKind === "ranking";

    const { selected } = parseGuidedAnswer(entry.answer, question);
    selected.forEach((index, position) => {
      const label = question.choices![index]!.en;
      const mapping = mappings[label];
      if (!mapping) return;
      const rank = position + 1;
      const strength = ranking ? rankStrength(rank) : "medium";
      const evidence: Evidence = ranking
        ? { topic: entry.topic, label, rank }
        : { topic: entry.topic, label };

      let item = items.find((i) => i.dimension === mapping.dimension);
      if (!item) {
        item = { dimension: mapping.dimension, strength, evidence: [], details: [] };
        items.push(item);
      }
      if (STRENGTH_ORDER.indexOf(strength) < STRENGTH_ORDER.indexOf(item.strength)) {
        item.strength = strength;
      }
      item.evidence.push(evidence);
      if (mapping.detail && !item.details.includes(mapping.detail)) {
        item.details.push(mapping.detail);
      }
    });
  }

  // Stable sort keeps first appearance within the same strength.
  const all = [...items].sort(
    (a, b) => STRENGTH_ORDER.indexOf(a.strength) - STRENGTH_ORDER.indexOf(b.strength),
  );
  return {
    priorities: all
      .filter((i) => !HANDOFF_DIMENSIONS.includes(i.dimension))
      .slice(0, 3)
      .map((i) => i.dimension),
    handoffs: all.filter((i) => HANDOFF_DIMENSIONS.includes(i.dimension)).map((i) => i.dimension),
    all,
  };
}
