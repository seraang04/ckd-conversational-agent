import type { AnswerChoice, AnswerKind } from "./ckd-script";

export function toggleChoice(
  selected: number[],
  index: number,
  choices: AnswerChoice[],
  kind: AnswerKind,
) {
  if (!choices[index]) return selected;
  if (kind === "single") return [index];
  if (selected.includes(index)) return selected.filter((value) => value !== index);
  if (choices[index].exclusive) return [index];
  return [...selected.filter((value) => !choices[value]?.exclusive), index];
}

export function moveChoice(selected: number[], position: number, direction: -1 | 1) {
  const target = position + direction;
  if (position < 0 || position >= selected.length || target < 0 || target >= selected.length)
    return selected;
  const result = [...selected];
  [result[position], result[target]] = [result[target]!, result[position]!];
  return result;
}

export function formatChoices(
  selected: number[],
  choices: AnswerChoice[],
  kind: AnswerKind,
  language: "en" | "zh",
) {
  const labels = selected.flatMap((index) => (choices[index] ? [choices[index][language]] : []));
  if (!labels.length) return "";
  if (kind === "single") return labels[0]!;
  const heading =
    kind === "ranking"
      ? language === "en"
        ? "Priorities (most important first):"
        : "优先事项（最重要的排在前面）："
      : language === "en"
        ? "Selected concerns:"
        : "选择的担忧：";
  return `${heading}\n${labels.map((label, index) => `${kind === "ranking" ? `${index + 1}.` : "•"} ${label}`).join("\n")}`;
}
