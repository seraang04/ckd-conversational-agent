import claraMascot from "@/assets/clara-mascot-display.png";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { BrandMark } from "@/components/ckd/ui";
import type { Language } from "@/lib/language";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [{ rel: "preload", as: "image", href: claraMascot }],
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
  const chooseLanguage = (language: Language) => {
    void navigate({ to: "/session", search: { language } });
  };

  return (
    <div className="min-h-screen bg-patient-surface px-5">
      <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col items-center justify-center py-10">
        <BrandMark className="h-20 w-20" />

        <h1 className="mt-6 text-center text-3xl font-semibold leading-snug text-foreground">
          <span lang="en" className="block">
            Choose your language
          </span>
          <span lang="zh-Hans" className="block">
            选择语言
          </span>
        </h1>
        <div className="mt-10 w-full space-y-4">
          <button
            type="button"
            className="min-h-20 w-full rounded-2xl border-2 border-primary bg-card px-6 py-5 text-2xl font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ring"
            onClick={() => chooseLanguage("en")}
          >
            English
          </button>
          <button
            type="button"
            className="min-h-20 w-full rounded-2xl border-2 border-primary bg-card px-6 py-5 text-2xl font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ring"
            onClick={() => chooseLanguage("zh")}
          >
            <span lang="zh-Hans">华语</span>
          </button>
        </div>
      </main>
    </div>
  );
}
