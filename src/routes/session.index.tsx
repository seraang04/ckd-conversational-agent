import idleClaraStrip from "@/assets/clara-animation/idle.webp";
import { normaliseLanguage, useText } from "@/lib/language";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { BigButton, ConversationLoading, Page } from "@/components/ckd/ui";
import { createConversation, serviceUnavailable } from "@/lib/ckd-db";

export const Route = createFileRoute("/session/")({
  validateSearch: (search: Record<string, unknown>) => ({
    language: normaliseLanguage(search["language"]),
  }),
  head: () => ({
    links: [{ rel: "preload", as: "image", href: idleClaraStrip, fetchPriority: "high" }],
    meta: [{ title: "Opening conversation" }],
  }),
  component: OpenConversation,
});

function OpenConversation() {
  const { language } = Route.useSearch();
  const t = useText(language);
  const navigate = useNavigate();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  const open = useCallback(async () => {
    if (started.current || serviceUnavailable) return;
    started.current = true;
    setFailed(false);
    try {
      const code = await createConversation(language);
      await navigate({
        to: "/session/$code",
        params: { code },
        search: { language },
        replace: true,
      });
    } catch (error) {
      console.error("Could not open conversation", error);
      setFailed(true);
    }
  }, [language, navigate]);

  useEffect(() => {
    void open();
  }, [open]);

  if (!serviceUnavailable && !failed) {
    return (
      <Page language={language} minimalHeader>
        <ConversationLoading label={t("正在打开对话", "Opening conversation")} />
      </Page>
    );
  }

  return (
    <Page language={language} minimalHeader>
      <div className="mx-auto w-full max-w-xl space-y-5">
        <h1 className="text-3xl font-semibold text-foreground">
          {t("无法打开对话", "Unable to open conversation")}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t("请联系工作人员。", "Please ask a staff member for help.")}
        </p>
        {!serviceUnavailable ? (
          <BigButton
            onClick={() => {
              started.current = false;
              void open();
            }}
          >
            {t("重试", "Try again")}
          </BigButton>
        ) : null}
      </div>
    </Page>
  );
}
