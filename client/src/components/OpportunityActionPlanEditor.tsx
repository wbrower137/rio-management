import { useState, useEffect } from "react";
import type { OpportunityActionPlanStep } from "../types";

const API = "/api";

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };
const btnDanger = { ...btnPrimary, background: "#dc2626" };

interface OpportunityActionPlanEditorProps {
  opportunityId: string;
  onUpdate?: () => void;
  onStepsChange?: (steps: OpportunityActionPlanStep[]) => void;
  opportunity?: { originalLikelihood?: number; originalImpact?: number; likelihood: number; impact: number };
}

export function OpportunityActionPlanEditor({
  opportunityId,
  onUpdate,
  onStepsChange,
  opportunity,
}: OpportunityActionPlanEditorProps) {
  const [steps, setSteps] = useState<OpportunityActionPlanStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingStep, setEditingStep] = useState<OpportunityActionPlanStep | null>(null);
  const [stepToDelete, setStepToDelete] = useState<string | null>(null);
  const [stepToComplete, setStepToComplete] = useState<OpportunityActionPlanStep | null>(null);
  const [stepToUpdateOpp, setStepToUpdateOpp] = useState<{ actualL: number; actualI: number; likelihoodChangeReason: string; impactChangeReason: string } | null>(null);
  const [completeForm, setCompleteForm] = useState({ actualL: 3, actualI: 3, completedDate: "" });
  const [form, setForm] = useState({
    plannedAction: "",
    estimatedStartDate: "",
    estimatedEndDate: "",
    expectedLikelihood: 3,
    expectedImpact: 3,
  });

  const load = () => {
    fetch(`${API}/opportunities/${opportunityId}/action-plan-steps`)
      .then((r) => r.json())
      .then((data: OpportunityActionPlanStep[]) => {
        const sorted = Array.isArray(data) ? [...data].sort((a, b) => a.sequenceOrder - b.sequenceOrder) : [];
        setSteps(sorted);
        onStepsChange?.(sorted);
      })
      .catch((e) => console.error("Failed to load action plan steps:", e))
      .finally(() => setLoading(false));
  };

  useEffect(load, [opportunityId]);

  const getDefaultExpectedLI = () => {
    const last = steps[steps.length - 1];
    return {
      likelihood: last ? last.expectedLikelihood : (opportunity?.likelihood ?? 3),
      impact: last ? last.expectedImpact : (opportunity?.impact ?? 3),
    };
  };

  useEffect(() => {
    if (!loading && !editingStep && (showAdd || steps.length === 0)) {
      const { likelihood, impact } = getDefaultExpectedLI();
      setForm((prev) => ({ ...prev, expectedLikelihood: likelihood, expectedImpact: impact }));
    }
  }, [loading, steps, editingStep, showAdd, opportunity?.likelihood, opportunity?.impact]);

  const resetForm = () => {
    setForm({
      plannedAction: "",
      estimatedStartDate: "",
      estimatedEndDate: "",
      expectedLikelihood: 3,
      expectedImpact: 3,
    });
    setShowAdd(false);
    setEditingStep(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/opportunities/${opportunityId}/action-plan-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sequenceOrder: steps.length,
        plannedAction: form.plannedAction,
        estimatedStartDate: form.estimatedStartDate || null,
        estimatedEndDate: form.estimatedEndDate || null,
        expectedLikelihood: form.expectedLikelihood,
        expectedImpact: form.expectedImpact,
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
    fetch(`${API}/opportunities/${opportunityId}/action-plan-steps/${editingStep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plannedAction: form.plannedAction,
        estimatedStartDate: form.estimatedStartDate || null,
        estimatedEndDate: form.estimatedEndDate || null,
        expectedLikelihood: form.expectedLikelihood,
        expectedImpact: form.expectedImpact,
      }),
    })
      .then(() => {
        resetForm();
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to update step:", e));
  };

  const openCompleteModal = (s: OpportunityActionPlanStep) => {
    setStepToComplete(s);
    setCompleteForm({
      actualL: s.expectedLikelihood,
      actualI: s.expectedImpact,
      completedDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleCompleteStep = () => {
    if (!stepToComplete || !completeForm.completedDate) return;
    const { actualL, actualI, completedDate } = completeForm;
    fetch(`${API}/opportunities/${opportunityId}/action-plan-steps/${stepToComplete.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualLikelihood: actualL,
        actualImpact: actualI,
        actualCompletedAt: completedDate ? `${completedDate}T12:00:00.000Z` : null,
      }),
    })
      .then(() => {
        setStepToComplete(null);
        load();
        onUpdate?.();
        if (opportunity && (actualL !== opportunity.likelihood || actualI !== opportunity.impact)) {
          setStepToUpdateOpp({ actualL, actualI, likelihoodChangeReason: "", impactChangeReason: "" });
        }
      })
      .catch((e) => console.error("Failed to complete step:", e));
  };

  const handleUpdateOppConfirm = () => {
    if (!stepToUpdateOpp || !opportunity) return;
    const lChanged = stepToUpdateOpp.actualL !== opportunity.likelihood;
    const iChanged = stepToUpdateOpp.actualI !== opportunity.impact;
    if (lChanged && !stepToUpdateOpp.likelihoodChangeReason.trim()) return;
    if (iChanged && !stepToUpdateOpp.impactChangeReason.trim()) return;
    fetch(`${API}/opportunities/${opportunityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        likelihood: stepToUpdateOpp.actualL,
        impact: stepToUpdateOpp.actualI,
        likelihoodChangeReason: lChanged ? stepToUpdateOpp.likelihoodChangeReason : undefined,
        impactChangeReason: iChanged ? stepToUpdateOpp.impactChangeReason : undefined,
      }),
    })
      .then(() => {
        setStepToUpdateOpp(null);
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to update opportunity:", e));
  };

  const handleDeleteConfirm = () => {
    if (!stepToDelete) return;
    fetch(`${API}/opportunities/${opportunityId}/action-plan-steps/${stepToDelete}`, { method: "DELETE" })
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
    fetch(`${API}/opportunities/${opportunityId}/action-plan-steps/reorder`, {
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

  const startEdit = (s: OpportunityActionPlanStep) => {
    setEditingStep(s);
    setForm({
      plannedAction: s.plannedAction,
      estimatedStartDate: s.estimatedStartDate ? s.estimatedStartDate.slice(0, 10) : "",
      estimatedEndDate: s.estimatedEndDate ? s.estimatedEndDate.slice(0, 10) : "",
      expectedLikelihood: s.expectedLikelihood,
      expectedImpact: s.expectedImpact,
    });
  };

  const stepForm = (
    <div style={{ display: "grid", gap: "0.75rem", marginTop: "0.5rem" }}>
      <div>
        <label style={labelStyle}>Planned action *</label>
        <textarea
          value={form.plannedAction}
          onChange={(e) => setForm((p) => ({ ...p, plannedAction: e.target.value }))}
          required
          rows={2}
          style={formInputStyle}
          placeholder="Clearly stated action to pursue this opportunity"
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={labelStyle}>Est. start date</label>
          <input type="date" value={form.estimatedStartDate} onChange={(e) => setForm((p) => ({ ...p, estimatedStartDate: e.target.value }))} style={formInputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Est. end date</label>
          <input type="date" value={form.estimatedEndDate} onChange={(e) => setForm((p) => ({ ...p, estimatedEndDate: e.target.value }))} style={formInputStyle} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={labelStyle}>Expected Likelihood (1–5) when step done</label>
          <input type="number" min={1} max={5} value={form.expectedLikelihood} onChange={(e) => setForm((p) => ({ ...p, expectedLikelihood: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Expected Impact (1–5) when step done</label>
          <input type="number" min={1} max={5} value={form.expectedImpact} onChange={(e) => setForm((p) => ({ ...p, expectedImpact: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setStepToComplete(null)}>
          <div style={{ background: "white", borderRadius: 8, padding: "1.5rem", maxWidth: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 600 }}>Complete action plan step</p>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "#6b7280" }}>{stepToComplete.plannedAction.slice(0, 120)}{stepToComplete.plannedAction.length > 120 ? "…" : ""}</p>
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Actual Likelihood (1–5) when completed *</label>
                <input type="number" min={1} max={5} value={completeForm.actualL} onChange={(e) => setCompleteForm((p) => ({ ...p, actualL: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Actual Impact (1–5) when completed *</label>
                <input type="number" min={1} max={5} value={completeForm.actualI} onChange={(e) => setCompleteForm((p) => ({ ...p, actualI: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Completion date *</label>
                <input type="date" value={completeForm.completedDate} onChange={(e) => setCompleteForm((p) => ({ ...p, completedDate: e.target.value }))} style={formInputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStepToComplete(null)} style={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleCompleteStep} style={btnPrimary}>Complete</button>
            </div>
          </div>
        </div>
      )}
      {stepToUpdateOpp && opportunity && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001 }} onClick={() => setStepToUpdateOpp(null)}>
          <div style={{ background: "white", borderRadius: 8, padding: "1.5rem", maxWidth: 440, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
              The completed posture (L{stepToUpdateOpp.actualL}×I{stepToUpdateOpp.actualI}) differs from the current opportunity level. Update the opportunity to reflect this?
            </p>
            {stepToUpdateOpp.actualL !== opportunity.likelihood && (
              <div style={{ marginBottom: "0.75rem" }}>
                <label style={labelStyle}>Reason Likelihood changed *</label>
                <textarea value={stepToUpdateOpp.likelihoodChangeReason} onChange={(e) => setStepToUpdateOpp((p) => p ? { ...p, likelihoodChangeReason: e.target.value } : null)} rows={2} style={formInputStyle} placeholder="Why did the likelihood change?" required />
              </div>
            )}
            {stepToUpdateOpp.actualI !== opportunity.impact && (
              <div style={{ marginBottom: "1rem" }}>
                <label style={labelStyle}>Reason Impact changed *</label>
                <textarea value={stepToUpdateOpp.impactChangeReason} onChange={(e) => setStepToUpdateOpp((p) => p ? { ...p, impactChangeReason: e.target.value } : null)} rows={2} style={formInputStyle} placeholder="Why did the impact change?" required />
              </div>
            )}
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStepToUpdateOpp(null)} style={btnSecondary}>No</button>
              <button type="button" onClick={handleUpdateOppConfirm} style={btnPrimary}>Yes, update opportunity</button>
            </div>
          </div>
        </div>
      )}
      {stepToDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setStepToDelete(null)}>
          <div style={{ background: "white", borderRadius: 8, padding: "1.5rem", maxWidth: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>Are you sure you want to delete this action plan step? This cannot be undone.</p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStepToDelete(null)} style={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleDeleteConfirm} style={btnDanger}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h5 style={{ margin: 0, fontSize: "0.875rem" }}>Action plan steps</h5>
      </div>
      {loading ? (
        <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Loading...</p>
      ) : (
        <>
          {steps.length === 0 && !showAdd && !editingStep && (
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>No steps yet. Add steps to define planned opportunity pursuit and track actuals.</p>
          )}
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 0.75rem" }}>
            {steps.map((s, idx) => (
              <li key={s.id} style={{ padding: "0.75rem", background: "#f9fafb", borderRadius: 6, marginBottom: "0.5rem", border: "1px solid #e5e7eb" }}>
                {editingStep?.id === s.id ? (
                  <form onSubmit={handleUpdate}>{stepForm}</form>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button type="button" onClick={() => startEdit(s)} style={{ background: "none", border: "none", padding: 0, font: "inherit", fontSize: "0.875rem", fontWeight: 600, color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}>
                          Step {idx + 1}
                        </button>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", whiteSpace: "pre-wrap" }}>{s.plannedAction}</p>
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
                            <button type="button" onClick={() => setStepToDelete(s.id)} style={{ ...btnDanger, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>Delete</button>
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
            <form onSubmit={handleAdd} style={{ background: "#f0fdf4", padding: "0.75rem", borderRadius: 6, border: "1px solid #86efac" }}>
              <strong style={{ fontSize: "0.875rem" }}>New action plan step</strong>
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
