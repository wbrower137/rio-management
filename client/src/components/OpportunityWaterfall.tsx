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
import type { OrganizationalUnit, Opportunity } from "../types";

const API = "/api";

// Same as 5×5 Opportunity Matrix: light purple / medium blue / light blue
const OL_BANDS = [
  { y1: 1, y2: 6.5, fill: "#ddd6fe99" },
  { y1: 6.5, y2: 16.5, fill: "#60a5fa99" },
  { y1: 16.5, y2: 25, fill: "#38bdf899" },
];

interface OpportunityWaterfallProps {
  orgUnit: OrganizationalUnit;
  opportunities: Opportunity[];
  preselectedOpportunityId?: string;
}

interface WaterfallPoint {
  date: string;
  timestamp: number;
  planned?: number;
  actual?: number;
  original?: number;
  plannedL?: number;
  plannedI?: number;
  plannedAction?: string;
  actualL?: number;
  actualI?: number;
  actualSource?: "opportunity_update" | "action_plan_step";
  actualIsOriginal?: boolean;
}

export function OpportunityWaterfall({ orgUnit: _orgUnit, opportunities, preselectedOpportunityId }: OpportunityWaterfallProps) {
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>(preselectedOpportunityId ?? "");
  const [data, setData] = useState<WaterfallPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOriginalLevel, setShowOriginalLevel] = useState(false);

  useEffect(() => {
    if (!selectedOpportunityId) {
      setData([]);
      return;
    }
    setLoading(true);
    fetch(`${API}/opportunities/${selectedOpportunityId}/waterfall`)
      .then((r) => r.json())
      .then(({ planned, actual }: {
        planned: { date: string; opportunityLevel: number; likelihood: number; impact: number; plannedAction?: string }[];
        actual: { date: string; opportunityLevel: number; likelihood: number; impact: number; source?: string; isOriginal?: boolean }[];
      }) => {
        const allDates = new Set<string>();
        planned.forEach((p) => allDates.add(p.date.slice(0, 10)));
        actual.forEach((a) => allDates.add(a.date.slice(0, 10)));
        const sortedDates = [...allDates].sort();

        const plannedByDate = new Map<string, { opportunityLevel: number; likelihood: number; impact: number; plannedAction?: string }>();
        for (const p of planned) {
          const d = p.date.slice(0, 10);
          plannedByDate.set(d, { opportunityLevel: p.opportunityLevel, likelihood: p.likelihood, impact: p.impact, plannedAction: p.plannedAction });
        }
        const actualByDate = new Map<string, { opportunityLevel: number; likelihood: number; impact: number; source?: string; isOriginal?: boolean }>();
        for (const a of actual) {
          const d = a.date.slice(0, 10);
          actualByDate.set(d, { opportunityLevel: a.opportunityLevel, likelihood: a.likelihood, impact: a.impact, source: a.source, isOriginal: a.isOriginal });
        }

        const firstOriginal = actual.find((a) => a.isOriginal);
        const originalOL = firstOriginal?.opportunityLevel;
        const creationDate = firstOriginal ? firstOriginal.date.slice(0, 10) : null;

        let lastPlanned: { opportunityLevel: number; likelihood: number; impact: number; plannedAction?: string } | undefined;
        let lastActual: { opportunityLevel: number; likelihood: number; impact: number; source?: string; isOriginal?: boolean } | undefined;
        const points: WaterfallPoint[] = [];
        for (const d of sortedDates) {
          if (plannedByDate.has(d)) lastPlanned = plannedByDate.get(d);
          if (actualByDate.has(d)) lastActual = actualByDate.get(d);
          points.push({
            date: d,
            timestamp: new Date(d).getTime(),
            planned: lastPlanned?.opportunityLevel,
            actual: lastActual?.opportunityLevel,
            original: creationDate && d >= creationDate && originalOL != null ? originalOL : undefined,
            plannedL: lastPlanned?.likelihood,
            plannedI: lastPlanned?.impact,
            plannedAction: lastPlanned?.plannedAction,
            actualL: lastActual?.likelihood,
            actualI: lastActual?.impact,
            actualSource: lastActual?.source as "opportunity_update" | "action_plan_step" | undefined,
            actualIsOriginal: lastActual?.isOriginal,
          });
        }
        setData(points);
      })
      .catch((e) => console.error("Failed to load waterfall:", e))
      .finally(() => setLoading(false));
  }, [selectedOpportunityId]);

  useEffect(() => {
    if (preselectedOpportunityId) setSelectedOpportunityId(preselectedOpportunityId);
  }, [preselectedOpportunityId]);

  const showSelector = !preselectedOpportunityId;

  return (
    <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>
        Opportunity Level vs. Time (Waterfall)
      </h3>
      {showSelector && (
        <>
          <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "#6b7280" }}>
            Select an opportunity to see planned (from action plan steps) vs actual (from version history and step completions). Higher = better.
          </p>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#6b7280" }}>Opportunity</label>
            <select
              value={selectedOpportunityId}
              onChange={(e) => setSelectedOpportunityId(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db", minWidth: 320 }}
            >
              <option value="">— Select an opportunity —</option>
              {opportunities.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.opportunityName ?? o.opportunityCondition?.slice(0, 50)} (L{o.likelihood}×I{o.impact})
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {loading && <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>Loading...</p>}
      {!selectedOpportunityId && (
        <p style={{ padding: "2rem", color: "#6b7280", textAlign: "center" }}>
          Select an opportunity above to view its planned vs actual opportunity level over time.
        </p>
      )}
      {selectedOpportunityId && !loading && data.length === 0 && (
        <p style={{ padding: "2rem", color: "#6b7280", textAlign: "center" }}>
          No planned or actual data yet. Add action plan steps and update the opportunity to build the waterfall.
        </p>
      )}
      {selectedOpportunityId && !loading && data.length > 0 && (
        <div style={{ width: "100%", height: 300 }}>
          <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#6b7280", cursor: "pointer" }}>
              <input type="checkbox" checked={showOriginalLevel} onChange={(e) => setShowOriginalLevel(e.target.checked)} />
              Show original opportunity level
            </label>
          </div>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              {OL_BANDS.map((band, i) => (
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
                    const li = point.actualL != null && point.actualI != null ? ` (L${point.actualL}×I${point.actualI})` : "";
                    const lbl = point.actualIsOriginal ? "Original" : "Current";
                    const src = point.actualSource === "action_plan_step" ? " — action step" : point.actualSource === "opportunity_update" ? (point.actualIsOriginal ? " — creation" : " — update") : "";
                    items.push(`Actual (${lbl}): ${point.actual}${li}${src}`);
                  }
                  if (point.planned != null) {
                    const li = point.plannedL != null && point.plannedI != null ? ` (L${point.plannedL}×I${point.plannedI})` : "";
                    const action = point.plannedAction ? ` — ${point.plannedAction.length > 80 ? point.plannedAction.slice(0, 80) + "…" : point.plannedAction}` : "";
                    items.push(`Planned: ${point.planned}${li}${action}`);
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
