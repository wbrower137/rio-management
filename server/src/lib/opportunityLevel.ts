/**
 * 5x5 Opportunity Matrix - same mapping as risk (L×I => 1-25)
 * Likelihood (1-5) × Impact (1-5) => Low, Moderate, High
 */
const OPPORTUNITY_LEVEL_MATRIX: Record<string, string> = {
  "1-1": "low", "1-2": "low", "1-3": "low", "1-4": "moderate", "1-5": "moderate",
  "2-1": "low", "2-2": "low", "2-3": "moderate", "2-4": "moderate", "2-5": "high",
  "3-1": "low", "3-2": "moderate", "3-3": "moderate", "3-4": "high", "3-5": "high",
  "4-1": "moderate", "4-2": "moderate", "4-3": "high", "4-4": "high", "4-5": "high",
  "5-1": "moderate", "5-2": "high", "5-3": "high", "5-4": "high", "5-5": "high",
};

const NUMERICAL_OPPORTUNITY_LEVEL: Record<string, number> = {
  "1-1": 1, "1-2": 3, "1-3": 5, "1-4": 9, "1-5": 12,
  "2-1": 2, "2-2": 4, "2-3": 11, "2-4": 15, "2-5": 17,
  "3-1": 6, "3-2": 10, "3-3": 14, "3-4": 19, "3-5": 21,
  "4-1": 7, "4-2": 13, "4-3": 18, "4-4": 22, "4-5": 24,
  "5-1": 8, "5-2": 16, "5-3": 20, "5-4": 23, "5-5": 25,
};

export function getOpportunityLevel(likelihood: number, impact: number): string {
  const key = `${Math.max(1, Math.min(5, likelihood))}-${Math.max(1, Math.min(5, impact))}`;
  return OPPORTUNITY_LEVEL_MATRIX[key] ?? "moderate";
}

export function getNumericalOpportunityLevel(likelihood: number, impact: number): number {
  const key = `${Math.max(1, Math.min(5, likelihood))}-${Math.max(1, Math.min(5, impact))}`;
  return NUMERICAL_OPPORTUNITY_LEVEL[key] ?? 13;
}
