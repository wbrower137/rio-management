import { useEffect, useState } from "react";
import type { Opportunity, OpportunityCategory, OrganizationalUnit } from "../types";

interface OpportunityMatrixProps {
  categories: OpportunityCategory[];
  orgUnit: OrganizationalUnit;
  opportunities: Opportunity[];
  onSelectOpportunity?: (id: string) => void;
}

const LIKELIHOOD_LABELS = ["1: Not Likely", "2: Low Likely", "3: Likely", "4: High Likely", "5: Near Certain"];
const IMPACT_LABELS = ["1: Minimal", "2: Minor", "3: Moderate", "4: Significant", "5: Substantial"];

// Opportunity matrix: light purple / medium blue / light blue
const MATRIX_COLOR: Record<string, string> = {
  low: "#ddd6fe",
  moderate: "#60a5fa",
  high: "#38bdf8",
};

function getCellColor(l: number, i: number): string {
  const key = `${Math.max(1, Math.min(5, l))}-${Math.max(1, Math.min(5, i))}`;
  const levels: Record<string, string> = {
    "1-1": "low", "1-2": "low", "1-3": "low", "1-4": "moderate", "1-5": "moderate",
    "2-1": "low", "2-2": "low", "2-3": "moderate", "2-4": "moderate", "2-5": "high",
    "3-1": "low", "3-2": "moderate", "3-3": "moderate", "3-4": "high", "3-5": "high",
    "4-1": "moderate", "4-2": "moderate", "4-3": "high", "4-4": "high", "4-5": "high",
    "5-1": "moderate", "5-2": "high", "5-3": "high", "5-4": "high", "5-5": "high",
  };
  return MATRIX_COLOR[levels[key] ?? "moderate"] + "99";
}

const NUMERICAL_OL: Record<string, number> = {
  "1-1": 1, "1-2": 3, "1-3": 5, "1-4": 9, "1-5": 12,
  "2-1": 2, "2-2": 4, "2-3": 11, "2-4": 15, "2-5": 17,
  "3-1": 6, "3-2": 10, "3-3": 14, "3-4": 19, "3-5": 21,
  "4-1": 7, "4-2": 13, "4-3": 18, "4-4": 22, "4-5": 24,
  "5-1": 8, "5-2": 16, "5-3": 20, "5-4": 23, "5-5": 25,
};

function getNumericalOL(likelihood: number, impact: number): number {
  const key = `${Math.max(1, Math.min(5, likelihood))}-${Math.max(1, Math.min(5, impact))}`;
  return NUMERICAL_OL[key] ?? 13;
}

const LEVEL_BY_CELL: Record<string, keyof typeof MATRIX_COLOR> = {
  "1-1": "low", "1-2": "low", "1-3": "low", "1-4": "moderate", "1-5": "moderate",
  "2-1": "low", "2-2": "low", "2-3": "moderate", "2-4": "moderate", "2-5": "high",
  "3-1": "low", "3-2": "moderate", "3-3": "moderate", "3-4": "high", "3-5": "high",
  "4-1": "moderate", "4-2": "moderate", "4-3": "high", "4-4": "high", "4-5": "high",
  "5-1": "moderate", "5-2": "high", "5-3": "high", "5-4": "high", "5-5": "high",
};

const OL_LEVEL: Record<number, keyof typeof MATRIX_COLOR> = {};
(Object.entries(NUMERICAL_OL) as [string, number][]).forEach(([key, ol]) => {
  OL_LEVEL[ol] = LEVEL_BY_CELL[key] ?? "moderate";
});

function getOLColor(ol: number): string {
  return MATRIX_COLOR[OL_LEVEL[ol] ?? "moderate"];
}

const OFFSET_X = 12;
const OFFSET_Y = 8;

type CellOccupant = { type: "current"; opp: Opportunity } | { type: "original"; opp: Opportunity };

function getPositionInCell(
  cellL: number,
  cellI: number,
  index: number,
  total: number,
  cellSize: number,
  padding: { top: number; left: number },
  labelWidth: number,
  labelHeight: number
): { x: number; y: number } {
  const cellX = padding.left + labelWidth + (cellI - 1) * cellSize;
  const cellY = padding.top + labelHeight + (5 - cellL) * cellSize;
  const x = cellX + cellSize / 2 + (total > 1 ? (index - (total - 1) / 2) * OFFSET_X : 0);
  const y = cellY + cellSize / 2 + (total > 1 ? (index - (total - 1) / 2) * OFFSET_Y : 0);
  return { x, y };
}

function getCurrentCirclePosition(
  o: Opportunity,
  cellOccupants: Map<string, CellOccupant[]>,
  cellSize: number,
  padding: { top: number; left: number },
  labelWidth: number,
  labelHeight: number
): { x: number; y: number } {
  const key = `${o.likelihood}-${o.impact}`;
  const list = cellOccupants.get(key) ?? [];
  const idx = list.findIndex((x) => x.type === "current" && x.opp.id === o.id);
  if (idx < 0) return getPositionInCell(o.likelihood, o.impact, 0, 1, cellSize, padding, labelWidth, labelHeight);
  return getPositionInCell(o.likelihood, o.impact, idx, list.length, cellSize, padding, labelWidth, labelHeight);
}

function getOriginalPosition(
  o: Opportunity,
  cellOccupants: Map<string, CellOccupant[]>,
  cellSize: number,
  padding: { top: number; left: number },
  labelWidth: number,
  labelHeight: number
): { x: number; y: number } {
  const oL = Math.max(1, Math.min(5, o.originalLikelihood ?? o.likelihood));
  const oI = Math.max(1, Math.min(5, o.originalImpact ?? o.impact));
  const key = `${oL}-${oI}`;
  const list = cellOccupants.get(key) ?? [];
  const idx = list.findIndex((x) => x.type === "original" && x.opp.id === o.id);
  if (idx < 0) return getPositionInCell(oL, oI, 0, 1, cellSize, padding, labelWidth, labelHeight);
  return getPositionInCell(oL, oI, idx, list.length, cellSize, padding, labelWidth, labelHeight);
}

type Trend = "up" | "down" | "unchanged";
function getTrend(o: Opportunity): Trend {
  const origL = o.originalLikelihood ?? o.likelihood;
  const origI = o.originalImpact ?? o.impact;
  const origOL = getNumericalOL(origL, origI);
  const currentOL = getNumericalOL(o.likelihood, o.impact);
  if (currentOL > origOL) return "up";
  if (currentOL < origOL) return "down";
  return "unchanged";
}

export function OpportunityMatrix({ categories, orgUnit: _orgUnit, opportunities, onSelectOpportunity }: OpportunityMatrixProps) {
  useEffect(() => { console.log("[OpportunityMatrix] mount", { orgUnitId: _orgUnit?.id, opportunitiesCount: opportunities?.length }); }, [_orgUnit?.id, opportunities?.length]);
  const categoryLabelMap: Record<string, string> = Object.fromEntries(categories.map((c) => [c.code, c.label]));
  const [showOLNumbers, setShowOLNumbers] = useState(true);
  const [showOriginalLevel, setShowOriginalLevel] = useState(false);
  const cellSize = 64;
  const padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const labelWidth = 130;
  const labelHeight = 20;
  const gridW = 5 * cellSize;
  const gridH = 5 * cellSize;
  const totalW = padding.left + labelWidth + gridW + padding.right;
  const totalH = padding.top + labelHeight + gridH + padding.bottom;

  const byCell = new Map<string, Opportunity[]>();
  for (const o of opportunities) {
    const key = `${o.likelihood}-${o.impact}`;
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key)!.push(o);
  }

  const opportunitiesWithOriginalDiff = showOriginalLevel
    ? opportunities.filter((o) => {
        const oL = o.originalLikelihood ?? o.likelihood;
        const oI = o.originalImpact ?? o.impact;
        return oL !== o.likelihood || oI !== o.impact;
      })
    : [];

  const cellOccupants = new Map<string, CellOccupant[]>();
  for (let l = 1; l <= 5; l++) {
    for (let i = 1; i <= 5; i++) {
      const key = `${l}-${i}`;
      const occupants: CellOccupant[] = [];
      if (showOriginalLevel) {
        for (const o of opportunitiesWithOriginalDiff) {
          const oL = o.originalLikelihood ?? o.likelihood;
          const oI = o.originalImpact ?? o.impact;
          if (oL === l && oI === i) occupants.push({ type: "original", opp: o });
        }
      }
      for (const o of byCell.get(key) ?? []) {
        occupants.push({ type: "current", opp: o });
      }
      if (occupants.length > 0) cellOccupants.set(key, occupants);
    }
  }

  const opportunitiesSortedByOL = [...opportunities].sort((a, b) => getNumericalOL(b.likelihood, b.impact) - getNumericalOL(a.likelihood, a.impact));

  return (
    <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>
        5×5 Opportunity Matrix
      </h3>
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ overflowX: "auto" }}>
          <svg width={totalW} height={totalH} style={{ minWidth: 400 }}>
          <defs>
            <marker id="opp-matrix-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>
          </defs>
          {opportunitiesWithOriginalDiff.map((o) => {
            const from = getOriginalPosition(o, cellOccupants, cellSize, padding, labelWidth, labelHeight);
            const to = getCurrentCirclePosition(o, cellOccupants, cellSize, padding, labelWidth, labelHeight);
            return (
              <path
                key={`arrow-${o.id}`}
                d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                fill="none"
                stroke="#6b7280"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                markerEnd="url(#opp-matrix-arrowhead)"
              />
            );
          })}
          {opportunitiesWithOriginalDiff.map((o) => {
            const oL = o.originalLikelihood ?? o.likelihood;
            const oI = o.originalImpact ?? o.impact;
            const { x, y } = getOriginalPosition(o, cellOccupants, cellSize, padding, labelWidth, labelHeight);
            const size = 6;
            return (
              <polygon
                key={`orig-${o.id}`}
                points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`}
                fill="none"
                stroke="#6b7280"
                strokeWidth={1.5}
              >
                <title>{o.opportunityName ?? "Opportunity"}: Original L{oL}×I{oI}</title>
              </polygon>
            );
          })}
          {[1, 2, 3, 4, 5].map((i) => (
            <text key={`i-${i}`} x={padding.left + labelWidth + (i - 0.5) * cellSize} y={padding.top + labelHeight - 4} textAnchor="middle" fontSize={10} fill="#374151">
              {IMPACT_LABELS[i - 1]}
            </text>
          ))}
          {[1, 2, 3, 4, 5].map((l) => (
            <text
              key={`l-${l}`}
              x={padding.left + labelWidth - 8}
              y={padding.top + labelHeight + (5 - l) * cellSize + cellSize / 2}
              textAnchor="end"
              fontSize={10}
              fill="#374151"
            >
              {LIKELIHOOD_LABELS[l - 1]}
            </text>
          ))}
          {[1, 2, 3, 4, 5].map((l) =>
            [1, 2, 3, 4, 5].map((i) => {
              const key = `${l}-${i}`;
              const occupants = cellOccupants.get(key) ?? [];
              const ol = getNumericalOL(l, i);
              const x = padding.left + labelWidth + (i - 1) * cellSize;
              const y = padding.top + labelHeight + (5 - l) * cellSize;
              return (
                <g key={key}>
                  <rect x={x + 2} y={y + 2} width={cellSize - 4} height={cellSize - 4} fill={getCellColor(l, i)} stroke="#d1d5db" strokeWidth={1} rx={4} />
                  {showOLNumbers && (
                    <text x={x + 10} y={y + 18} textAnchor="start" fontSize={11} fill="#9ca3af" fontWeight={500}>
                      {ol}
                    </text>
                  )}
                  {occupants.map((occ, idx) => {
                    if (occ.type !== "current") return null;
                    const opp = occ.opp;
                    const { x: cx, y: cy } = getPositionInCell(l, i, idx, occupants.length, cellSize, padding, labelWidth, labelHeight);
                    return (
                      <circle
                        key={opp.id}
                        cx={cx}
                        cy={cy}
                        r={occupants.length > 1 ? 6 : 10}
                        fill={MATRIX_COLOR[opp.opportunityLevel ?? "moderate"]}
                        stroke="#1f2937"
                        strokeWidth={1}
                        onClick={onSelectOpportunity ? () => onSelectOpportunity(opp.id) : undefined}
                        style={onSelectOpportunity ? { cursor: "pointer" } : undefined}
                      >
                        <title>{opp.opportunityName ? `${opp.opportunityName} — ` : ""}Condition: {opp.opportunityCondition ?? ""} | If: {opp.opportunityIf ?? ""} | Then: {opp.opportunityThen ?? ""} (L{opp.likelihood}×I{opp.impact} → {opp.opportunityLevel ?? "moderate"})</title>
                      </circle>
                    );
                  })}
                </g>
              );
            })
          )}
          </svg>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", fontSize: "0.875rem", color: "#6b7280" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" checked={showOLNumbers} onChange={(e) => setShowOLNumbers(e.target.checked)} />
              Show OL in cells
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" checked={showOriginalLevel} onChange={(e) => setShowOriginalLevel(e.target.checked)} />
              Show original opportunity level
            </label>
          </div>
        </div>
        {opportunities.length > 0 && (
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Opportunities by OL (highest first)</h4>
            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>OL</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 600, color: "#6b7280" }}>L</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 600, color: "#6b7280" }}>I</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 600, color: "#6b7280" }} title="Trend: original → current">Trend</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>Category</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>Opportunity Name</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunitiesSortedByOL.map((o) => {
                    const trend = getTrend(o);
                    return (
                      <tr key={o.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: getOLColor(getNumericalOL(o.likelihood, o.impact)) }}>{getNumericalOL(o.likelihood, o.impact)}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{o.likelihood}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{o.impact}</td>
                        <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontSize: "1.1rem" }} title={trend === "up" ? "Increased from original" : trend === "down" ? "Decreased from original" : "Unchanged from original"}>
                          {trend === "up" ? "↑" : trend === "down" ? "↓" : "↔"}
                        </td>
                        <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280" }}>{o.category ? categoryLabelMap[o.category] ?? o.category : "—"}</td>
                        <td style={{ padding: "0.5rem 0.75rem", maxWidth: 280, fontSize: "0.8rem" }} title={[o.opportunityCondition, o.opportunityIf, o.opportunityThen].filter(Boolean).join(" → ")}>
                          {onSelectOpportunity ? (
                            <button
                              type="button"
                              onClick={() => onSelectOpportunity(o.id)}
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", textDecoration: "underline" }}
                            >
                              {(o.opportunityName ?? o.opportunityCondition ?? "").slice(0, 50)}{(o.opportunityName ?? o.opportunityCondition ?? "").length > 50 ? "…" : ""}
                            </button>
                          ) : (
                            (o.opportunityName ?? o.opportunityCondition ?? "").slice(0, 50) + ((o.opportunityName ?? o.opportunityCondition ?? "").length > 50 ? "…" : "")
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {opportunities.length === 0 && (
        <p style={{ margin: "1rem 0 0", fontSize: "0.875rem", color: "#6b7280" }}>
          No opportunities to plot. Add opportunities in the Opportunity Register.
        </p>
      )}
    </div>
  );
}
