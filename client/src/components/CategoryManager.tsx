import { useState, useEffect } from "react";
import type { Category } from "../types";

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

interface BlockedDeleteState {
  category: Category;
  risks: { id: string; riskName: string; organizationalUnitId: string }[];
}

export function CategoryManager({ onUpdate }: { onUpdate?: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [blockedDelete, setBlockedDelete] = useState<BlockedDeleteState | null>(null);
  const [reassignTo, setReassignTo] = useState<string>(""); // "" = clear (null)
  const [reassigning, setReassigning] = useState(false);
  const [addForm, setAddForm] = useState({ code: "", label: "" });
  const [editForm, setEditForm] = useState({ label: "" });

  const load = () => {
    setLoading(true);
    fetch(`${API}/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch((e) => console.error("Failed to load categories:", e))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: addForm.code.trim() || undefined, label: addForm.label.trim() || addForm.code.trim() }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((err) => Promise.reject(new Error(err?.error ?? "Failed to add")));
        return r.json();
      })
      .then(() => {
        setShowAddForm(false);
        setAddForm({ code: "", label: "" });
        load();
        onUpdate?.();
      })
      .catch((e) => {
        console.error(e);
        alert(e.message || "Failed to add category");
      });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    fetch(`${API}/categories/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editForm.label.trim() }),
    })
      .then((r) => r.json())
      .then(() => {
        setEditing(null);
        setEditForm({ label: "" });
        load();
        onUpdate?.();
      })
      .catch((e) => console.error("Failed to update category:", e));
  };

  const handleDelete = (cat: Category) => {
    fetch(`${API}/categories/${cat.id}`, { method: "DELETE" })
      .then((res) => {
        if (res.status === 204) {
          load();
          onUpdate?.();
          return;
        }
        if (res.status === 400) {
          return res.json().then((body: { risks?: BlockedDeleteState["risks"] }) => {
            if (body.risks && body.risks.length > 0) {
              setBlockedDelete({ category: cat, risks: body.risks });
            }
          });
        }
        return res.json().then((err) => Promise.reject(new Error(err?.error ?? "Delete failed")));
      })
      .catch((e) => {
        console.error(e);
        alert(e.message || "Failed to delete category");
      });
  };

  const otherCategories = categories.filter((c) => c.id !== blockedDelete?.category.id);
  const handleReassignAll = () => {
    if (!blockedDelete) return;
    setReassigning(true);
    const value = reassignTo === "" ? null : reassignTo;
    const catToDelete = blockedDelete.category;
    Promise.all(
      blockedDelete.risks.map((r) =>
        fetch(`${API}/risks/${r.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: value }),
        })
      )
    )
      .then((results) => {
        const failed = results.filter((r) => !r.ok);
        if (failed.length > 0) {
          alert(`Failed to update ${failed.length} risk(s).`);
          return;
        }
        setBlockedDelete(null);
        setReassignTo("");
        return fetch(`${API}/categories/${catToDelete.id}`, { method: "DELETE" });
      })
      .then((delRes) => {
        if (delRes?.status === 204) {
          load();
          onUpdate?.();
        }
      })
      .catch((e) => {
        console.error(e);
        alert(e.message || "Failed to reassign");
      })
      .finally(() => setReassigning(false));
  };

  const closeBlockedModal = () => {
    setBlockedDelete(null);
    setReassignTo("");
  };

  return (
    <section style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Risk Categories</h3>
        {!showAddForm && (
          <button type="button" onClick={() => setShowAddForm(true)} style={btnPrimary}>
            Add category
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          <div style={{ minWidth: 120 }}>
            <label style={labelStyle}>Code (e.g. technical)</label>
            <input
              type="text"
              value={addForm.code}
              onChange={(e) => setAddForm((p) => ({ ...p, code: e.target.value }))}
              placeholder="technical"
              style={formInputStyle}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <label style={labelStyle}>Label (e.g. Technical)</label>
            <input
              type="text"
              value={addForm.label}
              onChange={(e) => setAddForm((p) => ({ ...p, label: e.target.value }))}
              placeholder="Technical"
              style={formInputStyle}
            />
          </div>
          <button type="submit" style={btnPrimary}>Add</button>
          <button type="button" onClick={() => { setShowAddForm(false); setAddForm({ code: "", label: "" }); }} style={btnSecondary}>Cancel</button>
        </form>
      )}

      {loading ? (
        <p style={{ padding: "1rem", color: "#6b7280" }}>Loading categories...</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>Label</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "left", fontWeight: 600, color: "#6b7280" }}>Code</th>
                <th style={{ padding: "0.75rem 1rem", textAlign: "right", fontWeight: 600, color: "#6b7280" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) =>
                editing?.id === c.id ? (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6", background: "#fffbeb" }}>
                    <td colSpan={3} style={{ padding: "1rem" }}>
                      <form onSubmit={handleEdit} style={{ display: "flex", gap: "1rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                        <span style={{ color: "#6b7280" }}>Code: <strong>{c.code}</strong></span>
                        <div style={{ minWidth: 160 }}>
                          <label style={labelStyle}>Label</label>
                          <input
                            type="text"
                            value={editForm.label}
                            onChange={(e) => setEditForm({ label: e.target.value })}
                            style={formInputStyle}
                          />
                        </div>
                        <button type="submit" style={btnPrimary}>Save</button>
                        <button type="button" onClick={() => { setEditing(null); setEditForm({ label: "" }); }} style={btnSecondary}>Cancel</button>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem 1rem" }}>{c.label}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>{c.code}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right" }}>
                      <button type="button" onClick={() => { setEditing(c); setEditForm({ label: c.label }); }} style={{ ...btnSecondary, padding: "0.25rem 0.5rem", fontSize: "0.75rem", marginRight: "0.5rem" }}>Edit</button>
                      <button type="button" onClick={() => handleDelete(c)} style={{ ...btnDanger, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>Delete</button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {blockedDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={closeBlockedModal}>
          <div style={{ background: "white", borderRadius: 8, padding: "1.5rem", maxWidth: 520, width: "90%", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ margin: "0 0 0.5rem" }}>Cannot delete &quot;{blockedDelete.category.label}&quot;</h4>
            <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#6b7280" }}>
              The following {blockedDelete.risks.length} risk(s) use this category. Reassign or clear their category first.
            </p>
            <ul style={{ margin: "0 0 1rem", paddingLeft: "1.25rem", fontSize: "0.875rem", maxHeight: 200, overflow: "auto" }}>
              {blockedDelete.risks.map((r) => (
                <li key={r.id} style={{ marginBottom: "0.25rem" }}>{r.riskName || r.id}</li>
              ))}
            </ul>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <label style={{ fontSize: "0.875rem" }}>Reassign all to:</label>
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                style={{ ...formInputStyle, width: "auto", minWidth: 140 }}
              >
                <option value="">— Clear (no category)</option>
                {otherCategories.map((c) => (
                  <option key={c.id} value={c.code}>{c.label}</option>
                ))}
              </select>
              <button type="button" onClick={handleReassignAll} disabled={reassigning} style={btnPrimary}>
                {reassigning ? "Updating…" : "Apply & delete category"}
              </button>
              <button type="button" onClick={closeBlockedModal} style={btnSecondary}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
