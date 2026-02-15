import { useEffect, useMemo, useState } from "react";
import type { Opportunity, OpportunityCategory, OrganizationalUnit } from "../types";
import { OpportunityActionPlanEditor } from "./OpportunityActionPlanEditor";

const API = "/api";

interface OpportunityRegisterProps {
  categories: OpportunityCategory[];
  orgUnit: OrganizationalUnit;
  opportunities: Opportunity[];
  loading: boolean;
  onUpdate: () => void;
  onSelectOpportunity?: (id: string) => void;
}

// Level colors and labels — match 5×5 Opportunity Matrix (light purple / medium blue / light blue)
const OPP_LEVEL_COLOR: Record<string, string> = {
  low: "#ddd6fe",      // Good — light purple
  moderate: "#60a5fa", // Very Good — medium blue
  high: "#38bdf8",     // Excellent — light blue
};
const OPP_LEVEL_LABEL: Record<string, string> = {
  low: "Good",
  moderate: "Very Good",
  high: "Excellent",
};

const STATUS_LABELS: Record<string, string> = {
  pursue_now: "Pursue now",
  defer: "Defer",
  reevaluate: "Reevaluate",
  reject: "Reject",
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

export type OpportunityRegisterSortKey = "opportunityName" | "category" | "likelihood" | "impact" | "opportunityLevel" | "status" | "owner" | "lastUpdated";

export function OpportunityRegister({ categories = [], orgUnit, opportunities = [], loading, onUpdate, onSelectOpportunity }: OpportunityRegisterProps) {
  useEffect(() => { console.log("[OpportunityRegister] mount", { orgUnitId: orgUnit?.id, opportunitiesCount: opportunities?.length }); }, [orgUnit?.id, opportunities?.length]);
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeOpportunities = Array.isArray(opportunities) ? opportunities : [];
  const categoryOptions = safeCategories.map((c) => ({ value: c.code, label: c.label }));
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [sortBy, setSortBy] = useState<OpportunityRegisterSortKey>("opportunityName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: OpportunityRegisterSortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sortedOpportunities = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...safeOpportunities].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "opportunityName":
          cmp = (a.opportunityName ?? "").localeCompare(b.opportunityName ?? "", undefined, { sensitivity: "base" });
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
        case "impact":
          cmp = a.impact - b.impact;
          break;
        case "opportunityLevel":
          cmp = getNumericalOL(a.likelihood, a.impact) - getNumericalOL(b.likelihood, b.impact);
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
  }, [safeOpportunities, sortBy, sortDir, categoryOptions]);

  const [newOpp, setNewOpp] = useState({
    opportunityName: "",
    opportunityCondition: "",
    opportunityIf: "",
    opportunityThen: "",
    category: "",
    likelihood: 3,
    impact: 3,
    owner: "",
  });
  const [editForm, setEditForm] = useState({
    opportunityName: "",
    opportunityCondition: "",
    opportunityIf: "",
    opportunityThen: "",
    category: "",
    likelihood: 3,
    impact: 3,
    likelihoodChangeReason: "",
    impactChangeReason: "",
    owner: "",
    status: "",
    statusChangeRationale: "",
  });

  const STATUS_REQUIRING_RATIONALE = ["defer", "reevaluate", "reject"];

  const handleAddOpportunity = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/opportunities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationalUnitId: orgUnit.id,
        opportunityName: newOpp.opportunityName,
        opportunityCondition: newOpp.opportunityCondition,
        opportunityIf: newOpp.opportunityIf,
        opportunityThen: newOpp.opportunityThen,
        category: newOpp.category || null,
        likelihood: newOpp.likelihood,
        impact: newOpp.impact,
        owner: newOpp.owner || null,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setShowAddForm(false);
        setNewOpp({ opportunityName: "", opportunityCondition: "", opportunityIf: "", opportunityThen: "", category: "", likelihood: 3, impact: 3, owner: "" });
        onUpdate();
      })
      .catch((e) => console.error("Failed to add opportunity:", e));
  };

  const handleEditOpportunity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const lChanged = editForm.likelihood !== editing.likelihood;
    const iChanged = editForm.impact !== editing.impact;
    const newStatus = editForm.status || editing.status;
    const statusChangingToDeferReject = STATUS_REQUIRING_RATIONALE.includes(newStatus) && newStatus !== editing.status;
    if (lChanged && !editForm.likelihoodChangeReason.trim()) return;
    if (iChanged && !editForm.impactChangeReason.trim()) return;
    if (statusChangingToDeferReject && !editForm.statusChangeRationale.trim()) return;
    fetch(`${API}/opportunities/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opportunityName: editForm.opportunityName,
        opportunityCondition: editForm.opportunityCondition,
        opportunityIf: editForm.opportunityIf,
        opportunityThen: editForm.opportunityThen,
        category: editForm.category || null,
        likelihood: editForm.likelihood,
        impact: editForm.impact,
        likelihoodChangeReason: lChanged ? editForm.likelihoodChangeReason : undefined,
        impactChangeReason: iChanged ? editForm.impactChangeReason : undefined,
        owner: editForm.owner || null,
        status: newStatus,
        statusChangeRationale: statusChangingToDeferReject ? editForm.statusChangeRationale : undefined,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setEditing(null);
        onUpdate();
      })
      .catch((e) => console.error("Failed to update opportunity:", e));
  };

  const startEdit = (o: Opportunity) => {
    setEditing(o);
    setEditForm({
      opportunityName: o.opportunityName ?? "",
      opportunityCondition: o.opportunityCondition ?? "",
      opportunityIf: o.opportunityIf ?? "",
      opportunityThen: o.opportunityThen ?? "",
      category: o.category ?? "",
      likelihood: o.likelihood,
      impact: o.impact,
      likelihoodChangeReason: "",
      impactChangeReason: "",
      owner: o.owner ?? "",
      status: o.status,
      statusChangeRationale: "",
    });
  };

  const cancelEdit = () => setEditing(null);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
          Opportunity Register — {typeLabel[orgUnit.type]} {orgUnit.name}
        </h2>
        <button onClick={() => setShowAddForm(!showAddForm)} style={btnPrimary}>
          {showAddForm ? "Cancel" : "+ Add Opportunity"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddOpportunity}
          style={{ background: "white", padding: "1.5rem", borderRadius: 8, marginBottom: "1rem", border: "1px solid #e5e7eb" }}
        >
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>New Opportunity</h3>
          <div style={{ display: "grid", gap: "1rem", maxWidth: 600 }}>
            <div>
              <label style={labelStyle}>Opportunity Name *</label>
              <input type="text" value={newOpp.opportunityName} onChange={(e) => setNewOpp((p) => ({ ...p, opportunityName: e.target.value }))} required placeholder="e.g. Technology partnership" style={formInputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Condition * (context)</label>
              <textarea value={newOpp.opportunityCondition} onChange={(e) => setNewOpp((p) => ({ ...p, opportunityCondition: e.target.value }))} required rows={2} style={formInputStyle} placeholder="Context for the opportunity" />
            </div>
            <div>
              <label style={labelStyle}>If *</label>
              <textarea value={newOpp.opportunityIf} onChange={(e) => setNewOpp((p) => ({ ...p, opportunityIf: e.target.value }))} required rows={1} style={formInputStyle} placeholder="Condition that enables this opportunity" />
            </div>
            <div>
              <label style={labelStyle}>Then *</label>
              <textarea value={newOpp.opportunityThen} onChange={(e) => setNewOpp((p) => ({ ...p, opportunityThen: e.target.value }))} required rows={1} style={formInputStyle} placeholder="Benefits or outcomes" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={newOpp.category} onChange={(e) => setNewOpp((p) => ({ ...p, category: e.target.value }))} style={formInputStyle}>
                  <option value="">—</option>
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Likelihood (1-5)</label>
                <input type="number" min={1} max={5} value={newOpp.likelihood} onChange={(e) => setNewOpp((p) => ({ ...p, likelihood: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Impact (1-5)</label>
                <input type="number" min={1} max={5} value={newOpp.impact} onChange={(e) => setNewOpp((p) => ({ ...p, impact: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Owner</label>
              <input value={newOpp.owner} onChange={(e) => setNewOpp((p) => ({ ...p, owner: e.target.value }))} placeholder="Name or role" style={formInputStyle} />
            </div>
            <button type="submit" style={btnPrimary}>Add Opportunity</button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading opportunities...</p>
      ) : safeOpportunities.length === 0 ? (
        <div style={{ background: "white", padding: "2rem", borderRadius: 8, border: "1px solid #e5e7eb", color: "#6b7280", textAlign: "center" }}>
          No opportunities yet. Add one to get started.
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {([
                  { key: "opportunityName" as const, label: "Opportunity Name", align: "left" as const },
                  { key: "category" as const, label: "Category", align: "left" as const },
                  { key: "likelihood" as const, label: "L", align: "center" as const },
                  { key: "impact" as const, label: "I", align: "center" as const },
                  { key: "opportunityLevel" as const, label: "Level", align: "left" as const },
                  { key: "status" as const, label: "Status", align: "left" as const },
                  { key: "owner" as const, label: "Owner", align: "left" as const },
                  { key: "lastUpdated" as const, label: "Last Updated", align: "right" as const },
                ] as const).map(({ key, label, align }) => (
                  <th key={key} style={{ padding: "0.75rem 1rem", textAlign: align, fontSize: "0.75rem", color: "#6b7280", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => handleSort(key)} title={`Sort by ${label}`}>
                    {label}
                    {sortBy === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedOpportunities.map((o) =>
                editing?.id === o.id ? (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f3f4f6", background: "#fffbeb" }}>
                    <td colSpan={8} style={{ padding: "1rem" }}>
                      <form onSubmit={handleEditOpportunity} style={{ display: "grid", gap: "1rem", maxWidth: 600 }}>
                        <h4 style={{ margin: "0 0 0.5rem" }}>Edit Opportunity</h4>
                        <div>
                          <label style={labelStyle}>Opportunity Name *</label>
                          <input type="text" value={editForm.opportunityName} onChange={(e) => setEditForm((p) => ({ ...p, opportunityName: e.target.value }))} required style={formInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Condition *</label>
                          <textarea value={editForm.opportunityCondition} onChange={(e) => setEditForm((p) => ({ ...p, opportunityCondition: e.target.value }))} required rows={2} style={formInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>If *</label>
                          <textarea value={editForm.opportunityIf} onChange={(e) => setEditForm((p) => ({ ...p, opportunityIf: e.target.value }))} required rows={1} style={formInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Then *</label>
                          <textarea value={editForm.opportunityThen} onChange={(e) => setEditForm((p) => ({ ...p, opportunityThen: e.target.value }))} required rows={1} style={formInputStyle} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
                          <div>
                            <label style={labelStyle}>Category</label>
                            <select value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))} style={formInputStyle}>
                              <option value="">—</option>
                              {categoryOptions.map((c) => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Likelihood (1-5)</label>
                            <input type="number" min={1} max={5} value={editForm.likelihood} onChange={(e) => setEditForm((p) => ({ ...p, likelihood: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Impact (1-5)</label>
                            <input type="number" min={1} max={5} value={editForm.impact} onChange={(e) => setEditForm((p) => ({ ...p, impact: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Status</label>
                            <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} style={formInputStyle}>
                              <option value="pursue_now">Pursue now</option>
                              <option value="defer">Defer</option>
                              <option value="reevaluate">Reevaluate</option>
                              <option value="reject">Reject</option>
                            </select>
                          </div>
                        </div>
                        {(editForm.likelihood !== editing.likelihood || editForm.impact !== editing.impact) && (
                          <div style={{ gridColumn: "1 / -1", background: "#fef9c3", padding: "0.75rem", borderRadius: 6, border: "1px solid #facc15" }}>
                            <div style={{ fontSize: "0.75rem", marginBottom: "0.5rem", fontWeight: 600 }}>Change log required</div>
                            {editForm.likelihood !== editing.likelihood && (
                              <div style={{ marginBottom: "0.5rem" }}>
                                <label style={labelStyle}>Reason Likelihood changed *</label>
                                <input value={editForm.likelihoodChangeReason} onChange={(e) => setEditForm((p) => ({ ...p, likelihoodChangeReason: e.target.value }))} placeholder="Explain why" style={{ ...formInputStyle, width: "100%" }} />
                              </div>
                            )}
                            {editForm.impact !== editing.impact && (
                              <div>
                                <label style={labelStyle}>Reason Impact changed *</label>
                                <input value={editForm.impactChangeReason} onChange={(e) => setEditForm((p) => ({ ...p, impactChangeReason: e.target.value }))} placeholder="Explain why" style={{ ...formInputStyle, width: "100%" }} />
                              </div>
                            )}
                          </div>
                        )}
                        {STATUS_REQUIRING_RATIONALE.includes(editForm.status) && editForm.status !== editing.status && (
                          <div>
                            <label style={labelStyle}>Rationale for status change *</label>
                            <textarea value={editForm.statusChangeRationale} onChange={(e) => setEditForm((p) => ({ ...p, statusChangeRationale: e.target.value }))} required rows={2} style={formInputStyle} placeholder="Why Defer, Reevaluate, or Reject?" />
                          </div>
                        )}
                        <div>
                          <label style={labelStyle}>Owner</label>
                          <input value={editForm.owner} onChange={(e) => setEditForm((p) => ({ ...p, owner: e.target.value }))} style={formInputStyle} />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button type="submit" style={btnPrimary}>Save opportunity</button>
                          <button type="button" onClick={cancelEdit} style={btnSecondary}>Cancel</button>
                        </div>
                      </form>
                      <OpportunityActionPlanEditor
                        opportunityId={editing.id}
                        opportunity={{ originalLikelihood: editing.originalLikelihood ?? editing.likelihood, originalImpact: editing.originalImpact ?? editing.impact, likelihood: editing.likelihood, impact: editing.impact }}
                        onUpdate={onUpdate}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={o.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", maxWidth: 280 }} title={[o.opportunityCondition, o.opportunityIf, o.opportunityThen].filter(Boolean).join(" → ")}>
                      <button
                        type="button"
                        onClick={() => (onSelectOpportunity ? onSelectOpportunity(o.id) : startEdit(o))}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit", color: "inherit", textDecoration: "underline" }}
                      >
                        <strong>{(o.opportunityName ?? "").slice(0, 60)}{(o.opportunityName ?? "").length > 60 ? "…" : ""}</strong>
                      </button>
                      <div style={{ fontSize: "0.75rem", marginTop: "0.2rem", color: "#6b7280" }}>
                        Condition: {(o.opportunityCondition ?? "").slice(0, 50)}{(o.opportunityCondition ?? "").length > 50 ? "…" : ""}
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
                      {o.category ? categoryOptions.find((c) => c.value === o.category)?.label ?? o.category : "—"}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.875rem" }}>{o.likelihood}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center", fontSize: "0.875rem" }}>{o.impact}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.5rem",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: (OPP_LEVEL_COLOR[o.opportunityLevel ?? "moderate"] ?? "#e5e7eb") + "33",
                          color: "#374151",
                        }}
                      >
                        {OPP_LEVEL_LABEL[o.opportunityLevel ?? "moderate"] ?? (o.opportunityLevel ?? "—")}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem" }}>{STATUS_LABELS[o.status] ?? o.status}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>{o.owner ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.8125rem", color: "#6b7280" }}>
                      {(o.lastUpdated ?? o.updatedAt)
                        ? new Date(o.lastUpdated ?? o.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
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
