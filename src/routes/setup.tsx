import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Card, Field, FooterNote, Notice, Page, inputClass } from "@/components/ckd/ui";
import { supabase } from "@/integrations/supabase/client";
import { makeCode } from "@/lib/ckd-db";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Clinician setup · 谈谈我在意的事" },
      {
        name: "description",
        content:
          "A two-minute setup at the first consultation: diagnosis context, language, consent, and the session code the patient will use.",
      },
      { property: "og:title", content: "Clinician setup · CKD values conversation" },
      {
        property: "og:description",
        content: "Set up a values conversation for a kidney patient in about two minutes.",
      },
    ],
  }),
  component: Setup,
});

function Setup() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [form, setForm] = useState({
    patient_label: "",
    ckd_stage: "Stage 4",
    language: "zh",
    key_issues: "",
    assistant_role: "caregiver",
    assistant_name: "",
    consent_recording: false,
    consent_sharing: false,
  });

  const submit = async () => {
    if (!form.patient_label.trim()) {
      toast.error("Please add the patient's name or initials.");
      return;
    }
    if (!form.consent_recording || !form.consent_sharing) {
      toast.error("Both consents are needed before a session can start.");
      return;
    }
    setSaving(true);
    const newCode = makeCode();
    const { error } = await supabase.from("ckd_sessions").insert({
      ...form,
      patient_label: form.patient_label.trim(),
      code: newCode,
      stage: "checkin",
    });
    setSaving(false);
    if (error) {
      toast.error("Could not create the session. Please try again.");
      return;
    }
    setCode(newCode);
  };

  if (code) {
    return (
      <Page variant="clinician" subtitle="Clinician setup">
        <Card className="space-y-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Session ready</h1>
          <p className="text-muted-foreground">
            Give this code to the patient and the person assisting them. It opens the conversation on
            any device.
          </p>
          <p className="rounded-3xl bg-secondary py-8 text-5xl font-bold tracking-[0.3em] text-secondary-foreground">
            {code}
          </p>
          <BigButton onClick={() => void navigate({ to: "/session/$code", params: { code } })}>
            现在开始 · Start now
          </BigButton>
          <BigButton variant="ghost" onClick={() => setCode(null)}>
            Set up another patient
          </BigButton>
        </Card>
        <FooterNote />
      </Page>
    );
  }

  return (
    <Page variant="clinician" subtitle="Clinician setup">
      <div className="space-y-5">
        <h1 className="text-3xl font-semibold text-foreground">Clinician setup</h1>
        <Notice>
          Takes about two minutes and fits inside the consultation. The conversation happens later,
          with the caregiver assisting.
        </Notice>

        <Card className="space-y-5">
          <Field label="Patient name or initials">
            <input
              className={inputClass}
              value={form.patient_label}
              onChange={(e) => setForm({ ...form, patient_label: e.target.value })}
              placeholder="e.g. Mdm Tan / T.L."
            />
          </Field>

          <Field label="CKD stage">
            <select
              className={inputClass}
              value={form.ckd_stage}
              onChange={(e) => setForm({ ...form, ckd_stage: e.target.value })}
            >
              {["Stage 3a", "Stage 3b", "Stage 4", "Stage 5", "Stage 5 on dialysis"].map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Spoken language" hint="Phase 1 supports Mandarin Chinese and Hokkien.">
            <select
              className={inputClass}
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            >
              <option value="zh">华语 Mandarin Chinese</option>
              <option value="hokkien">福建话 Hokkien</option>
            </select>
          </Field>

          <Field
            label="Key issues to explore"
            hint="What you would like the conversation to draw out."
          >
            <textarea
              rows={3}
              className={inputClass}
              value={form.key_issues}
              onChange={(e) => setForm({ ...form, key_issues: e.target.value })}
              placeholder="e.g. worried about being a burden; daughter raised living donation"
            />
          </Field>

          <Field label="Who will assist the patient?">
            <select
              className={inputClass}
              value={form.assistant_role}
              onChange={(e) => setForm({ ...form, assistant_role: e.target.value })}
            >
              <option value="caregiver">Family caregiver</option>
              <option value="social_worker">Social worker</option>
            </select>
          </Field>

          <Field label="Name of the person assisting">
            <input
              className={inputClass}
              value={form.assistant_name}
              onChange={(e) => setForm({ ...form, assistant_name: e.target.value })}
              placeholder="e.g. daughter, Mei"
            />
          </Field>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Consent</h2>
          <label className="flex items-start gap-3 text-base text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-6 w-6"
              checked={form.consent_recording}
              onChange={(e) => setForm({ ...form, consent_recording: e.target.checked })}
            />
            The patient agrees to the conversation being recorded and turned into a transcript.
          </label>
          <label className="flex items-start gap-3 text-base text-foreground">
            <input
              type="checkbox"
              className="mt-1 h-6 w-6"
              checked={form.consent_sharing}
              onChange={(e) => setForm({ ...form, consent_sharing: e.target.checked })}
            />
            The patient agrees to the summary being shared with their named care team.
          </label>
          <p className="text-sm text-muted-foreground">
            Consent is re-confirmed with the patient before their first answer. Anything they ask to
            withhold is left out of the summary.
          </p>
        </Card>

        <BigButton onClick={() => void submit()} disabled={saving}>
          {saving ? "Creating…" : "Create session code"}
        </BigButton>
        <FooterNote />
      </div>
    </Page>
  );
}
