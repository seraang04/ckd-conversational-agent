import { createFileRoute, useNavigate } from "@tanstack/react-router";

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
            请选择您的语言 · Choose your language
          </h1>
          <p className="text-lg text-muted-foreground">
            Choose the language you would like to speak during your conversation.
          </p>
        </div>

        <Card className="space-y-4">
          <BigButton
            variant="soft"
            onClick={() => void navigate({ to: "/session", search: { language: "en" } })}
          >
            English
          </BigButton>
          <BigButton onClick={() => void navigate({ to: "/session", search: { language: "zh" } })}>
            华语 · Mandarin Chinese
          </BigButton>
          <BigButton
            variant="soft"
            onClick={() => void navigate({ to: "/session", search: { language: "hokkien" } })}
          >
            福建话 · Hokkien
          </BigButton>
        </Card>

        <FooterNote />
      </div>
    </Page>
  );
}
