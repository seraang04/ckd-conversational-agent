import {
  addConversationEntryFn,
  createConversationFn,
  fetchSessionBundleFn,
  saveConversationSummaryFn,
  updateConversationFn,
} from "@/lib/ckd-db.functions";
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
  const { code } = await createConversationFn({
    data: { language, stage: localBackend ? "explore" : "consent" },
  });
  return code;
}

export async function updateConversation(id: string, patch: Record<string, unknown>) {
  requireService();
  await updateConversationFn({ data: { id, patch: patch as never } });
}

export async function addConversationEntry(entry: Omit<EntryRow, "id" | "created_at">) {
  requireService();
  await addConversationEntryFn({ data: entry });
}

export async function saveConversationSummary(id: string, patch: Partial<SummaryRow>) {
  requireService();
  await saveConversationSummaryFn({ data: { id, patch: patch as never } });
}

export async function fetchSessionBundle(code: string) {
  requireService();
  const bundle = await fetchSessionBundleFn({ data: { code } });
  if (!bundle) return null;
  return {
    session: bundle.session as SessionRow,
    entries: bundle.entries as EntryRow[],
    summary: bundle.summary as unknown as SummaryRow | null,
  };
}
