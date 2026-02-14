import { useEffect, useState } from "react";
import type { MitigationStep, Risk } from "../types";

const API = "/api";

const LIKELIHOOD_LABELS = ["1: Not Likely", "2: Low Likely", "3: Likely", "4: High Likely", "5: Near Certain"];
const LIKELIHOOD_PERCENT = [">1% to ≤20%", ">20% to ≤40%", ">40% to ≤60%", ">60% to ≤80%", ">80% to ≤99%"];
const CONSEQUENCE_LABELS = ["1: Minimal", "2: Minor", "3: Moderate", "4: Significant", "5: Severe"];

const MATRIX_COLOR: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#ef4444",
};

// Numerical risk level 1-25 (same mapping as RiskMatrix / server)
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

function lcToCoord(l: number, c: number, cellSize: number, padding: { top: number; left: number }, labelWidth: number, labelHeight: number) {
  const x = padding.left + labelWidth + (Math.max(1, Math.min(5, c)) - 0.5) * cellSize;
  const y = padding.top + labelHeight + (5 - Math.max(1, Math.min(5, l))) * cellSize + cellSize / 2;
  return { x, y };
}

interface RiskMitigationMatrixProps {
  risk: Risk;
  /** When provided, use these steps instead of fetching. Matrix redraws when steps change. */
  steps?: MitigationStep[] | null;
  /** When true, show the original (immutable) risk level on the matrix. No arrow from original. */
  showOriginalLxC?: boolean;
}

interface PointInfo {
  l: number;
  c: number;
  label: string;
  isOriginal?: boolean;
  isCurrent: boolean;
  isCompleted: boolean;
  /** Current merged with this completed step: X on filled circle, no arrow from prior */
  isCurrentAndCompleted?: boolean;
  /** Original and Current at same L×C: diamond + X overlay */
  isOriginalAndCurrent?: boolean;
}

export function RiskMitigationMatrix({ risk, steps: stepsProp, showOriginalLxC = false }: RiskMitigationMatrixProps) {
  const [stepsInternal, setStepsInternal] = useState<MitigationStep[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [showRLNumbers, setShowRLNumbers] = useState(true);

  // Use prop when provided; otherwise fetch
  const useProp = stepsProp !== undefined;
  useEffect(() => {
    if (useProp) return;
    fetch(`${API}/risks/${risk.id}/mitigation-steps`)
      .then((r) => r.json())
      .then((data: MitigationStep[]) => setStepsInternal(Array.isArray(data) ? data.sort((a, b) => a.sequenceOrder - b.sequenceOrder) : []))
      .catch(() => setStepsInternal([]))
      .finally(() => setLoadingInternal(false));
  }, [risk.id, useProp]);

  const steps = useProp ? (Array.isArray(stepsProp) ? stepsProp : []) : stepsInternal;
  const loading = useProp ? false : loadingInternal;

  // Find if current L×C matches a completed step (risk was updated from that step)
  const completedStepMatchingCurrent = steps.find(
    (s) =>
      !!s.actualCompletedAt &&
      s.actualLikelihood != null &&
      s.actualConsequence != null &&
      s.actualLikelihood === risk.likelihood &&
      s.actualConsequence === risk.consequence
  );

  const origL = risk.originalLikelihood ?? risk.likelihood;
  const origC = risk.originalConsequence ?? risk.consequence;
  const originalEqualsCurrent = origL === risk.likelihood && origC === risk.consequence;

  const cellSize = 64;
  const padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const labelWidth = 130;
  const labelHeight = 20;
  const gridW = 5 * cellSize;
  const gridH = 5 * cellSize;
  const totalW = padding.left + labelWidth + gridW + padding.right;
  const totalH = padding.top + labelHeight + gridH + padding.bottom;

  // Build points in order: Original (opt), Current (or merged), Step1, Step2, ...
  // When showOriginalLxC and Original === Current, combine into one symbol (diamond + X)
  const points: PointInfo[] = [];
  if (showOriginalLxC && originalEqualsCurrent && !completedStepMatchingCurrent) {
    points.push({ l: origL, c: origC, label: "Original · Current", isOriginal: false, isCurrent: false, isCompleted: false, isOriginalAndCurrent: true });
    steps.forEach((s, i) => {
      const completed = !!s.actualCompletedAt && s.actualLikelihood != null && s.actualConsequence != null;
      points.push({
        l: completed ? (s.actualLikelihood ?? s.expectedLikelihood) : s.expectedLikelihood,
        c: completed ? (s.actualConsequence ?? s.expectedConsequence) : s.expectedConsequence,
        label: `Step ${i + 1}`,
        isCurrent: false,
        isCompleted: completed,
      });
    });
  } else if (showOriginalLxC && originalEqualsCurrent && completedStepMatchingCurrent) {
    // Original === Current === completed step: show merged Current·Step with diamond+X (one point)
    let addedCombined = false;
    steps.forEach((s, i) => {
      const completed = !!s.actualCompletedAt && s.actualLikelihood != null && s.actualConsequence != null;
      const merged = completed && s.id === completedStepMatchingCurrent!.id;
      if (merged && !addedCombined) {
        points.push({
          l: risk.likelihood,
          c: risk.consequence,
          label: `Original · Current · Step ${i + 1}`,
          isCurrent: true,
          isCompleted: true,
          isCurrentAndCompleted: true,
          isOriginalAndCurrent: true,
        });
        addedCombined = true;
      } else {
        points.push({
          l: completed ? (s.actualLikelihood ?? s.expectedLikelihood) : s.expectedLikelihood,
          c: completed ? (s.actualConsequence ?? s.expectedConsequence) : s.expectedConsequence,
          label: merged ? `Current · Step ${i + 1}` : `Step ${i + 1}`,
          isCurrent: merged,
          isCompleted: completed,
          isCurrentAndCompleted: merged,
        });
      }
    });
  } else if (showOriginalLxC && !originalEqualsCurrent) {
    points.push({ l: origL, c: origC, label: "Original", isOriginal: true, isCurrent: false, isCompleted: false });
  }
  if (completedStepMatchingCurrent && !(showOriginalLxC && originalEqualsCurrent)) {
    steps.forEach((s, i) => {
      const completed = !!s.actualCompletedAt && s.actualLikelihood != null && s.actualConsequence != null;
      const merged = completed && s.id === completedStepMatchingCurrent.id;
      points.push({
        l: completed ? (s.actualLikelihood ?? s.expectedLikelihood) : s.expectedLikelihood,
        c: completed ? (s.actualConsequence ?? s.expectedConsequence) : s.expectedConsequence,
        label: merged ? `Current · Step ${i + 1}` : `Step ${i + 1}`,
        isCurrent: merged,
        isCompleted: completed,
        isCurrentAndCompleted: merged,
      });
    });
  } else if (!(showOriginalLxC && originalEqualsCurrent)) {
    points.push({ l: risk.likelihood, c: risk.consequence, label: "Current", isCurrent: true, isCompleted: false });
    steps.forEach((s, i) => {
      const completed = !!s.actualCompletedAt && s.actualLikelihood != null && s.actualConsequence != null;
      points.push({
        l: completed ? (s.actualLikelihood ?? s.expectedLikelihood) : s.expectedLikelihood,
        c: completed ? (s.actualConsequence ?? s.expectedConsequence) : s.expectedConsequence,
        label: `Step ${i + 1}`,
        isCurrent: false,
        isCompleted: completed,
      });
    });
  }

  // Group points by cell; offset overlapping points so they don't overlap
  const cellToIndices = new Map<string, number[]>();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const key = `${p.l}-${p.c}`;
    if (!cellToIndices.has(key)) cellToIndices.set(key, []);
    cellToIndices.get(key)!.push(i);
  }
  const baseCoords = points.map((p) => lcToCoord(p.l, p.c, cellSize, padding, labelWidth, labelHeight));
  const coords = baseCoords.map((bc, i) => {
    const p = points[i];
    const key = `${p.l}-${p.c}`;
    const indices = cellToIndices.get(key) ?? [i];
    const n = indices.length;
    if (n <= 1) return bc;
    const idx = indices.indexOf(i);
    const offsetX = (idx - (n - 1) / 2) * 12;
    const offsetY = (idx - (n - 1) / 2) * 8;
    return { x: bc.x + offsetX, y: bc.y + offsetY };
  });

  if (loading) {
    return (
      <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
        <p style={{ color: "#6b7280" }}>Loading...</p>
      </div>
    );
  }

  // When using internal fetch and no steps, show message. When steps prop provided (even empty), show matrix.
  if (!useProp && steps.length === 0) {
    return (
      <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
        <p style={{ color: "#6b7280" }}>No mitigation steps. Add steps to see the trajectory.</p>
      </div>
    );
  }

  // Segment paths for arrows. Never draw arrow FROM standalone Original; OK to draw from Current or Original·Current.
  const segments: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  const startIdx = points[0]?.isOriginal ? 1 : 0;
  for (let i = startIdx; i < coords.length - 1; i++) {
    segments.push({ from: coords[i], to: coords[i + 1] });
  }

  return (
    <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          Mitigation Trajectory — 5×5 Matrix
        </h3>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#6b7280", cursor: "pointer" }}>
          <input type="checkbox" checked={showRLNumbers} onChange={(e) => setShowRLNumbers(e.target.checked)} />
          Show RL in cells
        </label>
      </div>
      <div style={{ overflowX: "auto" }}>
        <svg width={totalW} height={totalH} style={{ minWidth: 400 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
            </marker>
          </defs>
          {[1, 2, 3, 4, 5].map((c) => (
            <text key={`c-${c}`} x={padding.left + labelWidth + (c - 0.5) * cellSize} y={padding.top + labelHeight - 4} textAnchor="middle" fontSize={10} fill="#374151">
              {CONSEQUENCE_LABELS[c - 1]}
            </text>
          ))}
          {[1, 2, 3, 4, 5].map((l) => (
            <g key={`l-${l}`}>
              <text x={padding.left + labelWidth - 8} y={padding.top + labelHeight + (5 - l) * cellSize + cellSize / 2} textAnchor="end" fontSize={10} fill="#374151">
                {LIKELIHOOD_LABELS[l - 1]}
              </text>
              <text x={padding.left + labelWidth - 8} y={padding.top + labelHeight + (5 - l) * cellSize + cellSize / 2 + 12} textAnchor="end" fontSize={8} fill="#6b7280">
                {LIKELIHOOD_PERCENT[l - 1]}
              </text>
            </g>
          ))}
          {[1, 2, 3, 4, 5].map((l) =>
            [1, 2, 3, 4, 5].map((c) => {
              const x = padding.left + labelWidth + (c - 1) * cellSize;
              const y = padding.top + labelHeight + (5 - l) * cellSize;
              const rl = getNumericalRL(l, c);
              return (
                <g key={`${l}-${c}`}>
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
                    <text x={x + 10} y={y + 18} textAnchor="start" fontSize={11} fill="#9ca3af" fontWeight={500}>
                      {rl}
                    </text>
                  )}
                </g>
              );
            })
          )}
          {coords.length > 1 && segments.map((seg, i) => (
            <path
              key={i}
              d={`M ${seg.from.x} ${seg.from.y} L ${seg.to.x} ${seg.to.y}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth={2}
              strokeLinecap="round"
              markerEnd="url(#arrowhead)"
            />
          ))}
          {points.map((p, i) => {
            const { x, y } = coords[i];
            const size = p.isCurrent || p.isCurrentAndCompleted || p.isOriginalAndCurrent ? 12 : 10;
            const stepIdx = /Step (\d+)/.test(p.label) ? parseInt(p.label.match(/Step (\d+)/)![1], 10) - 1 : -1;
            const step = stepIdx >= 0 ? steps[stepIdx] : null;
            const tooltipSuffix = step?.mitigationActions ? ` — ${step.mitigationActions.slice(0, 60)}${step.mitigationActions.length > 60 ? "…" : ""}` : "";
            return (
              <g key={i}>
                {p.isOriginalAndCurrent ? (
                  <g>
                    <polygon
                      points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`}
                      fill="none"
                      stroke="#6b7280"
                      strokeWidth={2}
                    />
                    <path
                      d={`M ${x - size * 0.6} ${y - size * 0.6} L ${x + size * 0.6} ${y + size * 0.6} M ${x - size * 0.6} ${y + size * 0.6} L ${x + size * 0.6} ${y - size * 0.6}`}
                      stroke="#1d4ed8"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <title>{p.label}: L{p.l}×C{p.c}{tooltipSuffix}</title>
                  </g>
                ) : p.isOriginal ? (
                  <polygon
                    points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`}
                    fill="none"
                    stroke="#6b7280"
                    strokeWidth={2}
                  >
                    <title>{p.label}: L{p.l}×C{p.c}</title>
                  </polygon>
                ) : p.isCurrentAndCompleted ? (
                  <g>
                    <circle cx={x} cy={y} r={size} fill="#2563eb" stroke="#1e3a8a" strokeWidth={2} />
                    <path
                      d={`M ${x - size * 0.6} ${y - size * 0.6} L ${x + size * 0.6} ${y + size * 0.6} M ${x - size * 0.6} ${y + size * 0.6} L ${x + size * 0.6} ${y - size * 0.6}`}
                      stroke="white"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                    <title>{p.label}: L{p.l}×C{p.c}{tooltipSuffix}</title>
                  </g>
                ) : p.isCurrent ? (
                  <path
                    d={`M ${x - size} ${y - size} L ${x + size} ${y + size} M ${x - size} ${y + size} L ${x + size} ${y - size}`}
                    stroke="#1d4ed8"
                    strokeWidth={2}
                    strokeLinecap="round"
                  >
                    <title>{p.label}: L{p.l}×C{p.c}</title>
                  </path>
                ) : p.isCompleted ? (
                  <circle cx={x} cy={y} r={size} fill="#2563eb" stroke="#1e3a8a" strokeWidth={2}>
                    <title>{p.label}: L{p.l}×C{p.c} (completed){tooltipSuffix}</title>
                  </circle>
                ) : (
                  <circle cx={x} cy={y} r={size} fill="none" stroke="#2563eb" strokeWidth={2}>
                    <title>{p.label}: L{p.l}×C{p.c} (planned){tooltipSuffix}</title>
                  </circle>
                )}
                <text x={x} y={y + 24} textAnchor="middle" fontSize={9} fill="#374151" fontWeight={600}>
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
