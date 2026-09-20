import { supabase } from "@/integrations/supabase/client";
import type { Language } from "@/lib/language";

export type SessionRow = {
  id: string;
  code: string;
  patient_label: string;
  ckd_stage: string;
  language: string;
  key_issues: string;
  assistant_role: string;
  assistant_name: string;
  consent_recording: boolean;
  consent_sharing: boolean;
  readiness: string;
  stage: string;
  created_at: string;
  completed_at: string | null;
};

export type EntryRow = {
  id: string;
  session_id: string;
  speaker: string;
  topic: string;
  question: string;
  answer: string;
  visibility: string;
  input_mode: string;
  created_at: string;
};

export type SummaryRow = {
  id: string;
  session_id: string;
  patient_priorities: string[];
  caregiver_support: string[];
  shared_concerns: string[];
  differing_concerns: string[];
  flagged_topics: string[];
  clinician_summary: string;
  confirmed: boolean;
};

export function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

const backendUrl = import.meta.env["VITE_SUPABASE_URL"] ?? "";
const serviceConfigured = Boolean(backendUrl && import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
export const localBackend = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(backendUrl);
export const serviceUnavailable = !serviceConfigured;

function requireService() {
  if (serviceUnavailable) throw new Error("Conversation service is not configured for this run");
}

export async function createConversation(language: Language) {
  requireService();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = makeCode();
    const { error } = await supabase.from("ckd_sessions").insert({
      code,
      patient_label: "Patient",
      language,
      stage: localBackend ? "explore" : "consent",
      readiness: "ready",
      consent_recording: false,
      consent_sharing: false,
    });
    if (!error) return code;
    if (error.code !== "23505" || attempt === 2) throw error;
  }
  throw new Error("Could not create conversation");
}

export async function updateConversation(id: string, patch: Record<string, unknown>) {
  requireService();
  const { error } = await supabase
    .from("ckd_sessions")
    .update(patch as Partial<SessionRow>)
    .eq("id", id);
  if (error) throw error;
}

export async function addConversationEntry(entry: Omit<EntryRow, "id" | "created_at">) {
  requireService();
  const { error } = await supabase.from("ckd_entries").insert(entry);
  if (error) throw error;
}

export async function saveConversationSummary(id: string, patch: Partial<SummaryRow>) {
  requireService();
  const { error } = await supabase
    .from("ckd_summaries")
    .upsert(
      { session_id: id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "session_id" },
    );
  if (error) throw error;
}

export async function fetchSessionBundle(code: string) {
  requireService();
  const { data: session, error } = await supabase
    .from("ckd_sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const [entriesResult, summaryResult] = await Promise.all([
    supabase
      .from("ckd_entries")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true }),
    supabase.from("ckd_summaries").select("*").eq("session_id", session.id).maybeSingle(),
  ]);
  if (entriesResult.error) throw entriesResult.error;
  if (summaryResult.error) throw summaryResult.error;

  return {
    session: session as SessionRow,
    entries: (entriesResult.data ?? []) as EntryRow[],
    summary: (summaryResult.data ?? null) as SummaryRow | null,
  };
}

export async function fetchCompletedSessions() {
  requireService();
  const { data, error } = await supabase
    .from("ckd_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}
