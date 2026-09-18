import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Card, FooterNote, Notice, Page } from "@/components/ckd/ui";
import { fetchCompletedSessions } from "@/lib/ckd-db";

export const Route = createFileRoute("/coordinator/")({
  head: () => ({
    meta: [
      { title: "Coordinator view · CKD values conversations" },
      {
        name: "description",
        content:
          "Renal coordinator view: one-minute summaries of what patients and caregivers said before the consultation.",
      },
      { property: "og:title", content: "Coordinator view · CKD values conversations" },
      {
        property: "og:description",
        content: "One-minute summaries of patient and caregiver values before the consultation.",
      },
    ],
  }),
  component: CoordinatorList,
});

function CoordinatorList() {
  const { data, isLoading } = useQuery({
    queryKey: ["ckd-sessions"],
    queryFn: fetchCompletedSessions,
  });

  return (
    <Page variant="clinician" subtitle="Renal coordinator">
      <div className="space-y-5">
        <h1 className="text-3xl font-semibold text-foreground">Conversations</h1>
        <Notice>
          Prepared by the patient before the consultation. Not a recommendation, ranking or clinical
          assessment.
        </Notice>

        {isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {data?.length === 0 ? (
          <p className="text-muted-foreground">No sessions yet.</p>
        ) : null}

        <div className="space-y-3">
          {data?.map((session) => (
            <Link
              key={session.id}
              to="/coordinator/$code"
              params={{ code: session.code }}
              className="block"
            >
              <Card className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xl font-semibold text-foreground">
                    {session.patient_label}
                  </span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold tracking-widest text-secondary-foreground">
                    {session.code}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {session.ckd_stage} · {session.language === "hokkien" ? "Hokkien" : "Mandarin"} ·{" "}
                  {session.completed_at ? "Ready to read" : `In progress (${session.stage})`}
                </p>
              </Card>
            </Link>
          ))}
        </div>

        <FooterNote />
      </div>
    </Page>
  );
}
