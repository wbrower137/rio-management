import { useState, useEffect } from "react";
import type { MitigationStep } from "../types";

const API = "/api";

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };
const btnDanger = { ...btnPrimary, background: "#dc2626" };

interface MitigationStepsEditorProps {
  riskId: string;
  onUpdate?: () => void;
  /** Called whenever steps are loaded or changed (add, edit, delete, reorder) */
  onStepsChange?: (steps: MitigationStep[]) => void;
  risk?: { originalLikelihood?: number; originalConsequence?: number; likelihood: number; consequence: number };
  showOriginalLxC?: boolean;
}

export function MitigationStepsEditor({ riskId, onUpdate, onStepsChange, risk, showOriginalLxC: _showOriginalLxC = false }: MitigationStepsEditorProps) {
  const [steps, setSteps] = useState<MitigationStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingStep, setEditingStep] = useState<MitigationStep | null>(null);
  const [stepToDelete, setStepToDelete] = useState<string | null>(null);
  const [stepToComplete, setStepToComplete] = useState<MitigationStep | null>(null);
  const [stepToUpdateRisk, setStepToUpdateRisk] = useState<{ actualL: number; actualC: number; likelihoodChangeReason: string; consequenceChangeReason: string } | null>(null);
  const [completeForm, setCompleteForm] = useState({ actualL: 3, actualC: 3, completedDate: "" });
  const [form, setForm] = useState({
    mitigationActions: "",
    closureCriteria: "",
    estimatedStartDate: "",
    estimatedEndDate: "",
    expectedLikelihood: 3,
    expectedConsequence: 3,
  });

  const load = () => {
    fetch(`${API}/risks/${riskId}/mitigation-steps`)
      .then((r) => r.json())
      .then((data: MitigationStep[]) => {
        const sorted = Array.isArray(data) ? [...data].sort((a, b) => a.sequenceOrder - b.sequenceOrder) : [];
        setSteps(sorted);
        onStepsChange?.(sorted);
      })
      .catch((e) => console.error("Failed to load steps:", e))
      .finally(() => setLoading(false));
  };

  useEffect(load, [riskId]);

  const getDefaultExpectedLC = () => {
    const last = steps[steps.length - 1];
    return {
      likelihood: last ? last.expectedLikelihood : (risk?.likelihood ?? 3),
      consequence: last ? last.expectedConsequence : (risk?.consequence ?? 3),
    };
  };

  useEffect(() => {
    if (!loading && !editingStep && (showAdd || steps.length === 0)) {
      const { likelihood, consequence } = getDefaultExpectedLC();
      setForm((prev) => ({ ...prev, expectedLikelihood: likelihood, expectedConsequence: consequence }));
    }
  }, [loading, steps, editingStep, showAdd, risk?.likelihood, risk?.consequence]);

  const resetForm = () => {
    setForm({
      mitigationActions: "",
      closureCriteria: "",
      estimatedStartDate: "",
      estimatedEndDate: "",
      expectedLikelihood: 3,
      expectedConsequence: 3,
    });
    setShowAdd(false);
    setEditingStep(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/risks/${riskId}/mitigation-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sequenceOrder: steps.length,
        mitigationActions: form.mitigationActions,
        closureCriteria: form.closureCriteria,
        estimatedStartDate: form.estimatedStartDate || null,
        estimatedEndDate: form.estimatedEndDate || null,
        expectedLikelihood: form.expectedLikelihood,
        expectedConsequence: form.expectedConsequence,
      }),
    })
      .then(() => {
        resetForm();
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to add step:", e));
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStep) return;
    fetch(`${API}/risks/${riskId}/mitigation-steps/${editingStep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mitigationActions: form.mitigationActions,
        closureCriteria: form.closureCriteria,
        estimatedStartDate: form.estimatedStartDate || null,
        estimatedEndDate: form.estimatedEndDate || null,
        expectedLikelihood: form.expectedLikelihood,
        expectedConsequence: form.expectedConsequence,
      }),
    })
      .then(() => {
        resetForm();
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to update step:", e));
  };

  const openCompleteModal = (s: MitigationStep) => {
    setStepToComplete(s);
    setCompleteForm({
      actualL: s.expectedLikelihood,
      actualC: s.expectedConsequence,
      completedDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleCompleteStep = () => {
    if (!stepToComplete || !completeForm.completedDate) return;
    const { actualL, actualC, completedDate } = completeForm;
    fetch(`${API}/risks/${riskId}/mitigation-steps/${stepToComplete.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualLikelihood: actualL,
        actualConsequence: actualC,
        actualCompletedAt: completedDate ? `${completedDate}T12:00:00.000Z` : null,
      }),
    })
      .then(() => {
        setStepToComplete(null);
        load();
        onUpdate?.();
        if (risk && (actualL !== risk.likelihood || actualC !== risk.consequence)) {
          setStepToUpdateRisk({ actualL, actualC, likelihoodChangeReason: "", consequenceChangeReason: "" });
        }
      })
      .catch((e) => console.error("Failed to complete step:", e));
  };

  const handleUpdateRiskConfirm = () => {
    if (!stepToUpdateRisk || !risk) return;
    const lChanged = stepToUpdateRisk.actualL !== risk.likelihood;
    const cChanged = stepToUpdateRisk.actualC !== risk.consequence;
    if (lChanged && !stepToUpdateRisk.likelihoodChangeReason.trim()) return;
    if (cChanged && !stepToUpdateRisk.consequenceChangeReason.trim()) return;
    fetch(`${API}/risks/${riskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        likelihood: stepToUpdateRisk.actualL,
        consequence: stepToUpdateRisk.actualC,
        likelihoodChangeReason: lChanged ? stepToUpdateRisk.likelihoodChangeReason : undefined,
        consequenceChangeReason: cChanged ? stepToUpdateRisk.consequenceChangeReason : undefined,
      }),
    })
      .then(() => {
        setStepToUpdateRisk(null);
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to update risk:", e));
  };

  const confirmDelete = (stepId: string) => setStepToDelete(stepId);

  const handleDeleteConfirm = () => {
    if (!stepToDelete) return;
    fetch(`${API}/risks/${riskId}/mitigation-steps/${stepToDelete}`, { method: "DELETE" })
      .then(() => {
        setStepToDelete(null);
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to delete step:", e));
  };

  const handleReorder = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= steps.length) return;
    const reordered = [...steps];
    [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];
    const stepIds = reordered.map((s) => s.id);
    fetch(`${API}/risks/${riskId}/mitigation-steps/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIds }),
    })
      .then(() => {
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to reorder steps:", e));
  };

  const startEdit = (s: MitigationStep) => {
    setEditingStep(s);
    setForm({
      mitigationActions: s.mitigationActions,
      closureCriteria: s.closureCriteria,
      estimatedStartDate: s.estimatedStartDate ? s.estimatedStartDate.slice(0, 10) : "",
      estimatedEndDate: s.estimatedEndDate ? s.estimatedEndDate.slice(0, 10) : "",
      expectedLikelihood: s.expectedLikelihood,
      expectedConsequence: s.expectedConsequence,
    });
  };

  const stepForm = (
    <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.5rem" }}>
      <div>
        <label style={labelStyle}>Mitigation actions *</label>
        <textarea
          value={form.mitigationActions}
          onChange={(e) => setForm((p) => ({ ...p, mitigationActions: e.target.value }))}
          required
          rows={2}
          style={formInputStyle}
          placeholder="Clearly stated actions to reduce risk"
        />
      </div>
      <div>
        <label style={labelStyle}>Closure criteria *</label>
        <textarea
          value={form.closureCriteria}
          onChange={(e) => setForm((p) => ({ ...p, closureCriteria: e.target.value }))}
          required
          rows={2}
          style={formInputStyle}
          placeholder="Criteria for closing this step"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={labelStyle}>Est. start date</label>
          <input
            type="date"
            value={form.estimatedStartDate}
            onChange={(e) => setForm((p) => ({ ...p, estimatedStartDate: e.target.value }))}
            style={formInputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Est. end date</label>
          <input
            type="date"
            value={form.estimatedEndDate}
            onChange={(e) => setForm((p) => ({ ...p, estimatedEndDate: e.target.value }))}
            style={formInputStyle}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={labelStyle}>Expected posture when step done — Likelihood (1–5)</label>
          <input
            type="number"
            min={1}
            max={5}
            value={form.expectedLikelihood}
            onChange={(e) => setForm((p) => ({ ...p, expectedLikelihood: parseInt(e.target.value) || 1 }))}
            style={formInputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Expected posture when step done — Consequence (1–5)</label>
          <input
            type="number"
            min={1}
            max={5}
            value={form.expectedConsequence}
            onChange={(e) => setForm((p) => ({ ...p, expectedConsequence: parseInt(e.target.value) || 1 }))}
            style={formInputStyle}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="submit" style={btnPrimary}>{editingStep ? "Save step" : "Add step"}</button>
        <button type="button" onClick={resetForm} style={btnSecondary}>Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb", position: "relative" }}>
      {stepToComplete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setStepToComplete(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: "1.5rem",
              maxWidth: 400,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 600 }}>Complete mitigation step</p>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "#6b7280" }}>{stepToComplete.mitigationActions.slice(0, 120)}{stepToComplete.mitigationActions.length > 120 ? "…" : ""}</p>
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Actual Likelihood (1–5) when completed *</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={completeForm.actualL}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, actualL: parseInt(e.target.value) || 1 }))}
                  style={formInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Actual Consequence (1–5) when completed *</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={completeForm.actualC}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, actualC: parseInt(e.target.value) || 1 }))}
                  style={formInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Completion date *</label>
                <input
                  type="date"
                  value={completeForm.completedDate}
                  onChange={(e) => setCompleteForm((p) => ({ ...p, completedDate: e.target.value }))}
                  style={formInputStyle}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStepToComplete(null)} style={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleCompleteStep} style={btnPrimary}>Complete</button>
            </div>
          </div>
        </div>
      )}
      {stepToUpdateRisk && risk && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => setStepToUpdateRisk(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: "1.5rem",
              maxWidth: 440,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
              The completed posture (L{stepToUpdateRisk.actualL}×C{stepToUpdateRisk.actualC}) differs from the current risk level. Update the risk to reflect this completed mitigation? This will become the new Current risk level. The Original risk level will not change.
            </p>
            {stepToUpdateRisk.actualL !== risk.likelihood && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={labelStyle}>Reason Likelihood changed *</label>
                <textarea value={stepToUpdateRisk.likelihoodChangeReason} onChange={(e) => setStepToUpdateRisk((p) => p ? { ...p, likelihoodChangeReason: e.target.value } : null)} rows={2} style={formInputStyle} placeholder="Why did the likelihood change?" required />
              </div>
            )}
            {stepToUpdateRisk.actualC !== risk.consequence && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Reason Consequence changed *</label>
                <textarea value={stepToUpdateRisk.consequenceChangeReason} onChange={(e) => setStepToUpdateRisk((p) => p ? { ...p, consequenceChangeReason: e.target.value } : null)} rows={2} style={formInputStyle} placeholder="Why did the consequence change?" required />
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStepToUpdateRisk(null)} style={btnSecondary}>No</button>
              <button type="button" onClick={handleUpdateRiskConfirm} style={btnPrimary}>Yes, update risk</button>
            </div>
          </div>
        </div>
      )}
      {stepToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setStepToDelete(null)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: "1.5rem",
              maxWidth: 400,
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
              Are you sure you want to delete this mitigation step? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStepToDelete(null)} style={btnSecondary}>
                Cancel
              </button>
              <button type="button" onClick={handleDeleteConfirm} style={btnDanger}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h5 style={{ margin: 0, fontSize: "0.875rem" }}>Mitigation steps</h5>
      </div>
      {loading ? (
        <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Loading...</p>
      ) : (
        <>
          {steps.length === 0 && !showAdd && !editingStep && (
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
              No steps yet. Add steps to define planned risk reduction and track actuals.
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.75rem" }}>
            {steps.map((s, idx) => (
              <li
                key={s.id}
                style={{
                  padding: "0.75rem",
                  background: "#f9fafb",
                  borderRadius: 6,
                  marginBottom: "0.5rem",
                  border: "1px solid #e5e7eb",
                }}
              >
                {editingStep?.id === s.id ? (
                  <form onSubmit={handleUpdate}>{stepForm}</form>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => startEdit(s)}
                          style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: "0.875rem", fontWeight: 600, color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                        >
                          Step {idx + 1}
                        </button>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", whiteSpace: "pre-wrap" }}>{s.mitigationActions}</p>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#6b7280" }}>
                          {s.actualCompletedAt ? `Completed: ${s.actualCompletedAt.slice(0, 10)}` : `Est. end: ${s.estimatedEndDate?.slice(0, 10) ?? "—"}`}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-end", flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                          {!s.actualCompletedAt && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                              <button type="button" onClick={() => handleReorder(idx, "up")} disabled={idx === 0} style={{ ...btnSecondary, padding: "0.15rem 0.35rem", fontSize: "0.7rem", opacity: idx === 0 ? 0.5 : 1 }} title="Move up">↑</button>
                              <button type="button" onClick={() => handleReorder(idx, "down")} disabled={idx === steps.length - 1} style={{ ...btnSecondary, padding: "0.15rem 0.35rem", fontSize: "0.7rem", opacity: idx === steps.length - 1 ? 0.5 : 1 }} title="Move down">↓</button>
                            </div>
                          )}
                          {!s.actualCompletedAt && (
                            <button type="button" onClick={() => confirmDelete(s.id)} style={{ ...btnDanger, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>Delete</button>
                          )}
                        </div>
                        {!s.actualCompletedAt && (
                          <button type="button" onClick={() => openCompleteModal(s)} style={{ ...btnPrimary, padding: "0.25rem 0.5rem", fontSize: "0.75rem", width: "100%" }}>Mark as Complete</button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
          {(showAdd || (steps.length === 0 && !editingStep)) && !editingStep && (
            <form onSubmit={handleAdd} style={{ background: "#f0f9ff", padding: "0.75rem", borderRadius: 6, border: "1px solid #bae6fd" }}>
              <strong style={{ fontSize: "0.875rem" }}>New mitigation step</strong>
              {stepForm}
            </form>
          )}
          {!showAdd && steps.length > 0 && !editingStep && (
            <button type="button" onClick={() => setShowAdd(true)} style={{ ...btnSecondary, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
              + Add step
            </button>
          )}
        </>
      )}
    </div>
  );
}
