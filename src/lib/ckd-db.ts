import { supabase } from "@/integrations/supabase/client";

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

export async function fetchSessionBundle(code: string) {
  const { data: session, error } = await supabase
    .from("ckd_sessions")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  if (!session) return null;

  const [{ data: entries }, { data: summary }] = await Promise.all([
    supabase
      .from("ckd_entries")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true }),
    supabase.from("ckd_summaries").select("*").eq("session_id", session.id).maybeSingle(),
  ]);

  return {
    session: session as SessionRow,
    entries: (entries ?? []) as EntryRow[],
    summary: (summary ?? null) as SummaryRow | null,
  };
}

export async function fetchCompletedSessions() {
  const { data, error } = await supabase
    .from("ckd_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}
