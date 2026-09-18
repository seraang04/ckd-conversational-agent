import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { BigButton, Card, FooterNote, Page, inputClass } from "@/components/ckd/ui";
import { fetchSessionBundle } from "@/lib/ckd-db";

export const Route = createFileRoute("/session/")({
  head: () => ({
    meta: [
      { title: "Continue a session · 谈谈我在意的事" },
      {
        name: "description",
        content: "Enter the session code from the clinic to continue the values conversation.",
      },
      { property: "og:title", content: "Continue a session" },
      {
        property: "og:description",
        content: "Enter the session code from the clinic to continue the values conversation.",
      },
    ],
  }),
  component: Join,
});

function Join() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);

  const open = async () => {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) return;
    setChecking(true);
    try {
      const bundle = await fetchSessionBundle(clean);
      if (!bundle) {
        toast.error("找不到这个号码 · No session with that code");
        return;
      }
      await navigate({ to: "/session/$code", params: { code: clean } });
    } catch {
      toast.error("Could not open that session. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <Page>
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold text-foreground">
          输入号码
          <span className="mt-1 block text-lg font-normal text-muted-foreground">
            Enter the code from the clinic
          </span>
        </h1>
        <Card className="space-y-5">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className={`${inputClass} text-center text-4xl font-bold tracking-[0.3em]`}
          />
          <BigButton onClick={() => void open()} disabled={checking}>
            {checking ? "…" : "打开 · Open"}
          </BigButton>
        </Card>
        <FooterNote />
      </div>
    </Page>
  );
}
