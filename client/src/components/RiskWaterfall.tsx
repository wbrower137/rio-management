import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceArea,
} from "recharts";
import type { OrganizationalUnit, Risk } from "../types";

const API = "/api";

// RL bands consistent with 5x5 matrix: low (green), moderate (yellow), high (red)
const RL_BANDS = [
  { y1: 1, y2: 6.5, fill: "#22c55e33" },   // low: RL 1-6
  { y1: 6.5, y2: 16.5, fill: "#eab30833" }, // moderate: RL 7-16
  { y1: 16.5, y2: 25, fill: "#ef444433" },  // high: RL 17-25
];

interface RiskWaterfallProps {
  orgUnit: OrganizationalUnit;
  risks: Risk[];
  preselectedRiskId?: string;
}

interface WaterfallPoint {
  date: string;
  /** Unix ms for time-scaled X axis (spacing by actual time) */
  timestamp: number;
  planned?: number;
  actual?: number;
  /** Original risk level (constant from creation date), when showOriginalLevel */
  original?: number;
  plannedL?: number;
  plannedC?: number;
  plannedMitigationActions?: string;
  actualL?: number;
  actualC?: number;
  actualSource?: "risk_update" | "mitigation_step";
  actualIsOriginal?: boolean;
}

export function RiskWaterfall({ orgUnit, risks, preselectedRiskId }: RiskWaterfallProps) {
  const [selectedRiskId, setSelectedRiskId] = useState<string>(preselectedRiskId ?? "");
  const [data, setData] = useState<WaterfallPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOriginalLevel, setShowOriginalLevel] = useState(false);

  useEffect(() => {
    if (!selectedRiskId) {
      setData([]);
      return;
    }
    setLoading(true);
    fetch(`${API}/risks/${selectedRiskId}/waterfall`)
      .then((r) => r.json())
      .then(({ planned, actual }: {
        planned: { date: string; riskLevel: number; likelihood: number; consequence: number; mitigationActions?: string }[];
        actual: { date: string; riskLevel: number; likelihood: number; consequence: number; source?: string; isOriginal?: boolean }[];
      }) => {
        const allDates = new Set<string>();
        planned.forEach((p) => allDates.add(p.date.slice(0, 10)));
        actual.forEach((a) => allDates.add(a.date.slice(0, 10)));
        const sortedDates = [...allDates].sort();

        const plannedByDate = new Map<string, { riskLevel: number; likelihood: number; consequence: number; mitigationActions?: string }>();
        for (const p of planned) {
          const d = p.date.slice(0, 10);
          plannedByDate.set(d, { riskLevel: p.riskLevel, likelihood: p.likelihood, consequence: p.consequence, mitigationActions: p.mitigationActions });
        }
        const actualByDate = new Map<string, { riskLevel: number; likelihood: number; consequence: number; source?: string; isOriginal?: boolean }>();
        for (const a of actual) {
          const d = a.date.slice(0, 10);
          actualByDate.set(d, { riskLevel: a.riskLevel, likelihood: a.likelihood, consequence: a.consequence, source: a.source, isOriginal: a.isOriginal });
        }

        const firstOriginal = actual.find((a) => a.isOriginal);
        const originalRiskLevel = firstOriginal?.riskLevel;
        const creationDate = firstOriginal ? firstOriginal.date.slice(0, 10) : null;

        let lastPlanned: { riskLevel: number; likelihood: number; consequence: number; mitigationActions?: string } | undefined;
        let lastActual: { riskLevel: number; likelihood: number; consequence: number; source?: string; isOriginal?: boolean } | undefined;
        const points: WaterfallPoint[] = [];
        for (const d of sortedDates) {
          if (plannedByDate.has(d)) lastPlanned = plannedByDate.get(d);
          if (actualByDate.has(d)) lastActual = actualByDate.get(d);
          points.push({
            date: d,
            timestamp: new Date(d).getTime(),
            planned: lastPlanned?.riskLevel,
            actual: lastActual?.riskLevel,
            original: creationDate && d >= creationDate && originalRiskLevel != null ? originalRiskLevel : undefined,
            plannedL: lastPlanned?.likelihood,
            plannedC: lastPlanned?.consequence,
            plannedMitigationActions: lastPlanned?.mitigationActions,
            actualL: lastActual?.likelihood,
            actualC: lastActual?.consequence,
            actualSource: lastActual?.source as "risk_update" | "mitigation_step" | undefined,
            actualIsOriginal: lastActual?.isOriginal,
          });
        }
        setData(points);
      })
      .catch((e) => console.error("Failed to load waterfall:", e))
      .finally(() => setLoading(false));
  }, [selectedRiskId]);

  useEffect(() => {
    if (preselectedRiskId) setSelectedRiskId(preselectedRiskId);
  }, [preselectedRiskId]);

  const showSelector = !preselectedRiskId;

  return (
    <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>
        Risk Level vs. Time (Waterfall)
      </h3>
      {showSelector && (
        <>
          <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "#6b7280" }}>
            Select a risk to see planned (from mitigation steps) vs actual (from version history and step completions). Lower = better.
          </p>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#6b7280" }}>Risk</label>
            <select
              value={selectedRiskId}
              onChange={(e) => setSelectedRiskId(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db", minWidth: 320 }}
            >
              <option value="">— Select a risk —</option>
              {risks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.riskName ?? (r.riskCondition ?? (r as { riskStatement?: string }).riskStatement ?? "").slice(0, 50)} (L{r.likelihood}×C{r.consequence})
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {loading && <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>Loading...</p>}
      {!selectedRiskId && (
        <p style={{ padding: "2rem", color: "#6b7280", textAlign: "center" }}>
          Select a risk above to view its planned vs actual risk level over time.
        </p>
      )}
      {selectedRiskId && !loading && data.length === 0 && (
        <p style={{ padding: "2rem", color: "#6b7280", textAlign: "center" }}>
          No planned or actual data yet. Add mitigation steps and update the risk to build the waterfall.
        </p>
      )}
      {selectedRiskId && !loading && data.length > 0 && (
        <div style={{ width: "100%", height: 300 }}>
          <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#6b7280", cursor: "pointer" }}>
              <input type="checkbox" checked={showOriginalLevel} onChange={(e) => setShowOriginalLevel(e.target.checked)} />
              Show original risk level
            </label>
          </div>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              {RL_BANDS.map((band, i) => (
                <ReferenceArea key={i} y1={band.y1} y2={band.y2} fill={band.fill} />
              ))}
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 11 }}
                tickFormatter={(ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[1, 25]} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0]?.payload as WaterfallPoint | undefined;
                  if (!point) return null;
                  const dateLabel = point.date ?? (typeof label === "number" ? new Date(label).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : String(label));
                  const items: string[] = [];
                  if (point.actual != null) {
                    const lc = point.actualL != null && point.actualC != null ? ` (L${point.actualL}×C${point.actualC})` : "";
                    const label = point.actualIsOriginal ? "Original" : "Current";
                    const src = point.actualSource === "mitigation_step" ? " — mitigation step" : point.actualSource === "risk_update" ? (point.actualIsOriginal ? " — creation" : " — risk update") : "";
                    items.push(`Actual (${label}): ${point.actual}${lc}${src}`);
                  }
                  if (point.planned != null) {
                    const lc = point.plannedL != null && point.plannedC != null ? ` (L${point.plannedL}×C${point.plannedC})` : "";
                    const action = point.plannedMitigationActions
                      ? ` — ${point.plannedMitigationActions.length > 80 ? point.plannedMitigationActions.slice(0, 80) + "…" : point.plannedMitigationActions}`
                      : "";
                    items.push(`Planned: ${point.planned}${lc}${action}`);
                  }
                  if (point.original != null) {
                    items.push(`Original: ${point.original} (from creation)`);
                  }
                  return (
                    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "0.5rem 0.75rem", fontSize: "0.875rem", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Date: {dateLabel}</div>
                      {items.map((t) => (
                        <div key={t} style={{ color: "#374151" }}>{t}</div>
                      ))}
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="top" />
              {showOriginalLevel && (
                <Line type="monotone" dataKey="original" stroke="#6b7280" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Original" connectNulls />
              )}
              <Line type="monotone" dataKey="planned" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Planned" connectNulls />
              <Line type="monotone" dataKey="actual" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Actual" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
