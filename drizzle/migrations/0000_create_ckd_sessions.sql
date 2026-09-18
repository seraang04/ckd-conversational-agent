-- Demo-grade prototype: sessions are reached by short code, no auth yet.
CREATE TABLE public.ckd_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  patient_label TEXT NOT NULL,
  ckd_stage TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'zh',
  key_issues TEXT NOT NULL DEFAULT '',
  assistant_role TEXT NOT NULL DEFAULT 'caregiver',
  assistant_name TEXT NOT NULL DEFAULT '',
  consent_recording BOOLEAN NOT NULL DEFAULT false,
  consent_sharing BOOLEAN NOT NULL DEFAULT false,
  readiness TEXT NOT NULL DEFAULT 'unknown',
  stage TEXT NOT NULL DEFAULT 'setup',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE ON public.ckd_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ckd_sessions TO authenticated;
GRANT ALL ON public.ckd_sessions TO service_role;
ALTER TABLE public.ckd_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prototype open read sessions" ON public.ckd_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prototype open insert sessions" ON public.ckd_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "prototype open update sessions" ON public.ckd_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ckd_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ckd_sessions(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL DEFAULT 'patient',
  topic TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'shared',
  input_mode TEXT NOT NULL DEFAULT 'voice',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ckd_entries_session_idx ON public.ckd_entries(session_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.ckd_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ckd_entries TO authenticated;
GRANT ALL ON public.ckd_entries TO service_role;
ALTER TABLE public.ckd_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prototype open read entries" ON public.ckd_entries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prototype open insert entries" ON public.ckd_entries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "prototype open update entries" ON public.ckd_entries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ckd_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.ckd_sessions(id) ON DELETE CASCADE,
  patient_priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  caregiver_support JSONB NOT NULL DEFAULT '[]'::jsonb,
  shared_concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
  differing_concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
  flagged_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  clinician_summary TEXT NOT NULL DEFAULT '',
  confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ckd_summaries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ckd_summaries TO authenticated;
GRANT ALL ON public.ckd_summaries TO service_role;
ALTER TABLE public.ckd_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prototype open read summaries" ON public.ckd_summaries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "prototype open insert summaries" ON public.ckd_summaries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "prototype open update summaries" ON public.ckd_summaries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
