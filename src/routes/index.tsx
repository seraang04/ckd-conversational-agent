import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardList, MessageCircle, Stethoscope } from "lucide-react";

import { BigButton, Card, FooterNote, Page } from "@/components/ckd/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "谈谈我在意的事 · CKD values conversation" },
      {
        name: "description",
        content:
          "A calm, voice-led conversation that helps kidney patients and their caregivers say what matters to them before the next consultation.",
      },
      { property: "og:title", content: "谈谈我在意的事 · CKD values conversation" },
      {
        property: "og:description",
        content:
          "A calm, voice-led conversation that helps kidney patients and their caregivers say what matters to them before the next consultation.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();

  return (
    <Page>
      <div className="space-y-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold leading-tight text-foreground">
            在看诊之前，先谈谈您在意的事
          </h1>
          <p className="text-lg text-muted-foreground">
            A calm conversation before the kidney consultation, so the discussion can start from what
            matters to you.
          </p>
        </div>

        <Card className="space-y-4">
          <BigButton onClick={() => void navigate({ to: "/session" })}>
            <span className="flex items-center justify-center gap-3">
              <MessageCircle className="h-6 w-6" /> 继续对话 · Continue a session
            </span>
          </BigButton>
          <BigButton variant="ghost" onClick={() => void navigate({ to: "/setup" })}>
            <span className="flex items-center justify-center gap-3">
              <ClipboardList className="h-6 w-6" /> 医生设置 · Clinician setup
            </span>
          </BigButton>
          <BigButton variant="soft" onClick={() => void navigate({ to: "/coordinator" })}>
            <span className="flex items-center justify-center gap-3">
              <Stethoscope className="h-6 w-6" /> 协调员查看 · Coordinator view
            </span>
          </BigButton>
        </Card>

        <FooterNote />
      </div>
    </Page>
  );
}
