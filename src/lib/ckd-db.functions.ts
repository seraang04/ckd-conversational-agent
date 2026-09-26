import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// All conversation data access runs on the server. Direct browser access to the
// ckd_* tables is denied by RLS; a caller must know the session code (to read)
// or the session's random UUID (to write), both of which only the participant has.

const admin = async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const createConversationFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ language: z.enum(["zh", "en"]), stage: z.enum(["explore", "consent"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const code = makeCode();
      const { error } = await db.from("ckd_sessions").insert({
        code,
        patient_label: "Patient",
        language: data.language,
        stage: data.stage,
        readiness: "ready",
        consent_recording: false,
        consent_sharing: false,
      });
      if (!error) return { code };
      if (error.code !== "23505") break;
    }
    throw new Error("Could not create conversation");
  });

const sessionPatch = z
  .object({
    stage: z.string().max(40),
    updated_at: z.string().max(40),
    completed_at: z.string().max(40).nullable(),
    readiness: z.string().max(40),
    consent_recording: z.boolean(),
    consent_sharing: z.boolean(),
    language: z.string().max(10),
    patient_label: z.string().max(200),
    ckd_stage: z.string().max(40),
    key_issues: z.string().max(4000),
    assistant_role: z.string().max(40),
    assistant_name: z.string().max(200),
  })
  .partial()
  .strict();

export const updateConversationFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), patch: sessionPatch }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("ckd_sessions").update(data.patch).eq("id", data.id);
    if (error) throw new Error("Could not update conversation");
    return { ok: true };
  });

export const addConversationEntryFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        session_id: z.string().uuid(),
        speaker: z.string().max(40),
        topic: z.string().max(200),
        question: z.string().max(4000),
        answer: z.string().max(20000),
        visibility: z.string().max(40),
        input_mode: z.string().max(40),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("ckd_entries").insert(data);
    if (error) throw new Error("Could not save answer");
    return { ok: true };
  });

const list = z.array(z.string().max(4000)).max(200);
export const saveConversationSummaryFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            patient_priorities: list,
            caregiver_support: list,
            shared_concerns: list,
            differing_concerns: list,
            flagged_topics: list,
            clinician_summary: z.string().max(40000),
            confirmed: z.boolean(),
          })
          .partial(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db
      .from("ckd_summaries")
      .upsert(
        { session_id: data.id, ...data.patch, updated_at: new Date().toISOString() },
        { onConflict: "session_id" },
      );
    if (error) throw new Error("Could not save summary");
    return { ok: true };
  });

export const fetchSessionBundleFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ code: z.string().regex(/^[A-Za-z0-9]{6}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: session, error } = await db
      .from("ckd_sessions")
      .select("*")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (error) throw new Error("Could not load conversation");
    if (!session) return null;
    const [entries, summary] = await Promise.all([
      db.from("ckd_entries").select("*").eq("session_id", session.id).order("created_at", { ascending: true }),
      db.from("ckd_summaries").select("*").eq("session_id", session.id).maybeSingle(),
    ]);
    if (entries.error || summary.error) throw new Error("Could not load conversation");
    return { session, entries: entries.data ?? [], summary: summary.data ?? null };
  });
