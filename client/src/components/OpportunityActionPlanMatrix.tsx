import { useEffect, useState } from "react";
import type { Opportunity, OpportunityActionPlanStep } from "../types";

const API = "/api";

const LIKELIHOOD_LABELS = ["1: Not Likely", "2: Low Likely", "3: Likely", "4: High Likely", "5: Near Certain"];
const IMPACT_LABELS = ["1: Minimal", "2: Minor", "3: Moderate", "4: Significant", "5: Substantial"];

// Opportunity matrix: light purple / medium blue / light blue
const MATRIX_COLOR: Record<string, string> = {
  low: "#ddd6fe",
  moderate: "#60a5fa",
  high: "#38bdf8",
};

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

function liToCoord(l: number, i: number, cellSize: number, padding: { top: number; left: number }, labelWidth: number, labelHeight: number) {
  const x = padding.left + labelWidth + (Math.max(1, Math.min(5, i)) - 0.5) * cellSize;
  const y = padding.top + labelHeight + (5 - Math.max(1, Math.min(5, l))) * cellSize + cellSize / 2;
  return { x, y };
}

interface OpportunityActionPlanMatrixProps {
  opportunity: Opportunity;
  steps?: OpportunityActionPlanStep[] | null;
  showOriginalLxI?: boolean;
  onShowOriginalLxIChange?: (value: boolean) => void;
}

interface PointInfo {
  l: number;
  i: number;
  label: string;
  isOriginal?: boolean;
  isCurrent: boolean;
  isCompleted: boolean;
  isCurrentAndCompleted?: boolean;
  isOriginalAndCurrent?: boolean;
}

export function OpportunityActionPlanMatrix({ opportunity, steps: stepsProp, showOriginalLxI = false, onShowOriginalLxIChange }: OpportunityActionPlanMatrixProps) {
  const [stepsInternal, setStepsInternal] = useState<OpportunityActionPlanStep[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(true);
  const [showOLNumbers, setShowOLNumbers] = useState(true);

  const useProp = stepsProp !== undefined;
  useEffect(() => {
    if (useProp) return;
    fetch(`${API}/opportunities/${opportunity.id}/action-plan-steps`)
      .then((r) => r.json())
      .then((data: OpportunityActionPlanStep[]) => setStepsInternal(Array.isArray(data) ? data.sort((a, b) => a.sequenceOrder - b.sequenceOrder) : []))
      .catch(() => setStepsInternal([]))
      .finally(() => setLoadingInternal(false));
  }, [opportunity.id, useProp]);

  const steps = useProp ? (Array.isArray(stepsProp) ? stepsProp : []) : stepsInternal;
  const loading = useProp ? false : loadingInternal;

  const completedStepMatchingCurrent = steps.find(
    (s) =>
      !!s.actualCompletedAt &&
      s.actualLikelihood != null &&
      s.actualImpact != null &&
      s.actualLikelihood === opportunity.likelihood &&
      s.actualImpact === opportunity.impact
  );

  const origL = opportunity.originalLikelihood ?? opportunity.likelihood;
  const origI = opportunity.originalImpact ?? opportunity.impact;
  const originalEqualsCurrent = origL === opportunity.likelihood && origI === opportunity.impact;

  const cellSize = 64;
  const padding = { top: 24, right: 24, bottom: 24, left: 24 };
  const labelWidth = 130;
  const labelHeight = 20;
  const gridW = 5 * cellSize;
  const gridH = 5 * cellSize;
  const totalW = padding.left + labelWidth + gridW + padding.right;
  const totalH = padding.top + labelHeight + gridH + padding.bottom;

  const points: PointInfo[] = [];
  if (showOriginalLxI && originalEqualsCurrent && !completedStepMatchingCurrent) {
    points.push({ l: origL, i: origI, label: "Original · Current", isOriginal: false, isCurrent: false, isCompleted: false, isOriginalAndCurrent: true });
    steps.forEach((s, idx) => {
      const completed = !!s.actualCompletedAt && s.actualLikelihood != null && s.actualImpact != null;
      points.push({
        l: completed ? (s.actualLikelihood ?? s.expectedLikelihood) : s.expectedLikelihood,
        i: completed ? (s.actualImpact ?? s.expectedImpact) : s.expectedImpact,
        label: `Step ${idx + 1}`,
        isCurrent: false,
        isCompleted: completed,
      });
    });
  } else if (showOriginalLxI && originalEqualsCurrent && completedStepMatchingCurrent) {
    let addedCombined = false;
    steps.forEach((s, idx) => {
      const completed = !!s.actualCompletedAt && s.actualLikelihood != null && s.actualImpact != null;
      const merged = completed && s.id === completedStepMatchingCurrent!.id;
      if (merged && !addedCombined) {
        points.push({
          l: opportunity.likelihood,
          i: opportunity.impact,
          label: `Original · Current · Step ${idx + 1}`,
          isCurrent: true,
          isCompleted: true,
          isCurrentAndCompleted: true,
          isOriginalAndCurrent: true,
        });
        addedCombined = true;
      } else {
        points.push({
          l: completed ? (s.actualLikelihood ?? s.expectedLikelihood) : s.expectedLikelihood,
          i: completed ? (s.actualImpact ?? s.expectedImpact) : s.expectedImpact,
          label: merged ? `Current · Step ${idx + 1}` : `Step ${idx + 1}`,
          isCurrent: merged,
          isCompleted: completed,
          isCurrentAndCompleted: merged,
        });
      }
    });
  } else if (showOriginalLxI && !originalEqualsCurrent) {
    points.push({ l: origL, i: origI, label: "Original", isOriginal: true, isCurrent: false, isCompleted: false });
  }
  if (completedStepMatchingCurrent && !(showOriginalLxI && originalEqualsCurrent)) {
    steps.forEach((s, idx) => {
      const completed = !!s.actualCompletedAt && s.actualLikelihood != null && s.actualImpact != null;
      const merged = completed && s.id === completedStepMatchingCurrent.id;
      points.push({
        l: completed ? (s.actualLikelihood ?? s.expectedLikelihood) : s.expectedLikelihood,
        i: completed ? (s.actualImpact ?? s.expectedImpact) : s.expectedImpact,
        label: merged ? `Current · Step ${idx + 1}` : `Step ${idx + 1}`,
        isCurrent: merged,
        isCompleted: completed,
        isCurrentAndCompleted: merged,
      });
    });
  } else if (!(showOriginalLxI && originalEqualsCurrent)) {
    points.push({ l: opportunity.likelihood, i: opportunity.impact, label: "Current", isCurrent: true, isCompleted: false });
    steps.forEach((s, idx) => {
      const completed = !!s.actualCompletedAt && s.actualLikelihood != null && s.actualImpact != null;
      points.push({
        l: completed ? (s.actualLikelihood ?? s.expectedLikelihood) : s.expectedLikelihood,
        i: completed ? (s.actualImpact ?? s.expectedImpact) : s.expectedImpact,
        label: `Step ${idx + 1}`,
        isCurrent: false,
        isCompleted: completed,
      });
    });
  }

  const cellToIndices = new Map<string, number[]>();
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const key = `${p.l}-${p.i}`;
    if (!cellToIndices.has(key)) cellToIndices.set(key, []);
    cellToIndices.get(key)!.push(i);
  }
  const baseCoords = points.map((p) => liToCoord(p.l, p.i, cellSize, padding, labelWidth, labelHeight));
  const coords = baseCoords.map((bc, i) => {
    const p = points[i];
    const key = `${p.l}-${p.i}`;
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

  if (!useProp && steps.length === 0) {
    return (
      <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 600 }}>Action Plan Trajectory — 5×5 Matrix</h3>
        <p style={{ color: "#6b7280", margin: 0 }}>No action plan steps. Add steps to see the trajectory.</p>
      </div>
    );
  }

  const segments: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
  const startIdx = points[0]?.isOriginal ? 1 : 0;
  for (let i = startIdx; i < coords.length - 1; i++) {
    segments.push({ from: coords[i], to: coords[i + 1] });
  }

  return (
    <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 600 }}>
        Action Plan Trajectory — 5×5 Matrix
      </h3>
      <div style={{ overflowX: "auto" }}>
        <svg width={totalW} height={totalH} style={{ minWidth: 400 }}>
          <defs>
            <marker id="opp-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
            </marker>
          </defs>
          {[1, 2, 3, 4, 5].map((i) => (
            <text key={`i-${i}`} x={padding.left + labelWidth + (i - 0.5) * cellSize} y={padding.top + labelHeight - 4} textAnchor="middle" fontSize={10} fill="#374151">
              {IMPACT_LABELS[i - 1]}
            </text>
          ))}
          {[1, 2, 3, 4, 5].map((l) => (
            <text key={`l-${l}`} x={padding.left + labelWidth - 8} y={padding.top + labelHeight + (5 - l) * cellSize + cellSize / 2} textAnchor="end" fontSize={10} fill="#374151">
              {LIKELIHOOD_LABELS[l - 1]}
            </text>
          ))}
          {[1, 2, 3, 4, 5].map((l) =>
            [1, 2, 3, 4, 5].map((i) => {
              const x = padding.left + labelWidth + (i - 1) * cellSize;
              const y = padding.top + labelHeight + (5 - l) * cellSize;
              const ol = getNumericalOL(l, i);
              return (
                <g key={`${l}-${i}`}>
                  <rect x={x + 2} y={y + 2} width={cellSize - 4} height={cellSize - 4} fill={getCellColor(l, i)} stroke="#d1d5db" strokeWidth={1} rx={4} />
                  {showOLNumbers && (
                    <text x={x + 10} y={y + 18} textAnchor="start" fontSize={11} fill="#9ca3af" fontWeight={500}>{ol}</text>
                  )}
                </g>
              );
            })
          )}
          {coords.length > 1 && segments.map((seg, i) => (
            <path key={i} d={`M ${seg.from.x} ${seg.from.y} L ${seg.to.x} ${seg.to.y}`} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" markerEnd="url(#opp-arrowhead)" />
          ))}
          {points.map((p, i) => {
            const { x, y } = coords[i];
            const size = p.isCurrent || p.isCurrentAndCompleted || p.isOriginalAndCurrent ? 12 : 10;
            const stepIdx = /Step (\d+)/.test(p.label) ? parseInt(p.label.match(/Step (\d+)/)![1], 10) - 1 : -1;
            const step = stepIdx >= 0 ? steps[stepIdx] : null;
            const tooltipSuffix = step?.plannedAction ? ` — ${step.plannedAction.slice(0, 60)}${step.plannedAction.length > 60 ? "…" : ""}` : "";
            return (
              <g key={i}>
                {p.isOriginalAndCurrent ? (
                  <g>
                    <polygon points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`} fill="none" stroke="#6b7280" strokeWidth={2} />
                    <path d={`M ${x - size * 0.6} ${y - size * 0.6} L ${x + size * 0.6} ${y + size * 0.6} M ${x - size * 0.6} ${y + size * 0.6} L ${x + size * 0.6} ${y - size * 0.6}`} stroke="#6366f1" strokeWidth={2} strokeLinecap="round" />
                    <title>{p.label}: L{p.l}×I{p.i}{tooltipSuffix}</title>
                  </g>
                ) : p.isOriginal ? (
                  <polygon points={`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`} fill="none" stroke="#6b7280" strokeWidth={2}>
                    <title>{p.label}: L{p.l}×I{p.i}</title>
                  </polygon>
                ) : p.isCurrentAndCompleted ? (
                  <g>
                    <circle cx={x} cy={y} r={size} fill="#6366f1" stroke="#4338ca" strokeWidth={2} />
                    <path d={`M ${x - size * 0.6} ${y - size * 0.6} L ${x + size * 0.6} ${y + size * 0.6} M ${x - size * 0.6} ${y + size * 0.6} L ${x + size * 0.6} ${y - size * 0.6}`} stroke="white" strokeWidth={2} strokeLinecap="round" />
                    <title>{p.label}: L{p.l}×I{p.i}{tooltipSuffix}</title>
                  </g>
                ) : p.isCurrent ? (
                  <path d={`M ${x - size} ${y - size} L ${x + size} ${y + size} M ${x - size} ${y + size} L ${x + size} ${y - size}`} stroke="#6366f1" strokeWidth={2} strokeLinecap="round">
                    <title>{p.label}: L{p.l}×I{p.i}</title>
                  </path>
                ) : p.isCompleted ? (
                  <circle cx={x} cy={y} r={size} fill="#6366f1" stroke="#4338ca" strokeWidth={2}>
                    <title>{p.label}: L{p.l}×I{p.i} (completed){tooltipSuffix}</title>
                  </circle>
                ) : (
                  <circle cx={x} cy={y} r={size} fill="none" stroke="#6366f1" strokeWidth={2}>
                    <title>{p.label}: L{p.l}×I{p.i} (planned){tooltipSuffix}</title>
                  </circle>
                )}
                <text x={x} y={y + 24} textAnchor="middle" fontSize={9} fill="#374151" fontWeight={600}>{p.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem", fontSize: "0.875rem", color: "#6b7280" }}>
        {onShowOriginalLxIChange != null && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={showOriginalLxI} onChange={(e) => onShowOriginalLxIChange(e.target.checked)} />
            Show original L×I
          </label>
        )}
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input type="checkbox" checked={showOLNumbers} onChange={(e) => setShowOLNumbers(e.target.checked)} />
          Show OL in cells
        </label>
      </div>
    </div>
  );
}
