import { useMemo, useState } from "react";
import type { Category, OrganizationalUnit, Risk, RiskCategory } from "../types";
import { MitigationStepsEditor } from "./MitigationStepsEditor";

const API = "/api";

interface RiskRegisterProps {
  categories: Category[];
  orgUnit: OrganizationalUnit;
  risks: Risk[];
  loading: boolean;
  onUpdate: () => void;
  onSelectRisk?: (riskId: string) => void;
}

const levelColor: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#ef4444",
};

const typeLabel: Record<string, string> = {
  program: "Program",
  project: "Project",
  department: "Department",
};

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };

// Numerical RL 1-25 for Level column sort (same mapping as matrix)
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

export type RiskRegisterSortKey = "riskName" | "category" | "likelihood" | "consequence" | "riskLevel" | "status" | "owner" | "lastUpdated";

export function RiskRegister({ categories, orgUnit, risks, loading, onUpdate, onSelectRisk }: RiskRegisterProps) {
  const categoryOptions = categories.map((c) => ({ value: c.code as RiskCategory, label: c.label }));
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<Risk | null>(null);
  const [sortBy, setSortBy] = useState<RiskRegisterSortKey>("riskName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: RiskRegisterSortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sortedRisks = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...risks].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "riskName":
          cmp = (a.riskName ?? "").localeCompare(b.riskName ?? "", undefined, { sensitivity: "base" });
          break;
        case "category": {
          const labelA = categoryOptions.find((c) => c.value === a.category)?.label ?? a.category ?? "";
          const labelB = categoryOptions.find((c) => c.value === b.category)?.label ?? b.category ?? "";
          cmp = labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
          break;
        }
        case "likelihood":
          cmp = a.likelihood - b.likelihood;
          break;
        case "consequence":
          cmp = a.consequence - b.consequence;
          break;
        case "riskLevel":
          cmp = getNumericalRL(a.likelihood, a.consequence) - getNumericalRL(b.likelihood, b.consequence);
          break;
        case "status":
          cmp = (a.status ?? "").localeCompare(b.status ?? "", undefined, { sensitivity: "base" });
          break;
        case "owner":
          cmp = (a.owner ?? "").localeCompare(b.owner ?? "", undefined, { sensitivity: "base" });
          break;
        case "lastUpdated": {
          const dateA = new Date(a.lastUpdated ?? a.updatedAt ?? 0).getTime();
          const dateB = new Date(b.lastUpdated ?? b.updatedAt ?? 0).getTime();
          cmp = dateA - dateB;
          break;
        }
        default:
          break;
      }
      return cmp * dir;
    });
  }, [risks, sortBy, sortDir, categoryOptions]);

  const [newRisk, setNewRisk] = useState({
    riskName: "",
    riskCondition: "",
    riskIf: "",
    riskThen: "",
    category: "" as RiskCategory | "",
    likelihood: 3,
    consequence: 3,
    mitigationStrategy: "",
    owner: "",
  });
  const [editForm, setEditForm] = useState({
    riskName: "",
    riskCondition: "",
    riskIf: "",
    riskThen: "",
    category: "" as RiskCategory | "",
    likelihood: 3,
    consequence: 3,
    likelihoodChangeReason: "",
    consequenceChangeReason: "",
    mitigationStrategy: "",
    owner: "",
    status: "",
    statusChangeRationale: "",
  });


  const handleAddRisk = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/risks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationalUnitId: orgUnit.id,
        riskName: newRisk.riskName,
        riskCondition: newRisk.riskCondition,
        riskIf: newRisk.riskIf,
        riskThen: newRisk.riskThen,
        category: newRisk.category || null,
        likelihood: newRisk.likelihood,
        consequence: newRisk.consequence,
        mitigationStrategy: newRisk.mitigationStrategy || null,
        owner: newRisk.owner || null,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setShowAddForm(false);
        setNewRisk({ riskName: "", riskCondition: "", riskIf: "", riskThen: "", category: "", likelihood: 3, consequence: 3, mitigationStrategy: "", owner: "" });
        onUpdate();
      })
      .catch((e) => console.error("Failed to add risk:", e));
  };

  const handleEditRisk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const lChanged = editForm.likelihood !== editing.likelihood;
    const cChanged = editForm.consequence !== editing.consequence;
    const newStatus = editForm.status || editing.status;
    const statusChangingToClosedOrAccepted =
      (newStatus === "closed" || newStatus === "accepted") && newStatus !== editing.status;
    if (lChanged && !editForm.likelihoodChangeReason.trim()) return;
    if (cChanged && !editForm.consequenceChangeReason.trim()) return;
    if (statusChangingToClosedOrAccepted && !editForm.statusChangeRationale.trim()) return;
    fetch(`${API}/risks/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        riskName: editForm.riskName,
        riskCondition: editForm.riskCondition,
        riskIf: editForm.riskIf,
        riskThen: editForm.riskThen,
        category: editForm.category || null,
        likelihood: editForm.likelihood,
        consequence: editForm.consequence,
        likelihoodChangeReason: lChanged ? editForm.likelihoodChangeReason : undefined,
        consequenceChangeReason: cChanged ? editForm.consequenceChangeReason : undefined,
        mitigationStrategy: editForm.mitigationStrategy || null,
        owner: editForm.owner || null,
        status: newStatus,
        statusChangeRationale: statusChangingToClosedOrAccepted ? editForm.statusChangeRationale : undefined,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setEditing(null);
        onUpdate();
      })
      .catch((e) => console.error("Failed to update risk:", e));
  };

  const startEdit = (r: Risk & { riskStatement?: string }) => {
    setEditing(r);
    const cond = r.riskCondition ?? r.riskStatement ?? "";
    setEditForm({
      riskName: r.riskName ?? "",
      riskCondition: cond,
      riskIf: r.riskIf ?? "",
      riskThen: r.riskThen ?? "",
      category: (r.category as RiskCategory) ?? "",
      likelihood: r.likelihood,
      consequence: r.consequence,
      likelihoodChangeReason: "",
      consequenceChangeReason: "",
      mitigationStrategy: r.mitigationStrategy ?? "",
      owner: r.owner ?? "",
      status: r.status,
      statusChangeRationale: "",
    });
  };

  const cancelEdit = () => setEditing(null);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
          Risk Register — {typeLabel[orgUnit.type]} {orgUnit.name}
        </h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={btnPrimary}
        >
          {showAddForm ? "Cancel" : "+ Add Risk"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddRisk}
          style={{
            background: "white",
            padding: "1.5rem",
            borderRadius: 8,
            marginBottom: "1rem",
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>New Risk</h3>
          <div style={{ display: "grid", gap: "1rem", maxWidth: 600 }}>
            <div>
              <label style={labelStyle}>Risk Name * (human-readable label for lists, tooltips, reference)</label>
              <input
                type="text"
                value={newRisk.riskName}
                onChange={(e) => setNewRisk((p) => ({ ...p, riskName: e.target.value }))}
                required
                placeholder="e.g. Subsystem integration uncertainty"
                style={formInputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Condition * (context and root cause)</label>
              <textarea
                value={newRisk.riskCondition}
                onChange={(e) => setNewRisk((p) => ({ ...p, riskCondition: e.target.value }))}
                required
                rows={2}
                style={formInputStyle}
                placeholder="Sets up the context for the risk and identifies root cause if known"
              />
            </div>
            <div>
              <label style={labelStyle}>If * (risk event)</label>
              <textarea
                value={newRisk.riskIf}
                onChange={(e) => setNewRisk((p) => ({ ...p, riskIf: e.target.value }))}
                required
                rows={1}
                style={formInputStyle}
                placeholder="The specific risk event that, if it occurs, will have unwanted effects"
              />
            </div>
            <div>
              <label style={labelStyle}>Then * (consequences)</label>
              <textarea
                value={newRisk.riskThen}
                onChange={(e) => setNewRisk((p) => ({ ...p, riskThen: e.target.value }))}
                required
                rows={1}
                style={formInputStyle}
                placeholder="The consequences that will impact the program"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Category</label>
                            <select
                              value={newRisk.category}
                              onChange={(e) => setNewRisk((p) => ({ ...p, category: e.target.value as RiskCategory }))}
                              style={formInputStyle}
                            >
                              <option value="">—</option>
                              {categoryOptions.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
              </div>
              <div>
                <label style={labelStyle}>Likelihood (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={newRisk.likelihood}
                  onChange={(e) => setNewRisk((p) => ({ ...p, likelihood: parseInt(e.target.value) || 1 }))}
                  style={formInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Consequence (1-5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={newRisk.consequence}
                  onChange={(e) => setNewRisk((p) => ({ ...p, consequence: parseInt(e.target.value) || 1 }))}
                  style={formInputStyle}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Mitigation Strategy</label>
                <select
                  value={newRisk.mitigationStrategy}
                  onChange={(e) => setNewRisk((p) => ({ ...p, mitigationStrategy: e.target.value }))}
                  style={formInputStyle}
                >
                  <option value="">—</option>
                  <option value="acceptance">Acceptance</option>
                  <option value="avoidance">Avoidance</option>
                  <option value="transfer">Transfer</option>
                  <option value="control">Control</option>
                  <option value="burn_down">Burn-down</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Owner</label>
                <input
                  value={newRisk.owner}
                  onChange={(e) => setNewRisk((p) => ({ ...p, owner: e.target.value }))}
                  placeholder="Name or role"
                  style={formInputStyle}
                />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280" }}>
              Add mitigation steps after saving the risk to track planned vs actual risk reduction.
            </p>
            <button type="submit" style={btnPrimary}>Add Risk</button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading risks...</p>
      ) : risks.length === 0 ? (
        <div
          style={{
            background: "white",
            padding: "2rem",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          No risks yet. Add one to get started.
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {([
                  { key: "riskName" as const, label: "Risk Name", align: "left" as const },
                  { key: "category" as const, label: "Category", align: "left" as const },
                  { key: "likelihood" as const, label: "L", align: "center" as const },
                  { key: "consequence" as const, label: "C", align: "center" as const },
                  { key: "riskLevel" as const, label: "Level", align: "left" as const },
                  { key: "status" as const, label: "Status", align: "left" as const },
                  { key: "owner" as const, label: "Owner", align: "left" as const },
                  { key: "lastUpdated" as const, label: "Last Updated", align: "right" as const },
                ] as const).map(({ key, label, align }) => (
                  <th
                    key={key}
                    style={{
                      padding: "0.75rem 1rem",
                      textAlign: align,
                      fontSize: "0.75rem",
                      color: "#6b7280",
                      cursor: "pointer",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => handleSort(key)}
                    title={`Sort by ${label}`}
                  >
                    {label}
                    {sortBy === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRisks.map((r) =>
                editing?.id === r.id ? (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6", background: "#fffbeb" }}>
                    <td colSpan={8} style={{ padding: "1rem" }}>
                      <form onSubmit={handleEditRisk} style={{ display: "grid", gap: "1rem", maxWidth: 600 }}>
                        <h4 style={{ margin: "0 0 0.5rem" }}>Edit Risk</h4>
                        <div>
                          <label style={labelStyle}>Risk Name *</label>
                          <input
                            type="text"
                            value={editForm.riskName}
                            onChange={(e) => setEditForm((p) => ({ ...p, riskName: e.target.value }))}
                            required
                            style={formInputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Condition *</label>
                          <textarea
                            value={editForm.riskCondition}
                            onChange={(e) => setEditForm((p) => ({ ...p, riskCondition: e.target.value }))}
                            required
                            rows={2}
                            style={formInputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>If *</label>
                          <textarea
                            value={editForm.riskIf}
                            onChange={(e) => setEditForm((p) => ({ ...p, riskIf: e.target.value }))}
                            required
                            rows={1}
                            style={formInputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Then *</label>
                          <textarea
                            value={editForm.riskThen}
                            onChange={(e) => setEditForm((p) => ({ ...p, riskThen: e.target.value }))}
                            required
                            rows={1}
                            style={formInputStyle}
                          />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
                          <div>
                            <label style={labelStyle}>Category</label>
                            <select
                              value={editForm.category}
                              onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value as RiskCategory }))}
                              style={formInputStyle}
                            >
                              <option value="">—</option>
                              {categoryOptions.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Likelihood (1-5)</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={editForm.likelihood}
                              onChange={(e) => setEditForm((p) => ({ ...p, likelihood: parseInt(e.target.value) || 1 }))}
                              style={formInputStyle}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Consequence (1-5)</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={editForm.consequence}
                              onChange={(e) => setEditForm((p) => ({ ...p, consequence: parseInt(e.target.value) || 1 }))}
                              style={formInputStyle}
                            />
                          </div>
                          {(editForm.likelihood !== editing.likelihood || editForm.consequence !== editing.consequence) && (
                            <div style={{ gridColumn: "1 / -1", background: "#fef9c3", padding: "0.75rem", borderRadius: 6, border: "1px solid #facc15" }}>
                              <div style={{ fontSize: "0.75rem", marginBottom: "0.5rem", fontWeight: 600 }}>Change log required</div>
                              {editForm.likelihood !== editing.likelihood && (
                                <div style={{ marginBottom: "0.5rem" }}>
                                  <label style={labelStyle}>Reason Likelihood changed *</label>
                                  <input
                                    value={editForm.likelihoodChangeReason}
                                    onChange={(e) => setEditForm((p) => ({ ...p, likelihoodChangeReason: e.target.value }))}
                                    placeholder="Explain why the likelihood changed"
                                    style={{ ...formInputStyle, width: "100%" }}
                                  />
                                </div>
                              )}
                              {editForm.consequence !== editing.consequence && (
                                <div>
                                  <label style={labelStyle}>Reason Consequence changed *</label>
                                  <input
                                    value={editForm.consequenceChangeReason}
                                    onChange={(e) => setEditForm((p) => ({ ...p, consequenceChangeReason: e.target.value }))}
                                    placeholder="Explain why the consequence changed"
                                    style={{ ...formInputStyle, width: "100%" }}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          <div>
                            <label style={labelStyle}>Status</label>
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                              style={formInputStyle}
                            >
                              <option value="open">Open</option>
                              <option value="mitigating">Mitigating</option>
                              <option value="accepted">Accepted</option>
                              <option value="closed">Closed</option>
                            </select>
                          </div>
                        </div>
                        {((editForm.status === "closed" || editForm.status === "accepted") && editForm.status !== editing.status) && (
                          <div>
                            <label style={labelStyle}>Rationale for status change *</label>
                            <textarea
                              value={editForm.statusChangeRationale}
                              onChange={(e) => setEditForm((p) => ({ ...p, statusChangeRationale: e.target.value }))}
                              required
                              rows={2}
                              style={formInputStyle}
                              placeholder="Why is this risk being closed or accepted?"
                            />
                          </div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <div>
                            <label style={labelStyle}>Mitigation Strategy</label>
                            <select
                              value={editForm.mitigationStrategy}
                              onChange={(e) => setEditForm((p) => ({ ...p, mitigationStrategy: e.target.value }))}
                              style={formInputStyle}
                            >
                              <option value="">—</option>
                              <option value="acceptance">Acceptance</option>
                              <option value="avoidance">Avoidance</option>
                              <option value="transfer">Transfer</option>
                              <option value="control">Control</option>
                              <option value="burn_down">Burn-down</option>
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Owner</label>
                            <input
                              value={editForm.owner}
                              onChange={(e) => setEditForm((p) => ({ ...p, owner: e.target.value }))}
                              style={formInputStyle}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button type="submit" style={btnPrimary}>Save risk</button>
                          <button type="button" onClick={cancelEdit} style={btnSecondary}>Cancel</button>
                        </div>
                      </form>
                      <MitigationStepsEditor riskId={editing.id} risk={editing} onUpdate={onUpdate} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", maxWidth: 280 }} title={[r.riskCondition ?? (r as { riskStatement?: string }).riskStatement, r.riskIf, r.riskThen].filter(Boolean).join(" → ")}>
                      <button
                        type="button"
                        onClick={() => (onSelectRisk ? onSelectRisk(r.id) : startEdit(r))}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", textDecoration: "underline" }}
                      >
                        <strong>{(() => {
                          const n = r.riskName ?? "";
                          return `${n.slice(0, 60)}${n.length > 60 ? "…" : ""}`;
                        })()}</strong>
                      </button>
                      <div style={{ fontSize: "0.75rem", marginTop: "0.2rem", color: "#6b7280" }}>
                        Condition: {(() => {
                          const c = r.riskCondition ?? (r as { riskStatement?: string }).riskStatement ?? "";
                          return `${c.slice(0, 50)}${c.length > 50 ? "…" : ""}`;
                        })()}
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
                      {r.category ? categoryOptions.find((c) => c.value === r.category)?.label ?? r.category : "—"}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.875rem" }}>{r.likelihood}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.875rem" }}>{r.consequence}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.5rem",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: levelColor[r.riskLevel ?? "moderate"] + "22",
                          color: levelColor[r.riskLevel ?? "moderate"],
                          textTransform: "capitalize",
                        }}
                      >
                        {r.riskLevel ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", textTransform: "capitalize" }}>{r.status}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>{r.owner ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.8125rem", color: "#6b7280" }}>
                      {(() => {
                        const d = r.lastUpdated ?? r.updatedAt;
                        return d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
                      })()}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
