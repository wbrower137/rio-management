import { useState, useEffect } from "react";
import type { LegalEntity } from "../types";

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

export function LegalEntityManager({ onUpdate }: { onUpdate?: () => void }) {
  const [entities, setEntities] = useState<LegalEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<LegalEntity | null>(null);
  const [deleting, setDeleting] = useState<LegalEntity | null>(null);
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  const load = () => {
    setLoading(true);
    fetch(`${API}/legal-entities`)
      .then((r) => r.json())
      .then(setEntities)
      .catch((e) => console.error("Failed to load legal entities:", e))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/legal-entities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then(() => {
        setShowAddForm(false);
        setForm({ name: "", code: "", description: "" });
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to add legal entity:", e));
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    fetch(`${API}/legal-entities/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
      .then((r) => r.json())
      .then(() => {
        setEditing(null);
        setForm({ name: "", code: "", description: "" });
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to update legal entity:", e));
  };

  const handleDelete = () => {
    if (!deleting) return;
    fetch(`${API}/legal-entities/${deleting.id}`, { method: "DELETE" })
      .then(() => {
        setDeleting(null);
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to delete legal entity:", e));
  };

  const startEdit = (e: LegalEntity) => {
    setEditing(e);
    setForm({ name: e.name, code: e.code, description: e.description ?? "" });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: "", code: "", description: "" });
  };

  return (
    <section style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7eb" }}>
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>Legal Entities</h2>
        <button style={btnPrimary} onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "+ Add Legal Entity"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          style={{ padding: "1.5rem", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}
        >
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>New Legal Entity</h3>
          <div style={{ display: "grid", gap: "1rem", maxWidth: 400 }}>
            <div>
              <label style={labelStyle}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                style={formInputStyle}
                placeholder="e.g. Company A"
              />
            </div>
            <div>
              <label style={labelStyle}>Code *</label>
              <input
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                required
                style={formInputStyle}
                placeholder="e.g. COMPANY-A"
              />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                style={formInputStyle}
                placeholder="Optional"
              />
            </div>
            <button type="submit" style={btnPrimary}>Add</button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ padding: "2rem", color: "#6b7280" }}>Loading...</p>
      ) : entities.length === 0 ? (
        <p style={{ padding: "2rem", color: "#6b7280" }}>No legal entities yet. Add one above.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#6b7280" }}>Name</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#6b7280" }}>Code</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.75rem", color: "#6b7280" }}>Description</th>
              <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "#6b7280" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((e) =>
              editing?.id === e.id ? (
                <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6", background: "#fffbeb" }}>
                  <td colSpan={4} style={{ padding: "1rem" }}>
                    <form onSubmit={handleEdit} style={{ display: "grid", gap: "1rem", maxWidth: 500 }}>
                      <h4 style={{ margin: "0 0 0.5rem" }}>Edit Legal Entity</h4>
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
                <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem" }}>{e.name}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>{e.code}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.875rem", color: "#6b7280" }}>{e.description ?? "—"}</td>
                  <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => startEdit(e)}
                      style={{ ...btnSecondary, padding: "0.25rem 0.5rem", marginRight: "0.5rem" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(e)}
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
            <h3 style={{ margin: "0 0 0.5rem" }}>Delete Legal Entity?</h3>
            <p style={{ margin: "0 0 1rem", color: "#6b7280", fontSize: "0.875rem" }}>
              This will permanently delete <strong>{deleting.name}</strong> and all its Programs, Projects, Departments, and their Risks. This cannot be undone.
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
