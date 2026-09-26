import { useText, LanguageContext, type Language } from "@/lib/language";
import { Link } from "@tanstack/react-router";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

import { ClaraMascot } from "@/components/ckd/ClaraMascot";
import claraMascot from "@/assets/clara-mascot-display.png";
import { questionLoadingMessage } from "@/lib/loading-messages";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-12 w-12 shrink-0 overflow-hidden", className)}>
      <img src={claraMascot} alt="" className="h-full w-full object-contain" />
    </span>
  );
}

export function AppHeader({ action, minimal = false }: { action?: ReactNode; minimal?: boolean }) {
  const t = useText();
  return (
    <header className="border-b border-border px-5 py-2">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
        {minimal ? (
          <BrandMark className="h-10 w-10 sm:h-12 sm:w-12" />
        ) : (
          <Link to="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
            <BrandMark className="h-10 w-10 sm:h-12 sm:w-12" />
            <span className="text-base font-semibold leading-tight text-foreground sm:text-xl">
              {t("谈谈我在意的事", "What matters to me")}
            </span>
          </Link>
        )}
        {action}
      </div>
    </header>
  );
}

export function Page({
  children,
  variant = "patient",
  language,
  headerAction,
  minimalHeader = false,
}: {
  children: ReactNode;
  language: Language;
  headerAction?: ReactNode;
  minimalHeader?: boolean;
  variant?: "patient" | "caregiver" | "clinician";
}) {
  return (
    <LanguageContext.Provider value={language}>
      <div
        lang={language === "en" ? "en" : "zh-Hans"}
        className={cn(
          "min-h-screen",
          variant === "caregiver" && "bg-caregiver-surface",
          variant === "patient" && "bg-patient-surface",
          variant === "clinician" && "bg-muted",
        )}
      >
        <AppHeader action={headerAction} minimal={minimalHeader} />
        <main className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-4xl flex-col justify-center px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    </LanguageContext.Provider>
  );
}

export function BigButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "soft" | "ghost" | "danger";
  disabled?: boolean | undefined;
  type?: "button" | "submit";
  className?: string | undefined;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-16 w-full rounded-2xl px-6 py-4 text-xl font-semibold transition-colors focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variant === "soft" && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "ghost" && "border-2 border-border bg-card text-foreground hover:bg-muted",
        variant === "danger" &&
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const actionControlClass =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-border bg-card px-4 py-2 text-base font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";

export const quietActionClass =
  "inline-flex min-h-12 items-center gap-2 px-1 text-base font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:opacity-50 sm:text-lg";

export function ActionButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  className,
}: {
  icon: LucideIcon;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(actionControlClass, className)}
    >
      <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <span>{children}</span>
    </button>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-border bg-card p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-lg font-semibold text-foreground">{label}</span>
      {hint ? <span className="block text-sm text-muted-foreground">{hint}</span> : null}
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border-2 border-input bg-card px-4 py-4 text-lg text-foreground outline-none focus:border-ring";

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  return (
    <p
      className={cn(
        "rounded-2xl px-5 py-4 text-base leading-relaxed",
        tone === "info" && "bg-secondary text-secondary-foreground",
        tone === "warn" && "bg-accent text-accent-foreground",
      )}
    >
      {children}
    </p>
  );
}

export function SpeakerBadge({ speaker }: { speaker: string }) {
  const t = useText();
  const isPatient = speaker === "patient";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold",
        isPatient
          ? "bg-primary text-primary-foreground"
          : "bg-caregiver-accent text-primary-foreground",
      )}
    >
      {isPatient ? t("病人", "Patient") : t("照顾者", "Caregiver")}
    </span>
  );
}

export function LoadingLabel({ children }: { children: ReactNode }) {
  return (
    <span role="status" className="inline-flex items-center justify-center gap-2">
      <LoaderCircle className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
      <span>{children}</span>
    </span>
  );
}

/** The single full-page loading treatment used throughout the conversation. */
export function ConversationLoading({
  label,
  showQuestionMessages = false,
  messageSeed = 0,
}: {
  label: string;
  showQuestionMessages?: boolean;
  messageSeed?: number;
}) {
  const t = useText();
  const message = showQuestionMessages ? questionLoadingMessage(messageSeed) : null;

  return (
    <section
      aria-busy="true"
      className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-3xl flex-col items-center justify-center gap-5 py-3 text-center"
    >
      <ClaraMascot
        state="waiting"
        alt={t("对话伙伴 Clara", "Clara, your conversation companion")}
        className="h-40 aspect-[12/13] sm:h-52"
      />
      <p role="status" className="text-xl font-semibold text-foreground">
        {label}
      </p>
      {message ? (
        <div
          key={messageSeed}
          className="loading-companion-message flex min-h-24 w-full max-w-xl items-center justify-center rounded-3xl border border-border bg-card px-6 py-5 shadow-sm"
        >
          <p className="text-xl font-medium leading-relaxed text-foreground">
            {t(message.zh, message.en)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
