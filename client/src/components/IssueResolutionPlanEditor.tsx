import { useState, useEffect } from "react";
import type { IssueResolutionStep } from "../types";

const API = "/api";

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };
const btnDanger = { ...btnPrimary, background: "#dc2626" };

interface IssueResolutionPlanEditorProps {
  issueId: string;
  onUpdate?: () => void;
  onStepsChange?: (steps: IssueResolutionStep[]) => void;
  issue?: { consequence: number };
}

export function IssueResolutionPlanEditor({ issueId, onUpdate, onStepsChange, issue }: IssueResolutionPlanEditorProps) {
  const [steps, setSteps] = useState<IssueResolutionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingStep, setEditingStep] = useState<IssueResolutionStep | null>(null);
  const [stepToDelete, setStepToDelete] = useState<string | null>(null);
  const [stepToComplete, setStepToComplete] = useState<IssueResolutionStep | null>(null);
  const [completeForm, setCompleteForm] = useState({ actualConsequence: 3, completedDate: "" });
  const [form, setForm] = useState({
    plannedAction: "",
    estimatedStartDate: "",
    estimatedEndDate: "",
    expectedConsequence: 3,
  });

  const load = () => {
    fetch(`${API}/issues/${issueId}/resolution-steps`)
      .then((r) => r.json())
      .then((data: IssueResolutionStep[] | unknown) => {
        const sorted = Array.isArray(data) ? [...data].sort((a, b) => a.sequenceOrder - b.sequenceOrder) : [];
        setSteps(sorted);
        onStepsChange?.(sorted);
      })
      .catch((e) => console.error("Failed to load resolution steps:", e))
      .finally(() => setLoading(false));
  };

  useEffect(load, [issueId]);

  const getDefaultExpectedC = () => {
    const last = steps[steps.length - 1];
    return last ? last.expectedConsequence : (issue?.consequence ?? 3);
  };

  useEffect(() => {
    if (!loading && !editingStep && (showAdd || steps.length === 0)) {
      setForm((prev) => ({ ...prev, expectedConsequence: getDefaultExpectedC() }));
    }
  }, [loading, steps, editingStep, showAdd, issue?.consequence]);

  const resetForm = () => {
    setForm({
      plannedAction: "",
      estimatedStartDate: "",
      estimatedEndDate: "",
      expectedConsequence: issue?.consequence ?? 3,
    });
    setShowAdd(false);
    setEditingStep(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/issues/${issueId}/resolution-steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sequenceOrder: steps.length,
        plannedAction: form.plannedAction,
        estimatedStartDate: form.estimatedStartDate || null,
        estimatedEndDate: form.estimatedEndDate || null,
        expectedConsequence: form.expectedConsequence,
      }),
    })
      .then(() => {
        resetForm();
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to add resolution step:", e));
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStep) return;
    fetch(`${API}/issues/${issueId}/resolution-steps/${editingStep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plannedAction: form.plannedAction,
        estimatedStartDate: form.estimatedStartDate || null,
        estimatedEndDate: form.estimatedEndDate || null,
        expectedConsequence: form.expectedConsequence,
      }),
    })
      .then(() => {
        resetForm();
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to update resolution step:", e));
  };

  const openCompleteModal = (s: IssueResolutionStep) => {
    setStepToComplete(s);
    setCompleteForm({
      actualConsequence: s.expectedConsequence,
      completedDate: new Date().toISOString().slice(0, 10),
    });
  };

  const handleCompleteStep = () => {
    if (!stepToComplete || !completeForm.completedDate) return;
    fetch(`${API}/issues/${issueId}/resolution-steps/${stepToComplete.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actualConsequence: completeForm.actualConsequence,
        actualCompletedAt: `${completeForm.completedDate}T12:00:00.000Z`,
      }),
    })
      .then(() => {
        setStepToComplete(null);
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to complete step:", e));
  };

  const handleDeleteConfirm = () => {
    if (!stepToDelete) return;
    fetch(`${API}/issues/${issueId}/resolution-steps/${stepToDelete}`, { method: "DELETE" })
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
    fetch(`${API}/issues/${issueId}/resolution-steps/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIds }),
    })
      .then(() => {
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to reorder steps:", e));
  };

  const startEdit = (s: IssueResolutionStep) => {
    setEditingStep(s);
    setForm({
      plannedAction: s.plannedAction,
      estimatedStartDate: s.estimatedStartDate ? s.estimatedStartDate.slice(0, 10) : "",
      estimatedEndDate: s.estimatedEndDate ? s.estimatedEndDate.slice(0, 10) : "",
      expectedConsequence: s.expectedConsequence,
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
          placeholder="Resolution action to reduce consequence"
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
      <div>
        <label style={labelStyle}>Expected Consequence (1–5) when step done</label>
        <input type="number" min={1} max={5} value={form.expectedConsequence} onChange={(e) => setForm((p) => ({ ...p, expectedConsequence: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
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
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", fontWeight: 600 }}>Complete resolution step</p>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "#6b7280" }}>{stepToComplete.plannedAction.slice(0, 120)}{stepToComplete.plannedAction.length > 120 ? "…" : ""}</p>
            <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
              <div>
                <label style={labelStyle}>Actual Consequence (1–5) when completed *</label>
                <input type="number" min={1} max={5} value={completeForm.actualConsequence} onChange={(e) => setCompleteForm((p) => ({ ...p, actualConsequence: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
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
      {stepToDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setStepToDelete(null)}>
          <div style={{ background: "white", borderRadius: 8, padding: "1.5rem", maxWidth: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>Are you sure you want to delete this resolution step? This cannot be undone.</p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setStepToDelete(null)} style={btnSecondary}>Cancel</button>
              <button type="button" onClick={handleDeleteConfirm} style={btnDanger}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h5 style={{ margin: 0, fontSize: "0.875rem" }}>Resolution plan steps</h5>
      </div>
      {loading ? (
        <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Loading...</p>
      ) : (
        <>
          {steps.length === 0 && !showAdd && !editingStep && (
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>No steps yet. Add resolution steps to track planned vs actual consequence reduction.</p>
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
                          Expected C: {s.expectedConsequence} {s.actualCompletedAt ? `• Completed: ${s.actualCompletedAt.slice(0, 10)} (C: ${s.actualConsequence ?? s.expectedConsequence})` : `• Est. end: ${s.estimatedEndDate?.slice(0, 10) ?? "—"}`}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", alignItems: "flex-end", flexShrink: 0 }}>
                        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                          {!s.actualCompletedAt && (
                            <>
                              <button type="button" onClick={() => handleReorder(idx, "up")} disabled={idx === 0} style={{ ...btnSecondary, padding: "0.15rem 0.35rem", fontSize: "0.7rem", opacity: idx === 0 ? 0.5 : 1 }} title="Move up">↑</button>
                              <button type="button" onClick={() => handleReorder(idx, "down")} disabled={idx === steps.length - 1} style={{ ...btnSecondary, padding: "0.15rem 0.35rem", fontSize: "0.7rem", opacity: idx === steps.length - 1 ? 0.5 : 1 }} title="Move down">↓</button>
                              <button type="button" onClick={() => setStepToDelete(s.id)} style={{ ...btnDanger, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>Delete</button>
                            </>
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
              <strong style={{ fontSize: "0.875rem" }}>New resolution step</strong>
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
