import { useState, useEffect } from "react";
import type { LegalEntity, OrganizationalUnit } from "../types";

const API = "/api";

const formInputStyle = {
  width: "100%" as const,
  padding: "0.5rem",
  borderRadius: 6,
  border: "1px solid #d1d5db",
};
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem", color: "#374151" };
const btnPrimary = {
  padding: "0.5rem 1rem",
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 6,
  cursor: "pointer" as const,
  fontSize: "0.875rem",
};
const btnDanger = { ...btnPrimary, background: "#dc2626" };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };

const typeLabel: Record<string, string> = {
  program: "Program",
  project: "Project",
  department: "Department",
};

interface OrgUnitManagerProps {
  legalEntities: LegalEntity[];
  onUpdate?: () => void;
}

export function OrgUnitManager({ legalEntities, onUpdate }: OrgUnitManagerProps) {
  const [selectedEntity, setSelectedEntity] = useState<LegalEntity | null>(null);
  const [orgUnits, setOrgUnits] = useState<OrganizationalUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<OrganizationalUnit | null>(null);
  const [deleting, setDeleting] = useState<OrganizationalUnit | null>(null);
  const [form, setForm] = useState({
    type: "program" as "program" | "project" | "department",
    name: "",
    code: "",
    description: "",
  });

  const loadOrgUnits = () => {
    if (!selectedEntity) return;
    setLoading(true);
    fetch(`${API}/organizational-units?legalEntityId=${selectedEntity.id}`)
      .then((r) => r.json())
      .then(setOrgUnits)
      .catch((e) => console.error("Failed to load org units:", e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setSelectedEntity(legalEntities[0] ?? null);
  }, [legalEntities]);

  useEffect(() => {
    if (!selectedEntity) {
      setOrgUnits([]);
      return;
    }
    setLoading(true);
    fetch(`${API}/organizational-units?legalEntityId=${selectedEntity.id}`)
      .then((r) => r.json())
      .then(setOrgUnits)
      .catch((e) => console.error("Failed to load org units:", e))
      .finally(() => setLoading(false));
  }, [selectedEntity?.id]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntity) return;
    fetch(`${API}/organizational-units`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legalEntityId: selectedEntity.id,
        type: form.type,
        name: form.name,
        code: form.code,
        description: form.description || null,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setShowAddForm(false);
        setForm({ type: "program", name: "", code: "", description: "" });
        loadOrgUnits();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to add org unit:", e));
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    fetch(`${API}/organizational-units/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then(() => {
        setEditing(null);
        setForm({ type: "program", name: "", code: "", description: "" });
        loadOrgUnits();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to update org unit:", e));
  };

  const handleDelete = () => {
    if (!deleting) return;
    fetch(`${API}/organizational-units/${deleting.id}`, { method: "DELETE" })
      .then(() => {
        setDeleting(null);
        loadOrgUnits();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to delete org unit:", e));
  };

  const startEdit = (u: OrganizationalUnit) => {
    setEditing(u);
    setForm({ type: u.type, name: u.name, code: u.code, description: u.description ?? "" });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ type: "program", name: "", code: "", description: "" });
  };

  return (
    <section style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>Programs, Projects & Departments</h2>
          <select
            value={selectedEntity?.id ?? ""}
            onChange={(e) => setSelectedEntity(legalEntities.find((l) => l.id === e.target.value) ?? null)}
            style={{ padding: "0.5rem 2rem 0.5rem 0.75rem", borderRadius: 6, border: "1px solid #d1d5db" }}
          >
            <option value="">— Select Legal Entity —</option>
            {legalEntities.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <button
          style={btnPrimary}
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={!selectedEntity}
        >
          {showAddForm ? "Cancel" : "+ Add Program / Project / Department"}
        </button>
      </div>

      {!selectedEntity && (
        <p style={{ padding: "2rem", color: "#6b7280" }}>Select a Legal Entity to manage its Programs, Projects, and Departments.</p>
      )}

      {selectedEntity && showAddForm && (
        <form
          onSubmit={handleAdd}
          style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}
        >
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>New {typeLabel[form.type]} in {selectedEntity.name}</h3>
          <div style={{ display: "grid", gap: "1rem", maxWidth: 500, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={labelStyle}>Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as "program" | "project" | "department" }))}
                style={formInputStyle}
              >
                <option value="program">Program</option>
                <option value="project">Project</option>
                <option value="department">Department</option>
              </select>
            </div>
            <div />
            <div>
              <label style={labelStyle}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                style={formInputStyle}
                placeholder="e.g. Program Alpha"
              />
            </div>
            <div>
              <label style={labelStyle}>Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                required
                style={formInputStyle}
                placeholder="e.g. PROG-ALPHA"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                style={formInputStyle}
                placeholder="Optional"
              />
            </div>
            <div>
              <button type="submit" style={btnPrimary}>Add</button>
            </div>
          </div>
        </form>
      )}

      {selectedEntity && (
        loading ? (
          <p style={{ padding: "2rem", color: "#6b7280" }}>Loading...</p>
        ) : orgUnits.length === 0 ? (
          <p style={{ padding: "2rem", color: "#6b7280" }}>No Programs, Projects, or Departments yet. Add one above.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#6b7280" }}>Type</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#6b7280" }}>Name</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#6b7280" }}>Code</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#6b7280" }}>Description</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgUnits.map((u) =>
                editing?.id === u.id ? (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6", background: "#fffbeb" }}>
                    <td colSpan={5} style={{ padding: "1rem" }}>
                      <form onSubmit={handleEdit} style={{ display: "grid", gap: "1rem", maxWidth: 500 }}>
                        <h4 style={{ margin: "0 0 0.5rem" }}>Edit {typeLabel[u.type]}</h4>
                        <div>
                          <label style={labelStyle}>Type</label>
                          <select
                            value={form.type}
                            onChange={(ev) => setForm((p) => ({ ...p, type: ev.target.value as "program" | "project" | "department" }))}
                            style={formInputStyle}
                          >
                            <option value="program">Program</option>
                            <option value="project">Project</option>
                            <option value="department">Department</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Name *</label>
                          <input
                            value={form.name}
                            onChange={(ev) => setForm((p) => ({ ...p, name: ev.target.value }))}
                            required
                            style={formInputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Code *</label>
                          <input
                            value={form.code}
                            onChange={(ev) => setForm((p) => ({ ...p, code: ev.target.value }))}
                            required
                            style={formInputStyle}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Description</label>
                          <textarea
                            value={form.description}
                            onChange={(ev) => setForm((p) => ({ ...p, description: ev.target.value }))}
                            rows={2}
                            style={formInputStyle}
                          />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button type="submit" style={btnPrimary}>Save</button>
                          <button type="button" onClick={cancelEdit} style={btnSecondary}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem" }}>{typeLabel[u.type]}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem" }}>{u.name}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>{u.code}</td>
                    <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>{u.description ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => startEdit(u)}
                        style={{ ...btnSecondary, padding: "0.25rem 0.5rem", marginRight: "0.5rem" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(u)}
                        style={{ ...btnDanger, padding: "0.25rem 0.5rem" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )
      )}

      {deleting && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setDeleting(null)}
        >
          <div
            style={{
              background: "white",
              padding: "1.5rem",
              borderRadius: 8,
              maxWidth: 400,
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 0.5rem" }}>Delete {typeLabel[deleting.type]}?</h3>
            <p style={{ margin: "0 0 1rem", color: "#6b7280", fontSize: "0.875rem" }}>
              This will permanently delete <strong>{deleting.name}</strong> and all its Risks. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button style={btnSecondary} onClick={() => setDeleting(null)}>Cancel</button>
              <button style={btnDanger} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
