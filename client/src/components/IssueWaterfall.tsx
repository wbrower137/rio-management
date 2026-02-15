import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceArea } from "recharts";
import type { Issue, OrganizationalUnit } from "../types";

const API = "/api";

// Issue levels 8, 16, 20, 23, 25 – yellow for C1 (8), red for rest (16–25) — matches 5×5 Risk Matrix colors
const ISSUE_LEVEL_BANDS = [
  { y1: 8, y2: 12, fill: "#eab30833" },  // C1 minimal – yellow (same as 5×5 moderate)
  { y1: 12, y2: 26, fill: "#ef444433" }, // C2–C5 – red (same as 5×5 high)
];

interface IssueWaterfallProps {
  orgUnit: OrganizationalUnit;
  issues: Issue[];
  preselectedIssueId?: string;
}

interface WaterfallPoint {
  date: string;
  timestamp: number;
  planned?: number;
  actual?: number;
  original?: number;
  plannedC?: number;
  plannedAction?: string;
  actualC?: number;
  actualSource?: "issue_create" | "resolution_step";
  actualIsOriginal?: boolean;
}

export function IssueWaterfall({ orgUnit: _orgUnit, issues, preselectedIssueId }: IssueWaterfallProps) {
  const [selectedIssueId, setSelectedIssueId] = useState<string>(preselectedIssueId ?? "");
  const [data, setData] = useState<WaterfallPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOriginalLevel, setShowOriginalLevel] = useState(false);

  useEffect(() => {
    if (!selectedIssueId) {
      setData([]);
      return;
    }
    setLoading(true);
    fetch(`${API}/issues/${selectedIssueId}/waterfall`)
      .then((r) => r.json())
      .then(({ planned, actual }: {
        planned: { date: string; issueLevel: number; consequence: number; plannedAction?: string }[];
        actual: { date: string; issueLevel: number; consequence: number; source?: string; isOriginal?: boolean }[];
      }) => {
        const allDates = new Set<string>();
        planned.forEach((p) => allDates.add(p.date.slice(0, 10)));
        actual.forEach((a) => allDates.add(a.date.slice(0, 10)));
        const sortedDates = [...allDates].sort();

        const plannedByDate = new Map<string, { issueLevel: number; consequence: number; plannedAction?: string }>();
        for (const p of planned) {
          const d = p.date.slice(0, 10);
          plannedByDate.set(d, { issueLevel: p.issueLevel, consequence: p.consequence, plannedAction: p.plannedAction });
        }
        const actualByDate = new Map<string, { issueLevel: number; consequence: number; source?: string; isOriginal?: boolean }>();
        for (const a of actual) {
          const d = a.date.slice(0, 10);
          actualByDate.set(d, { issueLevel: a.issueLevel, consequence: a.consequence, source: a.source, isOriginal: a.isOriginal });
        }

        const firstOriginal = actual.find((a) => a.isOriginal);
        const originalLevel = firstOriginal?.issueLevel;
        const creationDate = firstOriginal ? firstOriginal.date.slice(0, 10) : null;

        let lastPlanned: { issueLevel: number; consequence: number; plannedAction?: string } | undefined;
        let lastActual: { issueLevel: number; consequence: number; source?: string; isOriginal?: boolean } | undefined;
        const points: WaterfallPoint[] = [];
        for (const d of sortedDates) {
          if (plannedByDate.has(d)) lastPlanned = plannedByDate.get(d);
          if (actualByDate.has(d)) lastActual = actualByDate.get(d);
          points.push({
            date: d,
            timestamp: new Date(d).getTime(),
            planned: lastPlanned?.issueLevel,
            actual: lastActual?.issueLevel,
            original: creationDate && d >= creationDate && originalLevel != null ? originalLevel : undefined,
            plannedC: lastPlanned?.consequence,
            plannedAction: lastPlanned?.plannedAction,
            actualC: lastActual?.consequence,
            actualSource: lastActual?.source as "issue_create" | "resolution_step" | undefined,
            actualIsOriginal: lastActual?.isOriginal,
          });
        }
        setData(points);
      })
      .catch((e) => console.error("Failed to load waterfall:", e))
      .finally(() => setLoading(false));
  }, [selectedIssueId]);

  useEffect(() => {
    if (preselectedIssueId) setSelectedIssueId(preselectedIssueId);
  }, [preselectedIssueId]);

  const showSelector = !preselectedIssueId;

  return (
    <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
      <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>
        Consequence Level vs. Time (Waterfall)
      </h3>
      {showSelector && (
        <>
          <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "#6b7280" }}>
            Select an issue to see planned (from resolution steps) vs actual. Lower = better (8=C1 minimal, 25=C5 severe).
          </p>
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem", color: "#6b7280" }}>Issue</label>
            <select
              value={selectedIssueId}
              onChange={(e) => setSelectedIssueId(e.target.value)}
              style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db", minWidth: 320 }}
            >
              <option value="">— Select an issue —</option>
              {issues.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.issueName ?? "Issue"} (C{i.consequence})
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      {loading && <p style={{ color: "#6b7280", marginBottom: "0.5rem" }}>Loading...</p>}
      {!selectedIssueId && (
        <p style={{ padding: "2rem", color: "#6b7280", textAlign: "center" }}>
          Select an issue above to view its planned vs actual consequence level over time.
        </p>
      )}
      {selectedIssueId && !loading && data.length === 0 && (
        <p style={{ padding: "2rem", color: "#6b7280", textAlign: "center" }}>
          No planned or actual data yet. Add resolution steps to build the waterfall.
        </p>
      )}
      {selectedIssueId && !loading && data.length > 0 && (
        <div style={{ width: "100%", height: 300 }}>
          <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#6b7280", cursor: "pointer" }}>
              <input type="checkbox" checked={showOriginalLevel} onChange={(e) => setShowOriginalLevel(e.target.checked)} />
              Show original level
            </label>
          </div>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              {ISSUE_LEVEL_BANDS.map((band, i) => (
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
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} domain={[8, 26]} tickFormatter={(v) => v === 8 ? "8 (C1)" : v === 16 ? "16 (C2)" : v === 20 ? "20 (C3)" : v === 23 ? "23 (C4)" : v === 25 ? "25 (C5)" : String(v)} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0]?.payload as WaterfallPoint | undefined;
                  if (!point) return null;
                  const items: string[] = [];
                  if (point.actual != null) {
                    const c = point.actualC != null ? ` (C${point.actualC})` : "";
                    const lbl = point.actualIsOriginal ? "Original" : "Current";
                    const src = point.actualSource === "resolution_step" ? " — step" : point.actualSource === "issue_create" ? " — creation" : "";
                    items.push(`Actual (${lbl}): ${point.actual}${c}${src}`);
                  }
                  if (point.planned != null) {
                    const c = point.plannedC != null ? ` (C${point.plannedC})` : "";
                    const action = point.plannedAction ? ` — ${point.plannedAction.length > 80 ? point.plannedAction.slice(0, 80) + "…" : point.plannedAction}` : "";
                    items.push(`Planned: ${point.planned}${c}${action}`);
                  }
                  if (point.original != null) {
                    items.push(`Original: ${point.original} (from creation)`);
                  }
                  return (
                    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 6, padding: "0.5rem 0.75rem", fontSize: "0.875rem", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>Date: {point.date}</div>
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
