import { useState, useEffect } from "react";
import type { Opportunity, OpportunityActionPlanStep, OpportunityCategory, OrganizationalUnit } from "../types";
import { OpportunityActionPlanEditor } from "./OpportunityActionPlanEditor";
import { OpportunityActionPlanMatrix } from "./OpportunityActionPlanMatrix";
import { OpportunityWaterfall } from "./OpportunityWaterfall";

const API = "/api";

const STATUS_LABELS: Record<string, string> = {
  pursue_now: "Pursue now",
  defer: "Defer",
  reevaluate: "Reevaluate",
  reject: "Reject",
};

const levelColor: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#ef4444",
};

type DetailTab = "overview" | "action_plan" | "waterfall" | "audit";

interface AuditChange {
  from: unknown;
  to: unknown;
}

interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details?: {
    changedFields?: string[];
    stepNumber?: number;
    changes?: Record<string, AuditChange>;
    likelihoodChangeReason?: string;
    impactChangeReason?: string;
    statusChangeRationale?: string;
  };
  createdAt: string;
}

const AUDIT_FIELD_LABELS: Record<string, string> = {
  opportunityName: "Name",
  opportunityCondition: "Condition",
  opportunityIf: "If",
  opportunityThen: "Then",
  category: "Category",
  likelihood: "Likelihood",
  impact: "Impact",
  owner: "Owner",
  status: "Status",
  plannedAction: "Planned action",
  estimatedStartDate: "Est. start date",
  estimatedEndDate: "Est. end date",
  expectedLikelihood: "Expected L",
  expectedImpact: "Expected I",
  actualLikelihood: "Actual L",
  actualImpact: "Actual I",
  actualCompletedAt: "Completed",
  actionPlanStepsReordered: "Action plan steps reordered",
};

interface OpportunityDetailViewProps {
  categories: OpportunityCategory[];
  opportunity: Opportunity;
  orgUnit: OrganizationalUnit;
  onBack: () => void;
  onUpdate: () => void;
}

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };

const STATUS_REQUIRING_RATIONALE = ["defer", "reevaluate", "reject"];

export function OpportunityDetailView({ categories, opportunity, orgUnit, onBack, onUpdate }: OpportunityDetailViewProps) {
  const categoryLabels = new Map(categories.map((c) => [c.code, c.label]));
  const categoryOptions = categories.map((c) => ({ value: c.code, label: c.label }));
  const [tab, setTab] = useState<DetailTab>("overview");
  const [editing, setEditing] = useState(false);
  const [hasActionPlanSteps, setHasActionPlanSteps] = useState<boolean | null>(null);
  const [actionPlanSteps, setActionPlanSteps] = useState<OpportunityActionPlanStep[] | null>(null);
  const [showOriginalLxI, setShowOriginalLxI] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);

  const loadActionPlanSteps = () => {
    fetch(`${API}/opportunities/${opportunity.id}/action-plan-steps`)
      .then((r) => r.json())
      .then((data: unknown) => {
        const steps = Array.isArray(data) ? (data as OpportunityActionPlanStep[]).sort((a, b) => a.sequenceOrder - b.sequenceOrder) : [];
        setHasActionPlanSteps(steps.length > 0);
        setActionPlanSteps(steps);
      })
      .catch(() => { setHasActionPlanSteps(false); setActionPlanSteps([]); });
  };

  const loadAuditLog = () => {
    setAuditLogError(null);
    setAuditLogLoading(true);
    fetch(`${API}/opportunities/${opportunity.id}/audit-log`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Opportunity not found" : `Failed to load audit log (${r.status})`);
        return r.json();
      })
      .then((data: unknown) => setAuditLog(Array.isArray(data) ? (data as AuditLogEntry[]) : []))
      .catch((err) => {
        console.error("Audit log fetch failed:", err);
        setAuditLogError(err instanceof Error ? err.message : "Failed to load audit log");
        setAuditLog([]);
      })
      .finally(() => setAuditLogLoading(false));
  };

  useEffect(() => {
    loadActionPlanSteps();
  }, [opportunity.id]);

  useEffect(() => {
    if (tab === "audit") loadAuditLog();
  }, [opportunity.id, tab]);

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

  const startEdit = () => {
    setEditing(true);
    setEditForm({
      opportunityName: opportunity.opportunityName ?? "",
      opportunityCondition: opportunity.opportunityCondition ?? "",
      opportunityIf: opportunity.opportunityIf ?? "",
      opportunityThen: opportunity.opportunityThen ?? "",
      category: opportunity.category ?? "",
      likelihood: opportunity.likelihood,
      impact: opportunity.impact,
      likelihoodChangeReason: "",
      impactChangeReason: "",
      owner: opportunity.owner ?? "",
      status: opportunity.status,
      statusChangeRationale: "",
    });
  };

  const cancelEdit = () => setEditing(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const lChanged = editForm.likelihood !== opportunity.likelihood;
    const iChanged = editForm.impact !== opportunity.impact;
    const statusChangingToDeferReject =
      STATUS_REQUIRING_RATIONALE.includes(editForm.status) && editForm.status !== opportunity.status;
    if (lChanged && !editForm.likelihoodChangeReason.trim()) return;
    if (iChanged && !editForm.impactChangeReason.trim()) return;
    if (statusChangingToDeferReject && !editForm.statusChangeRationale.trim()) return;
    fetch(`${API}/opportunities/${opportunity.id}`, {
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
        status: editForm.status,
        statusChangeRationale: statusChangingToDeferReject ? editForm.statusChangeRationale : undefined,
      }),
    })
      .then(() => {
        setEditing(false);
        onUpdate();
        loadAuditLog();
      })
      .catch((e) => console.error("Failed to update opportunity:", e));
  };

  function formatAuditValue(key: string, value: unknown): string {
    if (value === undefined || value === null) return "—";
    if (key === "category") return categoryLabels.get(String(value)) ?? String(value);
    if (key === "status") return STATUS_LABELS[value as string] ?? String(value);
    if (
      key === "estimatedStartDate" ||
      key === "estimatedEndDate" ||
      key === "actualCompletedAt"
    ) {
      const s = String(value);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
      return s;
    }
    return String(value);
  }

  const waterfallDisabled = hasActionPlanSteps === false;
  const detailTabs: { id: DetailTab; label: string; disabled?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "action_plan", label: "Action Plan" },
    { id: "waterfall", label: "Waterfall", disabled: waterfallDisabled },
    { id: "audit", label: "Audit Log" },
  ];

  const detailTheme = { bg: "#eff6ff", border: "#2563eb", badge: "#2563eb" }; // Opportunity: blue
  return (
    <div style={{ background: detailTheme.bg, borderLeft: "4px solid " + detailTheme.border, borderRadius: 8, padding: "1rem 1rem 1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button type="button" onClick={onBack} style={{ ...btnSecondary, padding: "0.4rem 0.75rem", fontSize: "0.875rem" }}>
          ← Back
        </button>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.25rem 0.5rem", borderRadius: 6, background: detailTheme.badge, color: "white" }}>
          Opportunity
        </span>
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>{opportunity.opportunityName ?? "Opportunity"}</h2>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {detailTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => !t.disabled && setTab(t.id)}
            disabled={!!t.disabled}
            style={{
              padding: "0.5rem 1rem",
              background: tab === t.id ? "#2563eb" : t.disabled ? "#f3f4f6" : "#f3f4f6",
              color: tab === t.id ? "white" : t.disabled ? "#9ca3af" : "#374151",
              border: "none",
              borderRadius: 6,
              cursor: t.disabled ? "not-allowed" : "pointer",
              fontSize: "0.875rem",
              opacity: t.disabled ? 0.7 : 1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1.5rem" }}>
          {editing ? (
            <form onSubmit={handleSave} style={{ display: "grid", gap: "1rem", maxWidth: 600 }}>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Edit Opportunity</h3>
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
                  <label style={labelStyle}>Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} style={formInputStyle}>
                    <option value="pursue_now">Pursue now</option>
                    <option value="defer">Defer</option>
                    <option value="reevaluate">Reevaluate</option>
                    <option value="reject">Reject</option>
                  </select>
                </div>
                {STATUS_REQUIRING_RATIONALE.includes(editForm.status) && editForm.status !== opportunity.status && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Rationale for status change *</label>
                    <textarea value={editForm.statusChangeRationale} onChange={(e) => setEditForm((p) => ({ ...p, statusChangeRationale: e.target.value }))} required rows={2} style={formInputStyle} placeholder="Why Defer, Reevaluate, or Reject?" />
                  </div>
                )}
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
              </div>
              {(editForm.likelihood !== opportunity.likelihood || editForm.impact !== opportunity.impact) && (
                <div style={{ padding: "0.75rem", background: "#fef3c7", borderRadius: 6, border: "1px solid #f59e0b" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "#92400e" }}>Change log required when L or I changes</p>
                  {editForm.likelihood !== opportunity.likelihood && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <label style={labelStyle}>Reason Likelihood changed *</label>
                      <textarea value={editForm.likelihoodChangeReason} onChange={(e) => setEditForm((p) => ({ ...p, likelihoodChangeReason: e.target.value }))} required rows={2} style={formInputStyle} placeholder="Why did the likelihood change?" />
                    </div>
                  )}
                  {editForm.impact !== opportunity.impact && (
                    <div>
                      <label style={labelStyle}>Reason Impact changed *</label>
                      <textarea value={editForm.impactChangeReason} onChange={(e) => setEditForm((p) => ({ ...p, impactChangeReason: e.target.value }))} required rows={2} style={formInputStyle} placeholder="Why did the impact change?" />
                    </div>
                  )}
                </div>
              )}
              <div>
                <label style={labelStyle}>Owner</label>
                <input value={editForm.owner} onChange={(e) => setEditForm((p) => ({ ...p, owner: e.target.value }))} style={formInputStyle} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" style={btnPrimary}>Save</button>
                <button type="button" onClick={cancelEdit} style={btnSecondary}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 600, borderBottom: "2px solid #e5e7eb", paddingBottom: "0.35rem" }}>Opportunity Statement</h3>
                <button type="button" onClick={startEdit} style={{ ...btnPrimary, padding: "0.4rem 0.75rem", fontSize: "0.8rem", flexShrink: 0, marginLeft: "1rem" }}>Edit</button>
              </div>
              <dl style={{ display: "grid", gap: "0.5rem 1.5rem", gridTemplateColumns: "auto 1fr", margin: "0 0 1.25rem", fontSize: "0.9rem" }}>
                <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 90 }}>Condition</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>{opportunity.opportunityCondition ?? "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>If</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>{opportunity.opportunityIf ?? "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Then</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>{opportunity.opportunityThen ?? "—"}</dd>
              </dl>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0 2rem", alignItems: "start" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.0625rem", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.35rem" }}>Status</h3>
                  <dl style={{ display: "grid", gap: "0.35rem 1rem", gridTemplateColumns: "auto 1fr", margin: 0, fontSize: "0.875rem" }}>
                    <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 82 }}>Status</dt>
                    <dd style={{ margin: 0 }}>
                      <span
                        title={STATUS_REQUIRING_RATIONALE.includes(opportunity.status) && opportunity.statusChangeRationale ? opportunity.statusChangeRationale : undefined}
                        style={{ cursor: STATUS_REQUIRING_RATIONALE.includes(opportunity.status) && opportunity.statusChangeRationale ? "help" : undefined }}
                      >
                        {STATUS_LABELS[opportunity.status] ?? opportunity.status}
                      </span>
                    </dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Owner</dt>
                    <dd style={{ margin: 0 }}>{opportunity.owner ?? "—"}</dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Last Updated</dt>
                    <dd style={{ margin: 0 }}>{new Date(opportunity.lastUpdated ?? opportunity.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Category</dt>
                    <dd style={{ margin: 0 }}>{opportunity.category ? (categoryLabels.get(opportunity.category) ?? opportunity.category) : "—"}</dd>
                  </dl>
                </div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.0625rem", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.35rem" }}>Opportunity Level</h3>
                  <dl style={{ display: "grid", gap: "0.35rem 1rem", gridTemplateColumns: "auto 1fr", margin: 0, fontSize: "0.875rem" }}>
                    <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 82 }}>Current</dt>
                    <dd style={{ margin: 0 }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.2rem 0.5rem",
                          borderRadius: 4,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: levelColor[opportunity.opportunityLevel ?? "moderate"] + "22",
                          color: levelColor[opportunity.opportunityLevel ?? "moderate"],
                          textTransform: "capitalize",
                        }}
                      >
                        {opportunity.opportunityLevel ?? "moderate"}
                      </span>
                    </dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Original L×I</dt>
                    <dd style={{ margin: 0 }}>
                      <span title="Immutable (tied to creation). If wrong, delete and recreate the opportunity." style={{ cursor: "help" }}>
                        L{opportunity.originalLikelihood ?? opportunity.likelihood}×I{opportunity.originalImpact ?? opportunity.impact}
                      </span>
                    </dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Current L×I</dt>
                    <dd style={{ margin: 0 }}>L{opportunity.likelihood}×I{opportunity.impact}</dd>
                  </dl>
                </div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.0625rem", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.35rem" }}>Action Plan</h3>
                  <dl style={{ display: "grid", gap: "0.35rem 1rem", gridTemplateColumns: "auto 1fr", margin: 0, fontSize: "0.875rem" }}>
                    <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 82 }}>Steps</dt>
                    <dd style={{ margin: 0 }}>
                      {hasActionPlanSteps === null ? "…" : (
                        <button type="button" onClick={() => setTab("action_plan")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "#2563eb", textDecoration: "underline" }}>
                          {hasActionPlanSteps ? "Yes" : "No"}
                        </button>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "action_plan" && (
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flexShrink: 0, minWidth: 380, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <OpportunityActionPlanMatrix
              opportunity={opportunity}
              steps={actionPlanSteps}
              showOriginalLxI={showOriginalLxI}
              onShowOriginalLxIChange={setShowOriginalLxI}
            />
          </div>
          <div style={{ flex: 1, minWidth: 320, background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
            <OpportunityActionPlanEditor
              opportunityId={opportunity.id}
              opportunity={{ originalLikelihood: opportunity.originalLikelihood ?? opportunity.likelihood, originalImpact: opportunity.originalImpact ?? opportunity.impact, likelihood: opportunity.likelihood, impact: opportunity.impact }}
              onUpdate={() => { onUpdate(); loadActionPlanSteps(); loadAuditLog(); }}
              onStepsChange={(steps) => setActionPlanSteps(steps)}
            />
          </div>
        </div>
      )}

      {tab === "waterfall" && (
        <OpportunityWaterfall orgUnit={orgUnit} opportunities={[opportunity]} preselectedOpportunityId={opportunity.id} />
      )}

      {tab === "audit" && (
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Audit Log</h3>
          <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
            Every creation, update, and deletion of this opportunity and its action plan steps.
          </p>
          {auditLogError ? (
            <p style={{ color: "#dc2626", margin: 0 }}>{auditLogError}</p>
          ) : auditLogLoading ? (
            <p style={{ color: "#6b7280", margin: 0 }}>Loading audit log…</p>
          ) : auditLog.length === 0 ? (
            <p style={{ color: "#6b7280", margin: 0 }}>No audit entries yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {auditLog.map((entry) => {
                const entityLabel = entry.entityType === "opportunity" ? "Opportunity" : `Action plan step ${entry.details?.stepNumber ?? "—"}`;
                const actionLabel = entry.action === "created" ? "Created" : entry.action === "updated" ? "Updated" : "Deleted";
                const changes = entry.details?.changes;
                return (
                  <div
                    key={entry.id}
                    style={{
                      padding: "0.75rem 1rem",
                      background: "#f9fafb",
                      borderRadius: 6,
                      borderLeft: "3px solid #6b7280",
                      fontSize: "0.875rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom:
                          (changes && Object.keys(changes).length > 0) ||
                          entry.details?.likelihoodChangeReason ||
                          entry.details?.impactChangeReason ||
                          entry.details?.statusChangeRationale
                            ? "0.5rem"
                            : 0,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {entityLabel} — {actionLabel}
                      </span>
                      <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                        {new Date(entry.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    {entry.action === "updated" && (
                      <>
                        {changes && Object.keys(changes).length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#374151", fontSize: "0.8125rem" }}>
                            {Object.entries(changes).map(([fieldKey, { from, to }]) => {
                              const label = AUDIT_FIELD_LABELS[fieldKey] ?? fieldKey;
                              const fromStr = formatAuditValue(fieldKey, from);
                              const toStr = formatAuditValue(fieldKey, to);
                              return (
                                <li key={fieldKey} style={{ marginBottom: "0.25rem" }}>
                                  <strong>{label}:</strong> {fromStr} → {toStr}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {(entry.details?.likelihoodChangeReason ?? entry.details?.impactChangeReason ?? entry.details?.statusChangeRationale) && (
                          <div style={{ marginTop: changes && Object.keys(changes).length > 0 ? "0.5rem" : 0, fontSize: "0.8125rem", color: "#374151" }}>
                            {entry.details.likelihoodChangeReason && (
                              <p style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                                <strong>Likelihood change reason:</strong> {entry.details.likelihoodChangeReason}
                              </p>
                            )}
                            {entry.details.impactChangeReason && (
                              <p style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                                <strong>Impact change reason:</strong> {entry.details.impactChangeReason}
                              </p>
                            )}
                            {entry.details.statusChangeRationale && (
                              <p style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                                <strong>Status change rationale:</strong> {entry.details.statusChangeRationale}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
