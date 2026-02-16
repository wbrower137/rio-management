import { useRef, useState } from "react";
import type { Category, OrganizationalUnit, Risk } from "../types";
import { exportElementAsPng } from "../utils/exportPng";

interface RiskMatrixProps {
  categories: Category[];
  orgUnit: OrganizationalUnit;
  risks: Risk[];
  onSelectRisk?: (riskId: string) => void;
  /** Callback to get the exportable element for report capture */
  onExportRef?: (el: HTMLDivElement | null) => void;
}

const LIKELIHOOD_LABELS = ["1: Not Likely", "2: Low Likely", "3: Likely", "4: High Likely", "5: Near Certain"];
const LIKELIHOOD_PERCENT = [">1% to ≤20%", ">20% to ≤40%", ">40% to ≤60%", ">60% to ≤80%", ">80% to ≤99%"];
const CONSEQUENCE_LABELS = ["1: Minimal", "2: Minor", "3: Moderate", "4: Significant", "5: Severe"];

// DoD 5x5 matrix: (likelihood, consequence) -> low, moderate, high
const MATRIX_COLOR: Record<string, string> = {
  low: "#22c55e",      // green
  moderate: "#eab308", // yellow
  high: "#ef4444",     // red
};

function getCellColor(l: number, c: number): string {
  const key = `${Math.max(1, Math.min(5, l))}-${Math.max(1, Math.min(5, c))}`;
  const levels: Record<string, string> = {
    "1-1": "low", "1-2": "low", "1-3": "low", "1-4": "moderate", "1-5": "moderate",
    "2-1": "low", "2-2": "low", "2-3": "moderate", "2-4": "moderate", "2-5": "high",
    "3-1": "low", "3-2": "moderate", "3-3": "moderate", "3-4": "high", "3-5": "high",
    "4-1": "moderate", "4-2": "moderate", "4-3": "high", "4-4": "high", "4-5": "high",
    "5-1": "moderate", "5-2": "high", "5-3": "high", "5-4": "high", "5-5": "high",
  };
  return MATRIX_COLOR[levels[key] ?? "moderate"] + "33";
}

// Numerical risk level 1-25 (same mapping as server) for sorting
const NUMERICAL_RL: Record<string, number> = {
  "1-1": 1, "1-2": 3, "1-3": 5, "1-4": 9, "1-5": 12,
  "2-1": 2, "2-2": 4, "2-3": 11, "2-4": 15, "2-5": 17,
  "3-1": 6, "3-2": 10, "3-3": 14, "3-4": 19, "3-5": 21,
  "4-1": 7, "4-2": 13, "4-3": 18, "4-4": 22, "4-5": 24,
  "5-1": 8, "5-2": 16, "5-3": 20, "5-4": 23, "5-5": 25,
};

function getNumericalRL(likelihood: number, consequence: number): number {
  const key = `${Math.max(1, Math.min(5, likelihood))}-${Math.max(1, Math.min(5, consequence))}`;
  return NUMERICAL_RL[key] ?? 13;
}

// Numerical RL (1-25) → low / moderate / high for table cell color (same as matrix cells)
const RL_LEVEL: Record<number, keyof typeof MATRIX_COLOR> = {};
const LEVEL_BY_CELL: Record<string, keyof typeof MATRIX_COLOR> = {
  "1-1": "low", "1-2": "low", "1-3": "low", "1-4": "moderate", "1-5": "moderate",
  "2-1": "low", "2-2": "low", "2-3": "moderate", "2-4": "moderate", "2-5": "high",
  "3-1": "low", "3-2": "moderate", "3-3": "moderate", "3-4": "high", "3-5": "high",
  "4-1": "moderate", "4-2": "moderate", "4-3": "high", "4-4": "high", "4-5": "high",
  "5-1": "moderate", "5-2": "high", "5-3": "high", "5-4": "high", "5-5": "high",
};
(Object.entries(NUMERICAL_RL) as [string, number][]).forEach(([key, rl]) => {
  RL_LEVEL[rl] = LEVEL_BY_CELL[key] ?? "moderate";
});

function getRLColor(rl: number): string {
  return MATRIX_COLOR[RL_LEVEL[rl] ?? "moderate"];
}

const OFFSET_X = 12;
const OFFSET_Y = 8;

type CellOccupant = { type: "current"; risk: Risk } | { type: "original"; risk: Risk };

function getPositionInCell(
  cellL: number,
  cellC: number,
  index: number,
  total: number,
  cellSize: number,
  padding: { top: number; left: number },
  labelWidth: number,
  labelHeight: number
): { x: number; y: number } {
  const cellX = padding.left + labelWidth + (cellC - 1) * cellSize;
  const cellY = padding.top + labelHeight + (5 - cellL) * cellSize;
  const x = cellX + cellSize / 2 + (total > 1 ? (index - (total - 1) / 2) * OFFSET_X : 0);
  const y = cellY + cellSize / 2 + (total > 1 ? (index - (total - 1) / 2) * OFFSET_Y : 0);
  return { x, y };
}

function getCurrentCirclePosition(
  r: Risk,
  cellOccupants: Map<string, CellOccupant[]>,
  cellSize: number,
  padding: { top: number; left: number },
  labelWidth: number,
  labelHeight: number
): { x: number; y: number } {
  const key = `${r.likelihood}-${r.consequence}`;
  const list = cellOccupants.get(key) ?? [];
  const idx = list.findIndex((x) => x.type === "current" && x.risk.id === r.id);
  if (idx < 0) return getPositionInCell(r.likelihood, r.consequence, 0, 1, cellSize, padding, labelWidth, labelHeight);
  return getPositionInCell(r.likelihood, r.consequence, idx, list.length, cellSize, padding, labelWidth, labelHeight);
}

function getOriginalPosition(
  r: Risk,
  cellOccupants: Map<string, CellOccupant[]>,
  cellSize: number,
  padding: { top: number; left: number },
  labelWidth: number,
  labelHeight: number
): { x: number; y: number } {
  const oL = Math.max(1, Math.min(5, r.originalLikelihood ?? r.likelihood));
  const oC = Math.max(1, Math.min(5, r.originalConsequence ?? r.consequence));
  const key = `${oL}-${oC}`;
  const list = cellOccupants.get(key) ?? [];
  const idx = list.findIndex((x) => x.type === "original" && x.risk.id === r.id);
  if (idx < 0) return getPositionInCell(oL, oC, 0, 1, cellSize, padding, labelWidth, labelHeight);
  return getPositionInCell(oL, oC, idx, list.length, cellSize, padding, labelWidth, labelHeight);
}

type Trend = "up" | "down" | "unchanged";
function getTrend(r: Risk): Trend {
  const origL = r.originalLikelihood ?? r.likelihood;
  const origC = r.originalConsequence ?? r.consequence;
  const origRL = getNumericalRL(origL, origC);
  const currentRL = getNumericalRL(r.likelihood, r.consequence);
  if (currentRL > origRL) return "up";
  if (currentRL < origRL) return "down";
  return "unchanged";
}

export function RiskMatrix({ categories, orgUnit, risks, onSelectRisk, onExportRef }: RiskMatrixProps) {
  const categoryLabelMap: Record<string, string> = Object.fromEntries(categories.map((c) => [c.code, c.label]));
  const [showRLNumbers, setShowRLNumbers] = useState(true);
  const [showOriginalLevel, setShowOriginalLevel] = useState(false);
  const cellSize = 64;
  const padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const labelWidth = 130;
  const labelHeight = 20;
  const gridW = 5 * cellSize;
  const gridH = 5 * cellSize;
  const totalW = padding.left + labelWidth + gridW + padding.right;
  const totalH = padding.top + labelHeight + gridH + padding.bottom;

  // Group risks by (likelihood, consequence) for overlapping display
  const byCell = new Map<string, Risk[]>();
  for (const r of risks) {
    const key = `${r.likelihood}-${r.consequence}`;
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key)!.push(r);
  }

  // Risks that have original !== current (for arrows when showOriginalLevel)
  const risksWithOriginalDiff = showOriginalLevel
    ? risks.filter((r) => {
        const oL = r.originalLikelihood ?? r.likelihood;
        const oC = r.originalConsequence ?? r.consequence;
        return oL !== r.likelihood || oC !== r.consequence;
      })
    : [];

  // Per-cell occupants: originals (when showOriginalLevel) + currents, so all markers in a cell share one offset layout
  const cellOccupants = new Map<string, CellOccupant[]>();
  for (let l = 1; l <= 5; l++) {
    for (let c = 1; c <= 5; c++) {
      const key = `${l}-${c}`;
      const occupants: CellOccupant[] = [];
      if (showOriginalLevel) {
        for (const r of risksWithOriginalDiff) {
          const oL = r.originalLikelihood ?? r.likelihood;
          const oC = r.originalConsequence ?? r.consequence;
          if (oL === l && oC === c) occupants.push({ type: "original", risk: r });
        }
      }
      for (const r of byCell.get(key) ?? []) {
        occupants.push({ type: "current", risk: r });
      }
      if (occupants.length > 0) cellOccupants.set(key, occupants);
    }
  }

  // Risks sorted by RL descending (highest first)
  const risksSortedByRL = [...risks].sort((a, b) => getNumericalRL(b.likelihood, b.consequence) - getNumericalRL(a.likelihood, a.consequence));

  const exportRef = useRef<HTMLDivElement>(null);
  const handleExportPng = async () => {
    if (!exportRef.current) return;
    const safe = (orgUnit?.name ?? "export").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    await exportElementAsPng(exportRef.current, `Risk-Matrix-${safe}.png`);
  };

  return (
    <div
      ref={(el) => {
        (exportRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        onExportRef?.(el ?? null);
      }}
      style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          5×5 Risk Matrix — DoD MIL-STD-882
        </h3>
        <button
          onClick={handleExportPng}
          style={{ padding: "0.5rem 1rem", background: "#6b7280", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" }}
          title="Export as PNG (16:9)"
        >
          Export PNG
        </button>
      </div>
      <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ overflowX: "auto" }}>
          <svg width={totalW} height={totalH} style={{ minWidth: 400 }}>
          <defs>
            <marker id="matrix-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
            </marker>
          </defs>
          {/* Arrows from original to current (when showOriginalLevel and orig !== current) */}
          {risksWithOriginalDiff.map((r) => {
            const from = getOriginalPosition(r, cellOccupants, cellSize, padding, labelWidth, labelHeight);
            const to = getCurrentCirclePosition(r, cellOccupants, cellSize, padding, labelWidth, labelHeight);
            return (
              <path
                key={`arrow-${r.id}`}
                d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
                fill="none"
                stroke="#6b7280"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                markerEnd="url(#matrix-arrowhead)"
              />
            );
          })}
          {/* Original points (diamond) when showOriginalLevel and orig !== current */}
          {risksWithOriginalDiff.map((r) => {
            const oL = r.originalLikelihood ?? r.likelihood;
            const oC = r.originalConsequence ?? r.consequence;
            const { x, y } = getOriginalPosition(r, cellOccupants, cellSize, padding, labelWidth, labelHeight);
            const size = 6;
            return (
              <polygon
                key={`orig-${r.id}`}
                points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`}
                fill="none"
                stroke="#6b7280"
                strokeWidth={1.5}
              >
                <title>{r.riskName ?? "Risk"}: Original L{oL}×C{oC}</title>
              </polygon>
            );
          })}
          {/* Consequence / Severity labels (x-axis, horizontal) */}
          {[1, 2, 3, 4, 5].map((c) => (
            <text
              key={`c-${c}`}
              x={padding.left + labelWidth + (c - 0.5) * cellSize}
              y={padding.top + labelHeight - 4}
              textAnchor="middle"
              fontSize={10}
              fill="#374151"
            >
              {CONSEQUENCE_LABELS[c - 1]}
            </text>
          ))}
          {/* Likelihood labels (y-axis, vertical) */}
          {[1, 2, 3, 4, 5].map((l) => (
            <g key={`l-${l}`}>
              <text
                x={padding.left + labelWidth - 8}
                y={padding.top + labelHeight + (5 - l) * cellSize + cellSize / 2}
                textAnchor="end"
                fontSize={10}
                fill="#374151"
              >
                {LIKELIHOOD_LABELS[l - 1]}
              </text>
              <text
                x={padding.left + labelWidth - 8}
                y={padding.top + labelHeight + (5 - l) * cellSize + cellSize / 2 + 12}
                textAnchor="end"
                fontSize={8}
                fill="#6b7280"
              >
                {LIKELIHOOD_PERCENT[l - 1]}
              </text>
            </g>
          ))}
          {/* Grid cells: x = consequence (column), y = likelihood (row, L=5 at top) */}
          {[1, 2, 3, 4, 5].map((l) =>
            [1, 2, 3, 4, 5].map((c) => {
              const key = `${l}-${c}`;
              const occupants = cellOccupants.get(key) ?? [];
              const rl = getNumericalRL(l, c);
              const x = padding.left + labelWidth + (c - 1) * cellSize;
              const y = padding.top + labelHeight + (5 - l) * cellSize;
              return (
                <g key={key}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={cellSize - 4}
                    height={cellSize - 4}
                    fill={getCellColor(l, c)}
                    stroke="#d1d5db"
                    strokeWidth={1}
                    rx={4}
                  />
                  {showRLNumbers && (
                    <text
                      x={x + 10}
                      y={y + 18}
                      textAnchor="start"
                      fontSize={11}
                      fill="#9ca3af"
                      fontWeight={500}
                    >
                      {rl}
                    </text>
                  )}
                  {occupants.map((occ, i) => {
                    if (occ.type !== "current") return null;
                    const r = occ.risk;
                    const { x: cx, y: cy } = getPositionInCell(l, c, i, occupants.length, cellSize, padding, labelWidth, labelHeight);
                    return (
                      <circle
                        key={r.id}
                        cx={cx}
                        cy={cy}
                        r={occupants.length > 1 ? 6 : 10}
                        fill={MATRIX_COLOR[r.riskLevel ?? "moderate"]}
                        stroke="#1f2937"
                        strokeWidth={1}
                        onClick={onSelectRisk ? () => onSelectRisk(r.id) : undefined}
                        style={onSelectRisk ? { cursor: "pointer" } : undefined}
                      >
                        <title>{r.riskName ? `${r.riskName} — ` : ""}Condition: {r.riskCondition ?? (r as { riskStatement?: string }).riskStatement ?? ""} | If: {r.riskIf ?? ""} | Then: {r.riskThen ?? ""} (L{r.likelihood}×C{r.consequence} → {r.riskLevel ?? "moderate"})</title>
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
              <input type="checkbox" checked={showRLNumbers} onChange={(e) => setShowRLNumbers(e.target.checked)} />
              Show RL in cells
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <input type="checkbox" checked={showOriginalLevel} onChange={(e) => setShowOriginalLevel(e.target.checked)} />
              Show original risk level
            </label>
          </div>
        </div>
        {risks.length > 0 && (
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", fontWeight: 600 }}>Risks by RL (highest first)</h4>
            <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>RL</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 600, color: "#6b7280" }}>L</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 600, color: "#6b7280" }}>C</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontWeight: 600, color: "#6b7280" }} title="Trend: original → current">Trend</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>Category</th>
                    <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>Risk Name</th>
                  </tr>
                </thead>
                <tbody>
                  {risksSortedByRL.map((r) => {
                    const trend = getTrend(r);
                    return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600, color: getRLColor(getNumericalRL(r.likelihood, r.consequence)) }}>{getNumericalRL(r.likelihood, r.consequence)}</td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{r.likelihood}</td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>{r.consequence}</td>
                      <td style={{ padding: "0.5rem 0.75rem", textAlign: "center", fontSize: "1.1rem" }} title={trend === "up" ? "Increased from original" : trend === "down" ? "Decreased from original" : "Unchanged from original"}>
                        {trend === "up" ? "↑" : trend === "down" ? "↓" : "↔"}
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem", color: "#6b7280" }}>{r.category ? categoryLabelMap[r.category] ?? r.category : "—"}</td>
                      <td style={{ padding: "0.5rem 0.75rem", maxWidth: 280, fontSize: "0.8rem" }} title={[r.riskCondition ?? (r as { riskStatement?: string }).riskStatement, r.riskIf, r.riskThen].filter(Boolean).join(" → ")}>
                        {onSelectRisk ? (
                          <button
                            type="button"
                            onClick={() => onSelectRisk(r.id)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", textDecoration: "underline" }}
                          >
                            {(() => {
                              const n = r.riskName ?? (r.riskCondition ?? (r as { riskStatement?: string }).riskStatement ?? "").slice(0, 60);
                              return `${n.slice(0, 50)}${n.length > 50 ? "…" : ""}`;
                            })()}
                          </button>
                        ) : (
                          (() => {
                            const n = r.riskName ?? (r.riskCondition ?? (r as { riskStatement?: string }).riskStatement ?? "").slice(0, 60);
                            return `${n.slice(0, 50)}${n.length > 50 ? "…" : ""}`;
                          })()
                        )}
                      </td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {risks.length === 0 && (
        <p style={{ margin: "1rem 0 0", fontSize: "0.875rem", color: "#6b7280" }}>
          No risks to plot. Add risks in the Risk Register.
        </p>
      )}
    </div>
  );
}
