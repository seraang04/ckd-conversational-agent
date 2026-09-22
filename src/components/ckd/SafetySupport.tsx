import { useEffect, useRef } from "react";
import { useText, type Language } from "@/lib/language";
import { stopSpeaking } from "@/lib/speak";
import { BigButton, Card } from "./ui";

export function SafetySupport({
  language,
  unavailable,
  saved,
  onRetry,
}: {
  language: Language;
  unavailable: boolean;
  saved: boolean;
  onRetry: () => void;
}) {
  const t = useText(language);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stopSpeaking();
    heading.current?.focus();
  }, []);
  return (
    <Card className="mx-auto max-w-3xl space-y-5">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold">
        {t("对话已暂停", "Conversation paused")}
      </h1>
      <p role="alert" className="text-xl">
        {unavailable
          ? t(
              "暂时无法完成安全检查。请重试；检查完成前，对话不会继续。",
              "We could not complete the safety check. Please retry; the conversation will stay paused until the check completes.",
            )
          : t(
              "谢谢您告诉我们。您或您提到的人可能需要立即获得真人支持。请联系您信任的人，陪在身边。",
              "Thank you for telling us. You or the person you mentioned may need support from a person now. Please ask someone you trust to stay with you.",
            )}
      </p>
      <p>
        {t(
          "如果已经受伤、服药过量，或可能马上伤害自己或他人，请立即求助。",
          "If someone is injured, has taken an overdose, or may act on thoughts of harming themselves or others, seek emergency help now.",
        )}
      </p>
      <div className="grid gap-4 text-xl underline">
        <a href="tel:995">{t("新加坡紧急救护：995", "Singapore emergency ambulance: 995")}</a>
        <a href="tel:1767">
          {t("新加坡 SOS 24小时热线：1767", "Singapore SOS 24-hour hotline: 1767")}
        </a>
        <a href="https://wa.me/6591511767" target="_blank" rel="noreferrer">
          {t(
            "SOS WhatsApp（英语文字服务）：9151 1767",
            "SOS WhatsApp (English text service): 9151 1767",
          )}
        </a>
      </div>
      <p>
        {t(
          "如果您不在新加坡，请联系当地紧急服务。",
          "Outside Singapore, contact your local emergency services.",
        )}
      </p>
      <p>
        {t(
          "本应用没有自动通知护理团队或紧急服务。请直接联系他们，不要等待本应用的回复。",
          "This app has not automatically notified your care team or emergency services. Contact them directly; do not wait for a reply here.",
        )}
      </p>
      {!unavailable && (
        <p role="status">
          {saved
            ? t(
                "对话已标记为需要人工安全审核。",
                "This conversation is flagged for human safety review.",
              )
            : t(
                "安全标记尚未保存。对话仍然暂停，请重试保存。",
                "The safety flag has not been saved. The conversation remains paused; please retry saving.",
              )}
        </p>
      )}
      {(unavailable || !saved) && <BigButton onClick={onRetry}>{t("重试", "Retry")}</BigButton>}
      <a
        className="block underline"
        href="https://www.sos.org.sg/our-services/"
        target="_blank"
        rel="noreferrer"
      >
        {t("SOS 支持服务", "SOS support services")}
      </a>
    </Card>
  );
}
