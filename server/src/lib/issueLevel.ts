/**
 * Issue level: Likelihood fixed at 1 (it happened).
 * Top row of 5x5 matrix: Consequence 1-5 => 8, 16, 20, 23, 25 (for waterfall ordering)
 * Level (low/moderate/high) from top row: C1-3 low, C4-5 moderate
 */
const CONSEQUENCE_TO_LEVEL: Record<number, string> = {
  1: "low",
  2: "low",
  3: "low",
  4: "moderate",
  5: "moderate",
};

const CONSEQUENCE_TO_NUMERICAL: Record<number, number> = {
  1: 8,
  2: 16,
  3: 20,
  4: 23,
  5: 25,
};

export function getIssueLevel(consequence: number): string {
  const c = Math.max(1, Math.min(5, consequence));
  return CONSEQUENCE_TO_LEVEL[c] ?? "moderate";
}

export function getNumericalIssueLevel(consequence: number): number {
  const c = Math.max(1, Math.min(5, consequence));
  return CONSEQUENCE_TO_NUMERICAL[c] ?? 20;
}
