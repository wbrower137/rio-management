import { useState, useEffect } from "react";
import type { Category, Issue, OrganizationalUnit } from "../types";
import { IssueResolutionPlanEditor } from "./IssueResolutionPlanEditor";
import { IssueWaterfall } from "./IssueWaterfall";

const API = "/api";

const STATUS_LABELS: Record<string, string> = {
  ignore: "Ignore",
  control: "Control",
};

const levelColor: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#ef4444",
};

const CONSEQUENCE_LABELS = ["1: Minimal", "2: Minor", "3: Moderate", "4: Significant", "5: Severe"];

type DetailTab = "overview" | "resolution_plan" | "waterfall" | "audit";

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
    resolutionStepsReordered?: { from: string; to: string };
  };
  createdAt: string;
}

function formatAuditValue(key: string, value: unknown, categoryLabels: Map<string, string>): string {
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

const AUDIT_FIELD_LABELS: Record<string, string> = {
  issueName: "Name",
  description: "Description",
  consequence: "Consequence",
  owner: "Owner",
  category: "Category",
  status: "Status",
  sequenceOrder: "Sequence",
  plannedAction: "Planned action",
  estimatedStartDate: "Est. start date",
  estimatedEndDate: "Est. end date",
  expectedConsequence: "Expected C",
  expectedIssueLevel: "Expected level",
  actualConsequence: "Actual C",
  actualIssueLevel: "Actual level",
  actualCompletedAt: "Completed",
  resolutionStepsReordered: "Resolution steps reordered",
};

interface IssueDetailViewProps {
  categories: Category[];
  issue: Issue;
  orgUnit: OrganizationalUnit;
  onBack: () => void;
  onUpdate: () => void;
  /** When issue was created from a realized risk, call to open that risk. */
  onSelectRisk?: (riskId: string) => void;
}

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };

export function IssueDetailView({ categories, issue, orgUnit, onBack, onUpdate, onSelectRisk }: IssueDetailViewProps) {
  const categoryLabels = new Map(categories.map((c) => [c.code, c.label]));
  const categoryOptions = categories.map((c) => ({ value: c.code, label: c.label }));
  const [tab, setTab] = useState<DetailTab>("overview");
  const [editing, setEditing] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogError, setAuditLogError] = useState<string | null>(null);
  const [fullIssue, setFullIssue] = useState<Issue | null>(null);
  const displayIssue = fullIssue ?? issue;
  useEffect(() => {
    fetch(`${API}/issues/${issue.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Issue | null) => data && setFullIssue(data))
      .catch(() => setFullIssue(null));
  }, [issue.id]);
  const [form, setForm] = useState({
    issueName: issue.issueName,
    description: issue.description ?? "",
    consequence: issue.consequence,
    category: issue.category ?? "",
    status: issue.status,
    owner: issue.owner ?? "",
  });

  const loadAuditLog = () => {
    setAuditLogError(null);
    setAuditLogLoading(true);
    fetch(`${API}/issues/${issue.id}/audit-log`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg = typeof body?.error === "string" ? body.error : r.status === 404 ? "Issue not found" : `Failed to load audit log (${r.status})`;
          throw new Error(msg);
        }
        return body;
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
    if (tab === "audit") loadAuditLog();
  }, [tab, issue.id]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issueName: form.issueName.trim(),
        description: form.description.trim() || null,
        consequence: form.consequence,
        category: form.category || null,
        status: form.status,
        owner: form.owner.trim() || null,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setEditing(false);
        onUpdate();
        loadAuditLog();
      })
      .catch((e) => console.error("Failed to update issue:", e));
  };

  const tabs: { id: DetailTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "resolution_plan", label: "Resolution Plan" },
    { id: "waterfall", label: "Waterfall" },
    { id: "audit", label: "Audit Log" },
  ];

  const detailTheme = { bg: "#fef2f2", border: "#dc2626", badge: "#dc2626" }; // Issue: red (realized / happened)
  return (
    <div style={{ background: detailTheme.bg, borderLeft: "4px solid " + detailTheme.border, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <button type="button" onClick={onBack} style={{ ...btnSecondary, padding: "0.25rem 0.5rem", fontSize: "0.875rem" }}>
          ← Back
        </button>
        <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", padding: "0.25rem 0.5rem", borderRadius: 6, background: detailTheme.badge, color: "white" }}>
          Issue
        </span>
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>{displayIssue.issueName}</h2>
      </div>

      <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                padding: "0.5rem 1rem",
                background: tab === t.id ? "#2563eb" : "#f3f4f6",
                color: tab === t.id ? "white" : "#374151",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "1rem 1.5rem" }}>
        {tab === "overview" && (
          <div>
            {editing ? (
              <form onSubmit={handleSave} style={{ display: "grid", gap: "1rem", maxWidth: 500 }}>
                <h3 style={{ margin: "0 0 0.5rem" }}>Edit Issue</h3>
                <div>
                  <label style={labelStyle}>Issue Name *</label>
                  <input value={form.issueName} onChange={(e) => setForm((p) => ({ ...p, issueName: e.target.value }))} required style={formInputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} style={formInputStyle} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={labelStyle}>Category</label>
                    <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={formInputStyle}>
                      <option value="">—</option>
                      {categoryOptions.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Consequence (1-5)</label>
                    <input type="number" min={1} max={5} value={form.consequence} onChange={(e) => setForm((p) => ({ ...p, consequence: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "ignore" | "control" }))} style={formInputStyle}>
                      <option value="control">Control</option>
                      <option value="ignore">Ignore</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Owner</label>
                  <input value={form.owner} onChange={(e) => setForm((p) => ({ ...p, owner: e.target.value }))} style={formInputStyle} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="submit" style={btnPrimary}>Save</button>
                  <button type="button" onClick={() => setEditing(false)} style={btnSecondary}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem" }}>{displayIssue.issueName}</h2>
                <p style={{ margin: "0 0 1rem", color: "#6b7280", fontSize: "0.875rem" }}>
                  {displayIssue.description || "No description."}
                </p>
                <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.5rem 1.5rem", marginBottom: "1rem" }}>
                  <dt style={{ color: "#6b7280", fontSize: "0.875rem" }}>Category</dt>
                  <dd style={{ margin: 0 }}>{categoryLabels.get(displayIssue.category ?? "") ?? displayIssue.category ?? "—"}</dd>
                  <dt style={{ color: "#6b7280", fontSize: "0.875rem" }}>Consequence</dt>
                  <dd style={{ margin: 0 }}>{CONSEQUENCE_LABELS[displayIssue.consequence - 1] ?? displayIssue.consequence}</dd>
                  <dt style={{ color: "#6b7280", fontSize: "0.875rem" }}>Level</dt>
                  <dd style={{ margin: 0 }}>
                    <span style={{ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: 4, background: `${levelColor[displayIssue.issueLevel ?? "moderate"]}33`, color: "#374151", fontSize: "0.875rem" }}>
                      {(displayIssue.issueLevel ?? "moderate").charAt(0).toUpperCase() + (displayIssue.issueLevel ?? "moderate").slice(1)}
                    </span>
                  </dd>
                  <dt style={{ color: "#6b7280", fontSize: "0.875rem" }}>Status</dt>
                  <dd style={{ margin: 0 }}>{STATUS_LABELS[displayIssue.status ?? "control"]}</dd>
                  <dt style={{ color: "#6b7280", fontSize: "0.875rem" }}>Owner</dt>
                  <dd style={{ margin: 0 }}>{displayIssue.owner ?? "—"}</dd>
                  {displayIssue.sourceRisk && onSelectRisk && (
                    <>
                      <dt style={{ color: "#6b7280", fontSize: "0.875rem" }}>Source risk</dt>
                      <dd style={{ margin: 0 }}>
                        <a
                          href="#"
                          onClick={(e) => { e.preventDefault(); onSelectRisk(displayIssue.sourceRisk!.id); }}
                          style={{ color: "#2563eb", fontWeight: 500 }}
                        >
                          {displayIssue.sourceRisk.riskName}
                        </a>
                      </dd>
                    </>
                  )}
                </dl>
                <button type="button" onClick={() => setEditing(true)} style={btnSecondary}>Edit</button>
              </>
            )}
          </div>
        )}

        {tab === "resolution_plan" && (
          <IssueResolutionPlanEditor
            issueId={issue.id}
            issue={issue}
            onUpdate={() => {
              onUpdate();
              loadAuditLog();
            }}
          />
        )}

        {tab === "audit" && (
          <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1.5rem" }}>
            <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Audit Log</h3>
            <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
              Every creation, update, and deletion of this issue and its resolution plan steps.
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
                  const entityLabel = entry.entityType === "issue" ? "Issue" : `Resolution step ${entry.details?.stepNumber ?? "—"}`;
                  const actionLabel = entry.action === "created" ? "Created" : entry.action === "updated" ? "Updated" : "Deleted";
                  const changes = entry.details?.changes;
                  const reordered = entry.details?.resolutionStepsReordered;
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
                            (changes && Object.keys(changes).length > 0) || reordered
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
                          {reordered && (
                            <p style={{ margin: "0.25rem 0 0", paddingLeft: "1.25rem", fontSize: "0.8125rem", color: "#374151" }}>
                              <strong>{AUDIT_FIELD_LABELS.resolutionStepsReordered}:</strong> {reordered.from} → {reordered.to}
                            </p>
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

        {tab === "waterfall" && (
          <IssueWaterfall orgUnit={orgUnit} issues={[issue]} preselectedIssueId={issue.id} />
        )}
      </div>
    </div>
  );
}
