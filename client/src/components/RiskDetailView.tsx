import { useState, useEffect } from "react";
import type { MitigationStep, OrganizationalUnit, Risk, RiskCategory } from "../types";
import { MitigationStepsEditor } from "./MitigationStepsEditor";
import { RiskMitigationMatrix } from "./RiskMitigationMatrix";
import { RiskWaterfall } from "./RiskWaterfall";

const API = "/api";

const CATEGORIES: { value: RiskCategory; label: string }[] = [
  { value: "technical", label: "Technical" },
  { value: "schedule", label: "Schedule" },
  { value: "cost", label: "Cost" },
  { value: "other", label: "Other" },
];

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
};

const levelColor: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  high: "#ef4444",
};

type DetailTab = "overview" | "mitigation" | "waterfall" | "history";

interface RiskDetailViewProps {
  risk: Risk;
  orgUnit: OrganizationalUnit;
  onBack: () => void;
  onUpdate: () => void;
}

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };

interface VersionEntry {
  version: number;
  snapshot: { riskName?: string; riskCondition?: string; riskIf?: string; riskThen?: string; category?: string; likelihood?: number; consequence?: number; riskLevel?: string; status?: string; owner?: string; mitigationStrategy?: string };
  createdAt: string;
}

const HISTORY_FIELDS: { key: keyof VersionEntry["snapshot"]; label: string }[] = [
  { key: "riskName", label: "Name" },
  { key: "riskCondition", label: "Condition" },
  { key: "riskIf", label: "If" },
  { key: "riskThen", label: "Then" },
  { key: "likelihood", label: "Current L" },
  { key: "consequence", label: "Current C" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "owner", label: "Owner" },
];

function formatHistoryValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (key === "category") return CATEGORIES.find((c) => c.value === value)?.label ?? String(value);
  if (key === "status") return STATUS_LABELS[value as string] ?? String(value);
  return String(value);
}

function getVersionChanges(
  current: VersionEntry["snapshot"],
  previous: VersionEntry["snapshot"] | undefined
): { label: string; from: string; to: string }[] {
  if (!previous) return [];
  const changes: { label: string; from: string; to: string }[] = [];
  for (const { key, label } of HISTORY_FIELDS) {
    const curr = current[key];
    const prev = previous[key];
    const currStr = formatHistoryValue(key, curr);
    const prevStr = formatHistoryValue(key, prev);
    if (currStr !== prevStr) {
      changes.push({ label, from: prevStr, to: currStr });
    }
  }
  return changes;
}

export function RiskDetailView({ risk, orgUnit, onBack, onUpdate }: RiskDetailViewProps) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const [editing, setEditing] = useState(false);
  const [showOriginalLxC, setShowOriginalLxC] = useState(false);
  const [hasMitigationSteps, setHasMitigationSteps] = useState<boolean | null>(null);
  const [mitigationSteps, setMitigationSteps] = useState<MitigationStep[] | null>(null);
  const [history, setHistory] = useState<VersionEntry[]>([]);

  const loadMitigationSteps = () => {
    fetch(`${API}/risks/${risk.id}/mitigation-steps`)
      .then((r) => r.json())
      .then((steps: unknown[]) => setHasMitigationSteps(steps.length > 0))
      .catch(() => setHasMitigationSteps(false));
  };

  useEffect(() => {
    loadMitigationSteps();
  }, [risk.id]);

  useEffect(() => {
    if (tab === "history") {
      fetch(`${API}/risks/${risk.id}/history`)
        .then((r) => r.json())
        .then((data: VersionEntry[]) => setHistory(Array.isArray(data) ? data.reverse() : []))
        .catch(() => setHistory([]));
    }
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
    });
  };

  const cancelEdit = () => setEditing(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const lChanged = editForm.likelihood !== risk.likelihood;
    const cChanged = editForm.consequence !== risk.consequence;
    if (lChanged && !editForm.likelihoodChangeReason.trim()) {
      return; // validation shown in form
    }
    if (cChanged && !editForm.consequenceChangeReason.trim()) {
      return;
    }
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
      }),
    })
      .then(() => {
        setEditing(false);
        onUpdate();
      })
      .catch((e) => console.error("Failed to update risk:", e));
  };

  const waterfallDisabled = hasMitigationSteps === false;
  const detailTabs: { id: DetailTab; label: string; disabled?: boolean }[] = [
    { id: "overview", label: "Overview" },
    { id: "mitigation", label: "Mitigation Steps" },
    { id: "waterfall", label: "Waterfall", disabled: waterfallDisabled },
    { id: "history", label: "History" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        <button type="button" onClick={onBack} style={{ ...btnSecondary, padding: "0.4rem 0.75rem", fontSize: "0.875rem" }}>
          ← Back
        </button>
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
                  <label style={labelStyle}>Category</label>
                  <select value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value as RiskCategory }))} style={formInputStyle}>
                    <option value="">—</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Likelihood (1-5) — current</label>
                  <input type="number" min={1} max={5} value={editForm.likelihood} onChange={(e) => setEditForm((p) => ({ ...p, likelihood: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Consequence (1-5) — current</label>
                  <input type="number" min={1} max={5} value={editForm.consequence} onChange={(e) => setEditForm((p) => ({ ...p, consequence: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} style={formInputStyle}>
                    <option value="open">Open</option>
                    <option value="mitigating">Mitigating</option>
                    <option value="accepted">Accepted</option>
                    <option value="closed">Closed</option>
                  </select>
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Risk Statement</h3>
                <button type="button" onClick={startEdit} style={{ ...btnPrimary, padding: "0.4rem 0.75rem", fontSize: "0.8rem" }}>Edit</button>
              </div>
              <dl style={{ display: "grid", gap: "0.75rem 2rem", gridTemplateColumns: "auto 1fr", margin: 0, fontSize: "0.9rem" }}>
                <dt style={{ color: "#6b7280", fontWeight: 600, minWidth: 90 }}>Condition</dt>
                <dd style={{ margin: 0 }}>{risk.riskCondition ?? "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>If</dt>
                <dd style={{ margin: 0 }}>{risk.riskIf ?? "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Then</dt>
                <dd style={{ margin: 0 }}>{risk.riskThen ?? "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Category</dt>
                <dd style={{ margin: 0 }}>{risk.category ? (CATEGORIES.find((c) => c.value === risk.category)?.label ?? risk.category) : "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Original</dt>
                <dd style={{ margin: 0 }}>
                  L{risk.originalLikelihood ?? risk.likelihood}×C{risk.originalConsequence ?? risk.consequence}
                  <span style={{ fontSize: "0.7rem", color: "#6b7280", marginLeft: "0.5rem", display: "block", marginTop: "0.2rem" }}>Immutable (tied to creation). If wrong, delete and recreate the risk.</span>
                </dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Current</dt>
                <dd style={{ margin: 0 }}>L{risk.likelihood}×C{risk.consequence}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Last updated</dt>
                <dd style={{ margin: 0 }}>{new Date(risk.updatedAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Risk Level</dt>
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
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Status</dt>
                <dd style={{ margin: 0 }}>{STATUS_LABELS[risk.status] ?? risk.status}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Owner</dt>
                <dd style={{ margin: 0 }}>{risk.owner ?? "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Mitigation Strategy</dt>
                <dd style={{ margin: 0 }}>{risk.mitigationStrategy ? (STRATEGY_LABELS[risk.mitigationStrategy] ?? risk.mitigationStrategy) : "—"}</dd>
                <dt style={{ color: "#6b7280", fontWeight: 600 }}>Mitigation Plan</dt>
                <dd style={{ margin: 0 }}>
                  {hasMitigationSteps === null ? "…" : (
                    <button type="button" onClick={() => setTab("mitigation")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit", color: "#2563eb", textDecoration: "underline" }}>
                      {hasMitigationSteps ? "Yes" : "No"}
                    </button>
                  )}
                </dd>
              </dl>
            </>
          )}
        </div>
      )}

      {tab === "mitigation" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#6b7280", cursor: "pointer" }}>
              <input type="checkbox" checked={showOriginalLxC} onChange={(e) => setShowOriginalLxC(e.target.checked)} />
              Show original L×C
            </label>
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>Applies to matrix and steps</span>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flexShrink: 0, minWidth: 380 }}>
              <RiskMitigationMatrix risk={risk} steps={mitigationSteps} showOriginalLxC={showOriginalLxC} />
            </div>
            <div style={{ flex: 1, minWidth: 320, background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1rem" }}>
              <MitigationStepsEditor
                riskId={risk.id}
                risk={{ originalLikelihood: risk.originalLikelihood ?? risk.likelihood, originalConsequence: risk.originalConsequence ?? risk.consequence, likelihood: risk.likelihood, consequence: risk.consequence }}
                showOriginalLxC={showOriginalLxC}
                onUpdate={() => { onUpdate(); loadMitigationSteps(); }}
                onStepsChange={(steps) => setMitigationSteps(steps)}
              />
            </div>
          </div>
        </div>
      )}

      {tab === "waterfall" && (
        <RiskWaterfall orgUnit={orgUnit} risks={[risk]} preselectedRiskId={risk.id} />
      )}

      {tab === "history" && (
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "1.5rem" }}>
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 600 }}>Version History</h3>
          {history.length === 0 ? (
            <p style={{ color: "#6b7280", margin: 0 }}>No version history yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {history.map((v, i) => {
                const previous = history[i + 1];
                const changes = getVersionChanges(v.snapshot ?? {}, previous?.snapshot);
                const isCreation = v.version === 1;
                return (
                  <div key={v.version} style={{ borderBottom: i < history.length - 1 ? "1px solid #e5e7eb" : undefined, paddingBottom: i < history.length - 1 ? "1rem" : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <strong style={{ fontSize: "0.9rem" }}>Version {v.version}</strong>
                      <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>{new Date(v.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    {isCreation ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>Risk created.</p>
                    ) : changes.length === 0 ? (
                      <p style={{ margin: 0, fontSize: "0.875rem", color: "#6b7280" }}>No tracked fields changed.</p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem" }}>
                        {changes.map((c) => (
                          <li key={c.label} style={{ marginBottom: "0.25rem" }}>
                            <strong>{c.label}:</strong> {c.from} → {c.to}
                          </li>
                        ))}
                      </ul>
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
