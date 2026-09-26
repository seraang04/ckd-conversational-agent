import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BigButton, Card, ConversationLoading, Notice, quietActionClass } from "./ui";
import { explainOptionsForProfile } from "@/lib/ckd.functions";
import type { EntryRow } from "@/lib/ckd-db";
import { useText, type Language } from "@/lib/language";
import { buildTemplateExplanation } from "@/lib/options-explanation";
import { buildPatientProfile } from "@/lib/patient-profile";
import { speak, stopSpeaking } from "@/lib/speak";
import {
  EXPLAINABLE_DIMENSIONS,
  dimensionLabel,
  optionLabel,
  statementById,
  type DimensionId,
} from "@/lib/treatment-options";
import { cn } from "@/lib/utils";

const MAX_PRIORITIES = 3;
const HANDOFF_STATEMENTS: Record<string, string> = {
  longevity: "common.longevity.ask-team.1",
  cost: "common.cost.ask-team.1",
};

type Props = {
  sessionId: string;
  language: Language;
  entries: EntryRow[];
  /** Living-donation statements are allowed only if the patient shared the sensitive topic. */
  allowGated: boolean;
  /** Called with what was shown when the patient finishes, or null if they skipped. */
  onDone: (shown: OptionsShownResult | null) => Promise<void> | void;
};

export type OptionsShownResult = { source: "ai" | "template"; priorities: DimensionId[] };

function flexibilityLabel(profile: ReturnType<typeof buildPatientProfile>, language: Language): string {
  const item = profile.all.find((i) => i.dimension === "flexibility");
  const details = item?.details ?? [];
  const onlyFlexible = details.includes("prefers_flexible") && !details.includes("prefers_routine");
  const onlyRoutine = details.includes("prefers_routine") && !details.includes("prefers_flexible");
  if (language === "zh") {
    if (onlyFlexible) return "灵活安排每天的时间";
    if (onlyRoutine) return "固定、容易预先计划的日程";
    return "时间灵活还是安排固定";
  }
  if (onlyFlexible) return "Keeping your schedule flexible";
  if (onlyRoutine) return "Having a predictable routine";
  return "Flexible days vs a fixed routine";
}

export function OptionsStep({ sessionId, language, entries, allowGated, onDone }: Props) {
  const t = useText(language);
  const profile = useMemo(() => buildPatientProfile(entries), [entries]);
  const explainable = profile.all.filter((i) => EXPLAINABLE_DIMENSIONS.includes(i.dimension));
  const candidates: DimensionId[] = explainable.length
    ? explainable.map((i) => i.dimension)
    : [...EXPLAINABLE_DIMENSIONS];
  const [selected, setSelected] = useState<DimensionId[]>(profile.priorities);
  const [confirmed, setConfirmed] = useState<DimensionId[] | null>(null);

  if (!confirmed) {
    return (
      <section className="mx-auto w-full max-w-3xl space-y-8 py-3 sm:py-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
            {t("这些是您最在意的事吗？", "Are these the things that matter most to you?")}
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {t(
              `最多选 ${MAX_PRIORITIES} 项。我会说明不同的治疗方式在这些方面有什么不同。`,
              `Choose up to ${MAX_PRIORITIES}. I'll explain how the treatment options differ on these.`,
            )}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {candidates.map((dimension) => {
            const isSelected = selected.includes(dimension);
            const full = !isSelected && selected.length >= MAX_PRIORITIES;
            return (
              <button
                key={dimension}
                type="button"
                aria-pressed={isSelected}
                disabled={full}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(dimension)
                      ? current.filter((d) => d !== dimension)
                      : [...current, dimension],
                  )
                }
                className={cn(
                  "flex min-h-16 items-center gap-4 rounded-2xl border-2 p-4 text-left text-lg font-medium transition-colors focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/50 hover:bg-secondary/40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    isSelected
                      ? "border-primary-foreground bg-primary-foreground text-primary"
                      : "border-muted-foreground/60",
                  )}
                >
                  {isSelected ? <Check className="h-5 w-5" /> : null}
                </span>
                {dimension === "flexibility"
                  ? flexibilityLabel(profile, language)
                  : dimensionLabel(dimension, language)}
              </button>
            );
          })}
        </div>
        <BigButton disabled={!selected.length} onClick={() => setConfirmed(selected)}>
          {t("看看不同的治疗方式", "Show me how the options differ")}
        </BigButton>
        <button type="button" className={quietActionClass} onClick={() => void onDone(null)}>
          {t("跳过这一步", "Skip this step")}
        </button>
      </section>
    );
  }

  return (
    <OptionCards
      sessionId={sessionId}
      language={language}
      dimensions={confirmed}
      evidence={(d) => profile.all.find((i) => i.dimension === d)?.evidence ?? []}
      handoffs={profile.handoffs}
      allowGated={allowGated}
      onChangePriorities={() => setConfirmed(null)}
      onDone={onDone}
    />
  );
}

function OptionCards({
  sessionId,
  language,
  dimensions,
  evidence,
  handoffs,
  allowGated,
  onChangePriorities,
  onDone,
}: {
  sessionId: string;
  language: Language;
  dimensions: DimensionId[];
  evidence: (dimension: DimensionId) => { topic: string; label: string; rank?: number }[];
  handoffs: DimensionId[];
  allowGated: boolean;
  onChangePriorities: () => void;
  onDone: (shown: OptionsShownResult) => Promise<void> | void;
}) {
  const t = useText(language);
  const explain = useServerFn(explainOptionsForProfile);
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const query = useQuery({
    queryKey: ["options-explanation", sessionId, dimensions, allowGated],
    queryFn: () =>
      explain({
        data: {
          priorities: dimensions.map((dimension) => ({ dimension, evidence: evidence(dimension) })),
          allowGated,
          language,
        },
      }),
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
  // The server already falls back to the template; this covers the call itself failing.
  const result = query.isError
    ? {
        explanation: buildTemplateExplanation(dimensions, { allowGated }),
        source: "template" as const,
      }
    : query.data;
  const explanation = result?.explanation;
  const card = explanation?.dimensions[index];
  const last = index === dimensions.length - 1;

  const cardText = useMemo(() => {
    if (!card) return "";
    const parts = [dimensionLabel(card.dimension, language), card.bridge?.[language] ?? ""];
    for (const option of card.options) {
      parts.push(optionLabel(option.option, language), option.link?.[language] ?? "");
      for (const id of option.statementIds) parts.push(statementById(id)?.[language] ?? "");
    }
    return parts.filter(Boolean).join(language === "en" ? ". " : "。");
  }, [card, language]);

  useEffect(() => stopSpeaking, [index]);

  if (!card) {
    return <ConversationLoading label={t("正在准备说明", "Preparing your explanation")} />;
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6 py-3 sm:py-6">
      {index === 0 ? (
        <Notice tone="info">
          {[
            statementById("common.nochoice.1")?.[language],
            statementById("common.suitability.1")?.[language],
          ]
            .filter(Boolean)
            .join(" ")}
        </Notice>
      ) : null}

      <div className="space-y-3">
        <p className="text-base font-medium text-muted-foreground">
          {t(
            `第 ${index + 1} 项，共 ${dimensions.length} 项`,
            `${index + 1} of ${dimensions.length}`,
          )}
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          {dimensionLabel(card.dimension, language)}
        </h1>
        {card.bridge ? (
          <p className="text-lg leading-relaxed text-muted-foreground">{card.bridge[language]}</p>
        ) : null}
        <button
          type="button"
          className={quietActionClass}
          onClick={() => void speak(cardText, language)}
        >
          <Volume2 className="h-6 w-6" aria-hidden />
          {t("听一听", "Hear this")}
        </button>
      </div>

      <div className="space-y-4">
        {card.options.map((option) => (
          <Card key={option.option} className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              {optionLabel(option.option, language)}
            </h2>
            {option.link ? (
              <p className="text-lg leading-relaxed text-muted-foreground">
                {option.link[language]}
              </p>
            ) : null}
            <ul className="list-disc space-y-2 pl-6 text-lg leading-relaxed text-foreground">
              {option.statementIds.map((id) => (
                <li key={id}>{statementById(id)?.[language]}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {last && handoffs.length ? (
        <Notice tone="info">
          {handoffs
            .map((d) => statementById(HANDOFF_STATEMENTS[d] ?? "")?.[language])
            .filter(Boolean)
            .join(" ")}
        </Notice>
      ) : null}

      <div className="space-y-4">
        <BigButton
          disabled={finishing}
          onClick={async () => {
            if (!last) return setIndex(index + 1);
            setFinishing(true);
            try {
              await onDone({ source: result?.source ?? "template", priorities: dimensions });
            } finally {
              setFinishing(false);
            }
          }}
        >
          {last ? t("继续", "Continue") : t("下一项", "Next")}
        </BigButton>
        {index > 0 ? (
          <BigButton variant="ghost" onClick={() => setIndex(index - 1)}>
            {t("上一项", "Back")}
          </BigButton>
        ) : null}
        <button type="button" className={quietActionClass} onClick={onChangePriorities}>
          {t("更改我在意的事", "Change my priorities")}
        </button>
      </div>
    </section>
  );
}
