import { createContext, useCallback, useContext } from "react";

export type Language = "en" | "zh";

export function parseLanguage(value: unknown): Language | undefined {
  return value === "en" || value === "zh" ? value : undefined;
}

export function normaliseLanguage(value: unknown): Language {
  return parseLanguage(value) ?? "zh";
}

export const LanguageContext = createContext<Language | null>(null);

export function useText(language?: Language) {
  const inherited = useContext(LanguageContext);
  const selected = language ?? inherited;
  if (!selected) throw new Error("A language is required for patient-facing text");
  return useCallback((zh: string, en: string) => (selected === "en" ? en : zh), [selected]);
}

/** Select only explicitly formatted translations; preserve unstructured user text. */
export function translatedText(text: string, language: Language) {
  const marker = text.includes("EN:") ? "EN:" : " / ";
  const index = text.indexOf(marker);
  if (index < 0) return text;
  return (language === "en" ? text.slice(index + marker.length) : text.slice(0, index)).trim();
}
