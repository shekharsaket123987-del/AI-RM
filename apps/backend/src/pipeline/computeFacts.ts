// PRD section 23: "Computed facts ... are calculated in code and passed in
// as fields. The model only puts them into words." Nothing here is decided
// by the LLM.

export interface ProgressFacts {
  startWeightKg?: number;
  latestWeightKg?: number;
  targetWeightKg?: number;
  changeKg?: number;
  changeDirection?: "loss" | "gain" | "none";
}

export function computeProgress(
  followupsAsc: { weightKg?: number | null }[],
  targetWeightKg?: number | null
): ProgressFacts {
  const weights = followupsAsc.map((f) => f.weightKg).filter((w): w is number => typeof w === "number");
  if (weights.length === 0) return {};
  const startWeightKg = weights[0];
  const latestWeightKg = weights[weights.length - 1];
  const changeKg = Math.round((startWeightKg - latestWeightKg) * 100) / 100;
  return {
    startWeightKg,
    latestWeightKg,
    targetWeightKg: targetWeightKg ?? undefined,
    changeKg: Math.abs(changeKg),
    changeDirection: changeKg > 0 ? "loss" : changeKg < 0 ? "gain" : "none",
  };
}

export function daysUntil(date: Date, from: Date = new Date()): number {
  const ms = date.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function isPlateau(followupsDesc: { weightKg?: number | null }[], windowSize = 2, thresholdKg = 0.3): boolean {
  const window = followupsDesc.slice(0, windowSize);
  const weights = window.map((f) => f.weightKg).filter((w): w is number => typeof w === "number");
  if (weights.length < windowSize) return false;
  const max = Math.max(...weights);
  const min = Math.min(...weights);
  return max - min < thresholdKg;
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString("en-IN", { weekday: "long", hour: "numeric", minute: "2-digit", hour12: true });
}
