export type SafetyResult = { status: "clear" | "risk" | "unavailable" };

// Conservative fast path only. Absence of these phrases NEVER clears an answer.
export function hasExplicitSafetySignal(answer: string): boolean {
  return /\b(?:kill myself|end my life|want to die|wish i (?:was|were) dead|hurt myself|harm myself|suicidal|overdose)\b|自杀|自殺|自残|自殘|不想活|想死|结束生命|結束生命|伤害自己|傷害自己/i.test(
    answer,
  );
}

export async function assessSafety(
  answer: string,
  classify: (answer: string) => Promise<{ distressed: boolean } | null>,
  timeoutMs = 15000,
): Promise<SafetyResult> {
  if (hasExplicitSafetySignal(answer)) return { status: "risk" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      classify(answer),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    if (typeof result?.distressed !== "boolean") return { status: "unavailable" };
    return { status: result.distressed ? "risk" : "clear" };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}
