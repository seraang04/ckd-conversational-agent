import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { Card, FooterNote, Notice, Page, SpeakerBadge } from "@/components/ckd/ui";
import { fetchSessionBundle } from "@/lib/ckd-db";

export const Route = createFileRoute("/coordinator/$code")({
  head: () => ({
    meta: [
      { title: "Session summary · CKD values conversation" },
      {
        name: "description",
        content:
          "A one-minute summary of what the patient and caregiver said, with deferred topics flagged by name only.",
      },
      { property: "og:title", content: "Session summary · CKD values conversation" },
      {
        property: "og:description",
        content: "A one-minute read before the consultation, in the patient's own words.",
      },
    ],
  }),
  component: CoordinatorDetail,
});

function CoordinatorDetail() {
  const { code } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["ckd-session", code],
    queryFn: () => fetchSessionBundle(code),
  });

  if (isLoading) {
    return (
      <Page variant="clinician" subtitle="Renal coordinator">
        <p className="text-muted-foreground">Loading…</p>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page variant="clinician" subtitle="Renal coordinator">
        <Card className="space-y-3">
          <p className="text-foreground">No session with code {code}.</p>
          <Link to="/coordinator" className="font-semibold text-primary underline">
            Back to all conversations
          </Link>
        </Card>
      </Page>
    );
  }

  const { session, entries, summary } = data;
  const shared = entries.filter((e) => e.visibility === "shared");
  const flaggedEntries = entries.filter(
    (e) => e.visibility === "private" || e.visibility === "deferred",
  );

  return (
    <Page variant="clinician" subtitle={`Session ${session.code}`}>
      <div className="space-y-5">
        <Card className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">{session.patient_label}</h1>
          <p className="text-sm text-muted-foreground">
            {session.ckd_stage} · assisted by {session.assistant_name || session.assistant_role} ·
            readiness: {session.readiness || "not recorded"}
          </p>
          {session.key_issues ? (
            <p className="pt-2 text-sm text-muted-foreground">
              Clinician note at setup: {session.key_issues}
            </p>
          ) : null}
        </Card>

        <Notice>
          Prepared by the patient before the consultation. It structures what matters to them and never
          recommends, ranks or scores a treatment.
        </Notice>

        {summary?.clinician_summary ? (
          <Card className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">One-minute summary</h2>
            <div className="whitespace-pre-wrap text-base leading-relaxed text-foreground">
              {summary.clinician_summary}
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-muted-foreground">
              The patient has not confirmed their summary yet. Current stage: {session.stage}.
            </p>
          </Card>
        )}

        {flaggedEntries.length > 0 ? (
          <Card className="space-y-3 bg-private-surface">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
              <Lock className="h-5 w-5" /> Topics to follow up in person
            </h2>
            <p className="text-sm text-muted-foreground">
              The patient chose to keep these out of the written summary. The topic is named; the
              content is not shown.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-base text-foreground">
              {flaggedEntries.map((entry) => (
                <li key={entry.id}>{entry.question.split(" / ")[1] ?? entry.question}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        <details className="rounded-3xl border border-border bg-card p-5">
          <summary className="cursor-pointer text-base font-semibold text-foreground">
            Shared answers in their own words ({shared.length})
          </summary>
          <ul className="mt-4 space-y-4">
            {shared.map((entry) => (
              <li key={entry.id} className="space-y-1 border-b border-border pb-3 last:border-0">
                <SpeakerBadge speaker={entry.speaker} />
                <p className="text-sm text-muted-foreground">{entry.question}</p>
                <p className="text-base text-foreground">{entry.answer}</p>
              </li>
            ))}
          </ul>
        </details>

        <Link to="/coordinator" className="block font-semibold text-primary underline">
          Back to all conversations
        </Link>
        <FooterNote />
      </div>
    </Page>
  );
}
