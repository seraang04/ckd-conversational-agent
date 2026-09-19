import { useText, LanguageContext } from "@/lib/language";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

export function AppHeader({ subtitle }: { subtitle?: string | undefined }) {
  const t = useText();
  return (
    <header className="flex items-center gap-3 border-b border-border px-5 py-4">
      <Link to="/" className="flex items-center gap-3">
        <img src={logo} alt="" width={40} height={40} className="h-10 w-10" />
        <span className="text-left leading-tight">
          <span className="block text-base font-semibold text-foreground">
            {t("谈谈我在意的事", "What matters to me")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {subtitle ??
              t("看诊之前，谈谈您在意的事", "Values conversation before your kidney consultation")}
          </span>
        </span>
      </Link>
    </header>
  );
}

export function Page({
  children,
  variant = "patient",
  subtitle,
  language,
}: {
  children: ReactNode;
  language?: string | undefined;
  variant?: "patient" | "caregiver" | "clinician";
  subtitle?: string | undefined;
}) {
  return (
    <LanguageContext.Provider value={language}>
      <div
        lang={language === "en" ? "en" : language ? "zh-Hans" : undefined}
        className={cn(
          "min-h-screen",
          variant === "caregiver" && "bg-caregiver-surface",
          variant === "patient" && "bg-patient-surface",
          variant === "clinician" && "bg-muted",
        )}
      >
        <AppHeader subtitle={subtitle} />
        <main className="mx-auto w-full max-w-2xl px-5 pb-28 pt-6">{children}</main>
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
        "w-full rounded-2xl px-6 py-5 text-xl font-semibold transition-colors disabled:opacity-50",
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
        "rounded-2xl px-4 py-3 text-sm",
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
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        isPatient
          ? "bg-primary text-primary-foreground"
          : "bg-caregiver-accent text-primary-foreground",
      )}
    >
      {isPatient ? t("病人", "Patient") : t("照顾者", "Caregiver")}
    </span>
  );
}

export function FooterNote() {
  const t = useText();
  return (
    <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
      {t(
        "这个对话是为了帮助您准备门诊，不会给治疗建议，也不会取代医生的诊断。",
        "Prepares you for the consultation. It never recommends treatment or replaces your care team.",
      )}
    </p>
  );
}
