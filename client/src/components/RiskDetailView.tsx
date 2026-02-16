import { useRef, useState, useEffect } from "react";
import type { Category, MitigationStep, OrganizationalUnit, Risk, RiskCategory } from "../types";
import { exportElementAsPngCropped } from "../utils/exportPng";
import { MitigationStepsEditor } from "./MitigationStepsEditor";
import { RiskMitigationMatrix } from "./RiskMitigationMatrix";
import { RiskWaterfall } from "./RiskWaterfall";

const API = "/api";

const STRATEGY_LABELS: Record<string, string> = {
  acceptance: "Acceptance",
  avoidance: "Avoidance",
  transfer: "Transfer",
  control: "Control",
  burn_down: "Burn-down",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  mitigating: "Mitigating",
  accepted: "Accepted",
  closed: "Closed",
  realized: "Realized",
};

const levelColor: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#ef4444",
};

type DetailTab = "overview" | "mitigation" | "waterfall" | "audit";

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
    consequenceChangeReason?: string;
    statusChangeRationale?: string;
  };
  createdAt: string;
}

function formatAuditValue(key: string, value: unknown, categoryLabels: Map<string, string>): string {
  if (value === undefined || value === null) return "—";
  if (key === "category") return categoryLabels.get(String(value)) ?? String(value);
  if (key === "status") return STATUS_LABELS[value as string] ?? String(value);
  if (key === "mitigationStrategy") return STRATEGY_LABELS[value as string] ?? String(value);
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

const AUDIT_FIELD_LABELS: Record<string, string> = {
  riskName: "Name",
  riskCondition: "Condition",
  riskIf: "If",
  riskThen: "Then",
  category: "Category",
  likelihood: "Likelihood",
  consequence: "Consequence",
  mitigationStrategy: "Mitigation strategy",
  mitigationPlan: "Mitigation plan",
  owner: "Owner",
  status: "Status",
  sequenceOrder: "Sequence",
  mitigationActions: "Mitigation actions",
  closureCriteria: "Closure criteria",
  estimatedStartDate: "Est. start date",
  estimatedEndDate: "Est. end date",
  expectedLikelihood: "Expected L",
  expectedConsequence: "Expected C",
  actualLikelihood: "Actual L",
  actualConsequence: "Actual C",
  actualCompletedAt: "Completed",
  mitigationStepsReordered: "Mitigation steps reordered",
};

interface RiskDetailViewProps {
  categories: Category[];
  risk: Risk;
  orgUnit: OrganizationalUnit;
  onBack: () => void;
  onUpdate: () => void;
  /** When provided, call after creating an issue from this risk (e.g. to open the new issue). */
  onIssueCreated?: (issueId: string) => void;
}

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };

export function RiskDetailView({ categories, risk, orgUnit, onBack, onUpdate, onIssueCreated }: RiskDetailViewProps) {
  const categoryLabels = new Map(categories.map((c) => [c.code, c.label]));
  const categoryOptions = categories.map((c) => ({ value: c.code as RiskCategory, label: c.label }));
  const [tab, setTab] = useState<DetailTab>("overview");
  const [editing, setEditing] = useState(false);
  const [showOriginalLxC, setShowOriginalLxC] = useState(false);
  const [hasMitigationSteps, setHasMitigationSteps] = useState<boolean | null>(null);
  const [mitigationSteps, setMitigationSteps] = useState<MitigationStep[] | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const mitigationTabRef = useRef<HTMLDivElement | null>(null);
  const waterfallTabRef = useRef<HTMLDivElement | null>(null);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);
  /** Full risk from API (includes linkedIssue when status is Realized). */
  const [fullRisk, setFullRisk] = useState<Risk | null>(null);
  const [showCreateIssueModal, setShowCreateIssueModal] = useState(false);
  const [createIssueForm, setCreateIssueForm] = useState({
    issueName: "",
    description: "",
    owner: "",
    category: "",
    consequence: 3,
  });
  const [createIssueSubmitting, setCreateIssueSubmitting] = useState(false);
  const [createIssueError, setCreateIssueError] = useState<string | null>(null);

  const displayRisk = fullRisk ?? risk;
  const linkedIssue = displayRisk.linkedIssue ?? null;

  const loadFullRisk = () => {
    fetch(`${API}/risks/${risk.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Risk | null) => data && setFullRisk(data))
      .catch(() => setFullRisk(null));
  };

  useEffect(() => {
    loadFullRisk();
  }, [risk.id]);

  const loadMitigationSteps = () => {
    fetch(`${API}/risks/${risk.id}/mitigation-steps`)
      .then((r) => r.json())
      .then((steps: unknown[]) => setHasMitigationSteps(steps.length > 0))
      .catch(() => setHasMitigationSteps(false));
  };

  const loadAuditLog = () => {
    setAuditLogError(null);
    setAuditLogLoading(true);
    fetch(`${API}/risks/${risk.id}/audit-log`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Risk not found" : `Failed to load audit log (${r.status})`);
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
    loadMitigationSteps();
  }, [risk.id]);

  useEffect(() => {
    if (tab === "audit") loadAuditLog();
  }, [risk.id, tab]);
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

  const startEdit = () => {
    setEditing(true);
    setEditForm({
      riskName: risk.riskName ?? "",
      riskCondition: risk.riskCondition ?? "",
      riskIf: risk.riskIf ?? "",
      riskThen: risk.riskThen ?? "",
      category: (risk.category as RiskCategory) ?? "",
      likelihood: risk.likelihood,
      consequence: risk.consequence,
      likelihoodChangeReason: "",
      consequenceChangeReason: "",
      mitigationStrategy: risk.mitigationStrategy ?? "",
      owner: risk.owner ?? "",
      status: risk.status,
      statusChangeRationale: "",
    });
  };

  const cancelEdit = () => setEditing(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const lChanged = editForm.likelihood !== risk.likelihood;
    const cChanged = editForm.consequence !== risk.consequence;
    const statusChangingToClosedAcceptedOrRealized =
      (editForm.status === "closed" || editForm.status === "accepted" || editForm.status === "realized") && editForm.status !== risk.status;
    if (lChanged && !editForm.likelihoodChangeReason.trim()) return;
    if (cChanged && !editForm.consequenceChangeReason.trim()) return;
    if (statusChangingToClosedAcceptedOrRealized && !editForm.statusChangeRationale.trim()) return;
    fetch(`${API}/risks/${risk.id}`, {
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
        likelihoodChangeReason: editForm.likelihood !== risk.likelihood ? editForm.likelihoodChangeReason : undefined,
        consequenceChangeReason: editForm.consequence !== risk.consequence ? editForm.consequenceChangeReason : undefined,
        mitigationStrategy: editForm.mitigationStrategy || null,
        owner: editForm.owner || null,
        status: editForm.status,
        statusChangeRationale: statusChangingToClosedAcceptedOrRealized ? editForm.statusChangeRationale : undefined,
      }),
    })
      .then(() => {
        setEditing(false);
        onUpdate();
        loadFullRisk();
        loadAuditLog();
      })
      .catch((e) => console.error("Failed to update risk:", e));
  };

  const waterfallDisabled = hasMitigationSteps === false;
  const detailTabs: { id: DetailTab; label: string; disabled?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "mitigation", label: "Mitigation Steps" },
    { id: "waterfall", label: "Waterfall", disabled: waterfallDisabled },
    { id: "audit", label: "Audit Log" },
  ];

  const detailTheme = { bg: "#fffbeb", border: "#d97706", badge: "#d97706" }; // Risk: amber
  return (
    <div style={{ background: detailTheme.bg, borderLeft: "4px solid " + detailTheme.border, borderRadius: 8, padding: "1rem 1rem 1rem 1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button type="button" onClick={onBack} style={{ ...btnSecondary, padding: "0.4rem 0.75rem", fontSize: "0.875rem" }}>
          ← Back
        </button>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.25rem 0.5rem", borderRadius: 6, background: detailTheme.badge, color: "white" }}>
          Risk
        </span>
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>{risk.riskName ?? "Risk"}</h2>
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
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>Edit Risk</h3>
              <div>
                <label style={labelStyle}>Risk Name *</label>
                <input type="text" value={editForm.riskName} onChange={(e) => setEditForm((p) => ({ ...p, riskName: e.target.value }))} required style={formInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Condition *</label>
                <textarea value={editForm.riskCondition} onChange={(e) => setEditForm((p) => ({ ...p, riskCondition: e.target.value }))} required rows={2} style={formInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>If *</label>
                <textarea value={editForm.riskIf} onChange={(e) => setEditForm((p) => ({ ...p, riskIf: e.target.value }))} required rows={1} style={formInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Then *</label>
                <textarea value={editForm.riskThen} onChange={(e) => setEditForm((p) => ({ ...p, riskThen: e.target.value }))} required rows={1} style={formInputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} style={formInputStyle}>
                    <option value="open">Open</option>
                    <option value="mitigating">Mitigating</option>
                    <option value="accepted">Accepted</option>
                    <option value="closed">Closed</option>
                    <option value="realized">Realized</option>
                  </select>
                </div>
                {((editForm.status === "closed" || editForm.status === "accepted" || editForm.status === "realized") && editForm.status !== risk.status) && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={labelStyle}>Rationale for status change *</label>
                    <textarea
                      value={editForm.statusChangeRationale}
                      onChange={(e) => setEditForm((p) => ({ ...p, statusChangeRationale: e.target.value }))}
                      required
                      rows={2}
                      style={formInputStyle}
                      placeholder={editForm.status === "realized" ? "Why has this risk been realized?" : "Why is this risk being closed or accepted?"}
                    />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value as RiskCategory }))} style={formInputStyle}>
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
                  <label style={labelStyle}>Consequence (1-5)</label>
                  <input type="number" min={1} max={5} value={editForm.consequence} onChange={(e) => setEditForm((p) => ({ ...p, consequence: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
                </div>
              </div>
              {(editForm.likelihood !== risk.likelihood || editForm.consequence !== risk.consequence) && (
                <div style={{ padding: "0.75rem", background: "#fef3c7", borderRadius: 6, border: "1px solid #f59e0b" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "#92400e" }}>Change log required when L or C changes</p>
                  {editForm.likelihood !== risk.likelihood && (
                    <div style={{ marginBottom: "0.5rem" }}>
                      <label style={labelStyle}>Reason Likelihood changed *</label>
                      <textarea value={editForm.likelihoodChangeReason} onChange={(e) => setEditForm((p) => ({ ...p, likelihoodChangeReason: e.target.value }))} required rows={2} style={formInputStyle} placeholder="Why did the likelihood change?" />
                    </div>
                  )}
                  {editForm.consequence !== risk.consequence && (
                    <div>
                      <label style={labelStyle}>Reason Consequence changed *</label>
                      <textarea value={editForm.consequenceChangeReason} onChange={(e) => setEditForm((p) => ({ ...p, consequenceChangeReason: e.target.value }))} required rows={2} style={formInputStyle} placeholder="Why did the consequence change?" />
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Mitigation Strategy</label>
                  <select value={editForm.mitigationStrategy} onChange={(e) => setEditForm((p) => ({ ...p, mitigationStrategy: e.target.value }))} style={formInputStyle}>
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
                  <input value={editForm.owner} onChange={(e) => setEditForm((p) => ({ ...p, owner: e.target.value }))} style={formInputStyle} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button type="submit" style={btnPrimary}>Save</button>
                <button type="button" onClick={cancelEdit} style={btnSecondary}>Cancel</button>
              </div>
            </form>
          ) : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 600, borderBottom: "2px solid #e5e7eb", paddingBottom: "0.35rem" }}>Risk Statement</h3>
                <button type="button" onClick={startEdit} style={{ ...btnPrimary, padding: "0.4rem 0.75rem", fontSize: "0.8rem", flexShrink: 0, marginLeft: "1rem" }}>Edit</button>
              </div>
              <dl style={{ display: "grid", gap: "0.5rem 1.5rem", gridTemplateColumns: "auto 1fr", margin: "0 0 1.25rem", fontSize: "0.9rem" }}>
                <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 90 }}>Condition</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>{risk.riskCondition ?? "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>If</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>{risk.riskIf ?? "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Then</dt>
                <dd style={{ margin: 0, fontWeight: 500 }}>{risk.riskThen ?? "—"}</dd>
              </dl>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0 2rem", alignItems: "start" }}>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.0625rem", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.35rem" }}>Status</h3>
                  <dl style={{ display: "grid", gap: "0.35rem 1rem", gridTemplateColumns: "auto 1fr", margin: 0, fontSize: "0.875rem" }}>
                    <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 82 }}>Status</dt>
                    <dd style={{ margin: 0 }}>
                      <span
                        title={
                          (displayRisk.status === "closed" || displayRisk.status === "accepted" || displayRisk.status === "realized") && displayRisk.statusChangeRationale
                            ? displayRisk.statusChangeRationale
                            : undefined
                        }
                        style={{
                          cursor: (displayRisk.status === "closed" || displayRisk.status === "accepted" || displayRisk.status === "realized") && displayRisk.statusChangeRationale ? "help" : undefined,
                        }}
                      >
                        {STATUS_LABELS[displayRisk.status] ?? displayRisk.status}
                      </span>
                    </dd>
                    {displayRisk.status === "realized" && (
                      <>
                        <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 82 }}>Realized</dt>
                        <dd style={{ margin: 0 }}>
                          {linkedIssue ? (
                            <span>
                              <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); onIssueCreated?.(linkedIssue.id); }}
                                style={{ color: "#2563eb", fontWeight: 500 }}
                              >
                                View issue: {linkedIssue.issueName}
                              </a>
                            </span>
                          ) : (
                            <span>
                              <button
                                type="button"
                                onClick={() => {
                                  const parts = [
                                    displayRisk.riskCondition ? `Condition: ${displayRisk.riskCondition}` : "",
                                    displayRisk.riskIf ? `If: ${displayRisk.riskIf}` : "",
                                    displayRisk.riskThen ? `Then: ${displayRisk.riskThen}` : "",
                                    "",
                                    "Edit the above to describe the issue.",
                                  ].filter(Boolean);
                                  setCreateIssueForm({
                                    issueName: displayRisk.riskName ?? "",
                                    description: parts.join("\n"),
                                    owner: displayRisk.owner ?? "",
                                    category: (displayRisk.category as string) ?? "",
                                    consequence: displayRisk.consequence ?? 3,
                                  });
                                  setCreateIssueError(null);
                                  setShowCreateIssueModal(true);
                                }}
                                style={{ ...btnPrimary, fontSize: "0.8125rem", padding: "0.35rem 0.75rem" }}
                              >
                                Create issue from this risk
                              </button>
                            </span>
                          )}
                        </dd>
                      </>
                    )}
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Owner</dt>
                    <dd style={{ margin: 0 }}>{risk.owner ?? "—"}</dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Last Updated</dt>
                    <dd style={{ margin: 0 }}>{new Date(risk.lastUpdated ?? risk.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Category</dt>
                    <dd style={{ margin: 0 }}>{risk.category ? (categoryLabels.get(risk.category) ?? risk.category) : "—"}</dd>
                  </dl>
                </div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.0625rem", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.35rem" }}>Risk Level</h3>
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
                          background: levelColor[risk.riskLevel ?? "moderate"] + "22",
                          color: levelColor[risk.riskLevel ?? "moderate"],
                          textTransform: "capitalize",
                        }}
                      >
                        {risk.riskLevel ?? "moderate"}
                      </span>
                    </dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Original L×C</dt>
                    <dd style={{ margin: 0 }}>
                      <span title="Immutable (tied to creation). If wrong, delete and recreate the risk." style={{ cursor: "help" }}>
                        L{risk.originalLikelihood ?? risk.likelihood}×C{risk.originalConsequence ?? risk.consequence}
                      </span>
                    </dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Current L×C</dt>
                    <dd style={{ margin: 0 }}>L{risk.likelihood}×C{risk.consequence}</dd>
                  </dl>
                </div>
                <div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.0625rem", fontWeight: 600, color: "#374151", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.35rem" }}>Mitigation</h3>
                  <dl style={{ display: "grid", gap: "0.35rem 1rem", gridTemplateColumns: "auto 1fr", margin: 0, fontSize: "0.875rem" }}>
                    <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 82 }}>Strategy</dt>
                    <dd style={{ margin: 0 }}>{risk.mitigationStrategy ? (STRATEGY_LABELS[risk.mitigationStrategy] ?? risk.mitigationStrategy) : "—"}</dd>
                    <dt style={{ color: "#6b7280", fontWeight: 600 }}>Plan</dt>
                    <dd style={{ margin: 0 }}>
                      {hasMitigationSteps === null ? "…" : (
                        <button type="button" onClick={() => setTab("mitigation")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "#2563eb", textDecoration: "underline" }}>
                          {hasMitigationSteps ? "Yes" : "No"}
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

      {tab === "mitigation" && (
        <div ref={mitigationTabRef} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => mitigationTabRef.current && exportElementAsPngCropped(mitigationTabRef.current, `Risk-Mitigation-${(risk.riskName ?? "risk").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}.png`)}
              style={{ padding: "0.5rem 1rem", background: "#6b7280", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" }}
              title="Export as PNG (cropped to content)"
            >
              Export PNG
            </button>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flexShrink: 0, minWidth: 380, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <RiskMitigationMatrix
                risk={risk}
                steps={mitigationSteps}
                showOriginalLxC={showOriginalLxC}
                onShowOriginalLxCChange={setShowOriginalLxC}
              />
            </div>
            <div style={{ flex: 1, minWidth: 320, background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
              <MitigationStepsEditor
                riskId={risk.id}
                risk={{ originalLikelihood: risk.originalLikelihood ?? risk.likelihood, originalConsequence: risk.originalConsequence ?? risk.consequence, likelihood: risk.likelihood, consequence: risk.consequence }}
                showOriginalLxC={showOriginalLxC}
                onUpdate={() => { onUpdate(); loadMitigationSteps(); loadAuditLog(); }}
                onStepsChange={(steps) => setMitigationSteps(steps)}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "waterfall" && (
        <div ref={waterfallTabRef} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => waterfallTabRef.current && exportElementAsPngCropped(waterfallTabRef.current, `Risk-Waterfall-${(risk.riskName ?? "risk").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40)}.png`)}
              style={{ padding: "0.5rem 1rem", background: "#6b7280", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontSize: "0.875rem" }}
              title="Export as PNG (cropped to content)"
            >
              Export PNG
            </button>
          </div>
          <RiskWaterfall orgUnit={orgUnit} risks={[risk]} preselectedRiskId={risk.id} />
        </div>
      )}

      {tab === "audit" && (
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Audit Log</h3>
          <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
            Every creation, update, and deletion of this risk and its mitigation steps.
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
                const entityLabel = entry.entityType === "risk" ? "Risk" : `Mitigation step ${entry.details?.stepNumber ?? "—"}`;
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
                          entry.details?.consequenceChangeReason ||
                          entry.details?.statusChangeRationale
                            ? "0.5rem"
                            : 0,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>
                        {entityLabel} — {actionLabel}
                      </span>
                      <span style={{ color: "#6b7280", fontSize: "0.8rem" }}>
                        {new Date(entry.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {entry.action === "updated" && (
                      <>
                        {changes && Object.keys(changes).length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#374151", fontSize: "0.8125rem" }}>
                            {Object.entries(changes).map(([fieldKey, { from, to }]) => {
                              const label = AUDIT_FIELD_LABELS[fieldKey] ?? fieldKey;
                              const fromStr = formatAuditValue(fieldKey, from, categoryLabels);
                              const toStr = formatAuditValue(fieldKey, to, categoryLabels);
                              return (
                                <li key={fieldKey} style={{ marginBottom: "0.25rem" }}>
                                  <strong>{label}:</strong> {fromStr} → {toStr}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {(entry.details?.likelihoodChangeReason ?? entry.details?.consequenceChangeReason ?? entry.details?.statusChangeRationale) && (
                          <div style={{ marginTop: changes && Object.keys(changes).length > 0 ? "0.5rem" : 0, fontSize: "0.8125rem", color: "#374151" }}>
                            {entry.details.likelihoodChangeReason && (
                              <p style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                                <strong>Likelihood change reason:</strong> {entry.details.likelihoodChangeReason}
                              </p>
                            )}
                            {entry.details.consequenceChangeReason && (
                              <p style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem" }}>
                                <strong>Consequence change reason:</strong> {entry.details.consequenceChangeReason}
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

      {showCreateIssueModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => !createIssueSubmitting && setShowCreateIssueModal(false)}>
          <div style={{ background: "white", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", maxWidth: 520, width: "90%", maxHeight: "90vh", overflow: "auto", padding: "1.5rem" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 600 }}>Create issue from realized risk</h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#6b7280" }}>Pre-filled from the risk. Edit as needed, then create the issue.</p>
            {createIssueError && <p style={{ color: "#dc2626", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>{createIssueError}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCreateIssueError(null);
                setCreateIssueSubmitting(true);
                fetch(`${API}/risks/${risk.id}/create-issue`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    issueName: createIssueForm.issueName.trim() || undefined,
                    description: createIssueForm.description.trim() || undefined,
                    owner: createIssueForm.owner.trim() || null,
                    category: createIssueForm.category.trim() || null,
                    consequence: createIssueForm.consequence,
                  }),
                })
                  .then((r) => {
                    if (!r.ok) return r.json().then((err: { error?: string }) => Promise.reject(new Error(err?.error ?? `HTTP ${r.status}`)));
                    return r.json();
                  })
                  .then((issue: { id: string }) => {
                    loadFullRisk();
                    onUpdate();
                    setShowCreateIssueModal(false);
                    onIssueCreated?.(issue.id);
                  })
                  .catch((err) => {
                    setCreateIssueError(err instanceof Error ? err.message : "Failed to create issue");
                  })
                  .finally(() => setCreateIssueSubmitting(false));
              }}
              style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
              <div>
                <label style={labelStyle}>Issue name *</label>
                <input value={createIssueForm.issueName} onChange={(e) => setCreateIssueForm((p) => ({ ...p, issueName: e.target.value }))} required style={formInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Description (edit to describe the issue)</label>
                <textarea value={createIssueForm.description} onChange={(e) => setCreateIssueForm((p) => ({ ...p, description: e.target.value }))} rows={6} style={formInputStyle} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <label style={labelStyle}>Owner</label>
                  <input value={createIssueForm.owner} onChange={(e) => setCreateIssueForm((p) => ({ ...p, owner: e.target.value }))} style={formInputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Category</label>
                  <select value={createIssueForm.category} onChange={(e) => setCreateIssueForm((p) => ({ ...p, category: e.target.value }))} style={formInputStyle}>
                    <option value="">—</option>
                    {categoryOptions.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Consequence (1–5)</label>
                <input type="number" min={1} max={5} value={createIssueForm.consequence} onChange={(e) => setCreateIssueForm((p) => ({ ...p, consequence: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
              </div>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => !createIssueSubmitting && setShowCreateIssueModal(false)} style={btnSecondary} disabled={createIssueSubmitting}>Cancel</button>
                <button type="submit" style={btnPrimary} disabled={createIssueSubmitting}>{createIssueSubmitting ? "Creating…" : "Create issue"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
