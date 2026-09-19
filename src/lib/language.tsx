import { createContext, useCallback, useContext } from "react";

export const LanguageContext = createContext<string | undefined>(undefined);

export function useText(language?: string) {
  const inherited = useContext(LanguageContext);
  const selected = language ?? inherited;
  return useCallback(
    (zh: string, en: string) => (selected === "en" ? en : selected ? zh : `${zh} · ${en}`),
    [selected],
  );
}

/** Select only explicitly formatted translations; preserve unstructured user text. */
export function translatedText(text: string, language: string) {
  const marker = text.includes("EN:") ? "EN:" : " / ";
  const index = text.indexOf(marker);
  if (index < 0) return text;
  return (language === "en" ? text.slice(index + marker.length) : text.slice(0, index)).trim();
}
