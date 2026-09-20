import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EntrySchema = z.object({
  speaker: z.string(),
  question: z.string(),
  answer: z.string(),
  visibility: z.string(),
});

export type EntryInput = z.infer<typeof EntrySchema>;

/** Distress check so the app can offer a human, never counselling. */
export const checkDistress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ answer: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { aiJson, GUARDRAILS } = await import("./ai.server");
    const result = await aiJson<{ distressed: boolean }>(
      `${GUARDRAILS}
Decide only whether this person sounds seriously distressed, hopeless, or unsafe right now. Answer with JSON only.`,
      data.answer,
      "distress_check",
      {
        type: "object",
        additionalProperties: false,
        required: ["distressed"],
        properties: { distressed: { type: "boolean" } },
      },
    );
    return { distressed: result?.distressed ?? false };
  });

const SynthesisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "patient_priorities",
    "caregiver_support",
    "shared_concerns",
    "differing_concerns",
    "flagged_topics",
  ],
  properties: {
    patient_priorities: { type: "array", items: { type: "string" } },
    caregiver_support: { type: "array", items: { type: "string" } },
    shared_concerns: { type: "array", items: { type: "string" } },
    differing_concerns: { type: "array", items: { type: "string" } },
    flagged_topics: { type: "array", items: { type: "string" } },
  },
} as const;

export type Synthesis = {
  patient_priorities: string[];
  caregiver_support: string[];
  shared_concerns: string[];
  differing_concerns: string[];
  flagged_topics: string[];
};

export const buildSynthesis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        entries: z.array(EntrySchema),
        deferredTopics: z.array(z.string()),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<Synthesis> => {
    const { aiJson, GUARDRAILS } = await import("./ai.server");
    const transcript = data.entries
      .map(
        (e) =>
          `[${e.speaker}${e.visibility === "private" ? " · private" : ""}] Q: ${e.question}\nA: ${e.answer}`,
      )
      .join("\n\n");

    const result = await aiJson<Synthesis>(
      `${GUARDRAILS}
Organise the conversation into short bullet points. Keep the patient's own wording wherever possible.
- patient_priorities: what matters to the patient, from the patient's answers only.
- caregiver_support: what the caregiver can offer, and their limits, from caregiver answers only.
- shared_concerns: worries both raised.
- differing_concerns: where patient and caregiver see things differently.
- flagged_topics: unresolved or sensitive topics, named as a topic only, no private content.
Never merge patient and caregiver voices. Never suggest a treatment. Each bullet: Simplified Chinese, then " / " then short English.`,
      `Topics marked private or deferred for the renal coordinator, without answer content: ${
        data.deferredTopics.join(", ") || "none"
      }

${transcript}`,
      "synthesis",
      SynthesisSchema as unknown as Record<string, unknown>,
    );

    return (
      result ?? {
        patient_priorities: [],
        caregiver_support: [],
        shared_concerns: [],
        differing_concerns: [],
        flagged_topics: data.deferredTopics,
      }
    );
  });

export const buildClinicianSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        patientLabel: z.string(),
        ckdStage: z.string(),
        keyIssues: z.string(),
        patientPriorities: z.array(z.string()),
        caregiverSupport: z.array(z.string()),
        sharedConcerns: z.array(z.string()),
        differingConcerns: z.array(z.string()),
        flaggedTopics: z.array(z.string()),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { aiText, GUARDRAILS } = await import("./ai.server");
    const text = await aiText(
      `${GUARDRAILS}
Write a clinician-facing summary for the renal coordinator, readable in about one minute. Write it in English, with the patient's own Chinese phrases quoted where they are telling.
Use these headings exactly, as markdown level-3 headings: "From the patient", "From the caregiver", "Shared and differing concerns", "Needs follow-up".
Mark clearly what came from the patient and what came from the caregiver. List deferred or private topics by topic name only, keeping the patient or caregiver attribution. Do not recommend, rank or compare treatments. End with one line: "Prepared before consultation. Not a clinical recommendation."`,
      JSON.stringify(data, null, 2),
    );
    return { summary: text };
  });
