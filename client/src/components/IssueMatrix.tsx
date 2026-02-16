import { useRef, useState } from "react";
import type { Category, Issue, OrganizationalUnit } from "../types";
import { exportElementAsPng } from "../utils/exportPng";

const CONSEQUENCE_LABELS = ["1: Minimal", "2: Minor", "3: Moderate", "4: Significant", "5: Severe"];

// 1×5: C1 = yellow (moderate), C2–C5 = red (high) — same hex and opacity as 5×5 Risk Matrix
const MATRIX_COLOR: Record<string, string> = {
  minimal: "#eab308", // yellow – C1 (matches 5×5 moderate)
  rest: "#ef4444",    // red – C2–C5 (matches 5×5 high)
};

function getCellColor(c: number): string {
  const key = Math.max(1, Math.min(5, c)) === 1 ? "minimal" : "rest";
  return (MATRIX_COLOR[key] ?? "#e5e7eb") + "33"; // 33 = 20% opacity, matches 5×5
}

// Numerical level 8, 16, 20, 23, 25 for sorting within cell
const NUMERICAL_ISSUE_LEVEL: Record<number, number> = { 1: 8, 2: 16, 3: 20, 4: 23, 5: 25 };

interface IssueMatrixProps {
  categories: Category[];
  orgUnit: OrganizationalUnit;
  issues: Issue[];
  onSelectIssue?: (id: string) => void;
  onExportRef?: (el: HTMLDivElement | null) => void;
}

export function IssueMatrix({ categories: _categories, orgUnit, issues, onSelectIssue, onExportRef }: IssueMatrixProps) {
  const [showOLNumbers, setShowOLNumbers] = useState(false);

  // Group issues by consequence (1-5)
  const byConsequence = new Map<number, Issue[]>();
  for (let c = 1; c <= 5; c++) byConsequence.set(c, []);
  for (const i of issues) {
    const c = Math.max(1, Math.min(5, i.consequence));
    const list = byConsequence.get(c) ?? [];
    list.push(i);
    byConsequence.set(c, list);
  }
  // Sort each cell by numerical level (all same for same C), then by name
  for (let c = 1; c <= 5; c++) {
    const list = byConsequence.get(c) ?? [];
    list.sort((a, b) => {
      const na = NUMERICAL_ISSUE_LEVEL[a.consequence] ?? 20;
      const nb = NUMERICAL_ISSUE_LEVEL[b.consequence] ?? 20;
      if (na !== nb) return na - nb;
      return (a.issueName ?? "").localeCompare(b.issueName ?? "");
    });
  }

  const cellSize = 100;
  const padding = { top: 16, left: 12 };

  const exportRef = useRef<HTMLDivElement>(null);
  const handleExportPng = async () => {
    if (!exportRef.current) return;
    const safe = (orgUnit?.name ?? "export").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
    await exportElementAsPng(exportRef.current, `Issue-Matrix-${safe}.png`);
  };

  return (
    <div
      ref={(el) => {
        (exportRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        onExportRef?.(el ?? null);
      }}
      style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem", overflow: "auto" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
          Issue Matrix (1×5) — {orgUnit.type} {orgUnit.name}
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={handleExportPng}
            style={{ padding: "0.5rem 1rem", background: "#6b7280", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" }}
            title="Export as PNG (16:9)"
          >
            Export PNG
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer" }}>
            <input type="checkbox" checked={showOLNumbers} onChange={(e) => setShowOLNumbers(e.target.checked)} />
            Show level (8, 16, 20, 23, 25)
          </label>
        </div>
      </div>

      <div style={{ marginLeft: padding.left, marginTop: padding.top }}>
        {/* Single row: Consequence 1-5 */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          {[1, 2, 3, 4, 5].map((c) => {
            const list = byConsequence.get(c) ?? [];
            const color = getCellColor(c);
            return (
              <div
                key={c}
                style={{
                  position: "relative",
                  width: cellSize,
                  minHeight: cellSize * 1.5,
                  background: color,
                  border: "1px solid #d1d5db",
                  borderRight: c < 5 ? "none" : "1px solid #d1d5db",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "0.5rem",
                }}
              >
                {showOLNumbers && (
                  <div style={{ position: "absolute", top: 4, left: 6, fontSize: "0.7rem", fontWeight: 600, color: "#374151" }}>
                    {NUMERICAL_ISSUE_LEVEL[c]}
                  </div>
                )}
                <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem", textAlign: "center" }}>
                  C{c}
                </div>
                <div style={{ fontSize: "0.6rem", color: "#6b7280", marginBottom: "0.25rem", textAlign: "center", lineHeight: 1.2 }}>
                  {CONSEQUENCE_LABELS[c - 1]?.split(": ")[1] ?? ""}
                </div>
                <div style={{ flex: 1, width: "100%", overflow: "auto", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {list.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onSelectIssue?.(i.id)}
                      style={{
                        background: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: 4,
                        padding: "0.25rem 0.35rem",
                        fontSize: "0.7rem",
                        textAlign: "left",
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={`${i.issueName}${i.owner ? ` — ${i.owner}` : ""}`}
                    >
                      {i.issueName?.slice(0, 12)}{(i.issueName?.length ?? 0) > 12 ? "…" : ""}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#6b7280" }}>
        <p style={{ margin: 0 }}>Issues placed by Consequence (1–5). Likelihood fixed at 1 (it happened). Click an issue to view details.</p>
      </div>
    </div>
  );
}
