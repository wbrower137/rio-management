import { useMemo, useState } from "react";
import type { Category, Issue, OrganizationalUnit } from "../types";

const API = "/api";

interface IssueRegisterProps {
  categories: Category[];
  orgUnit: OrganizationalUnit;
  issues: Issue[];
  loading: boolean;
  onUpdate: () => void;
  onSelectIssue?: (id: string) => void;
}

// Color by numerical level (8, 16, 20, 23, 25) — matches 1×5 Issue Matrix
function getLevelColor(numericalLevel: number): string {
  return numericalLevel === 8 ? "#eab308" : "#ef4444"; // 8 = yellow, 16–25 = red
}

const STATUS_LABELS: Record<string, string> = {
  ignore: "Ignore",
  control: "Control",
};

const typeLabel: Record<string, string> = {
  program: "Program",
  project: "Project",
  department: "Department",
};

const formInputStyle = { width: "100%" as const, padding: "0.5rem", borderRadius: 6, border: "1px solid #d1d5db" };
const labelStyle = { display: "block" as const, fontSize: "0.75rem", marginBottom: "0.25rem" };
const btnPrimary = { padding: "0.5rem 1rem", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer" as const };
const btnSecondary = { ...btnPrimary, background: "#6b7280" };

// Consequence 1-5 -> 8, 16, 20, 23, 25 for waterfall ordering
const NUMERICAL_ISSUE_LEVEL: Record<number, number> = { 1: 8, 2: 16, 3: 20, 4: 23, 5: 25 };
function getNumericalIssueLevel(consequence: number): number {
  return NUMERICAL_ISSUE_LEVEL[Math.max(1, Math.min(5, consequence))] ?? 20;
}

export type IssueRegisterSortKey = "issueName" | "category" | "consequence" | "issueLevel" | "status" | "owner" | "lastUpdated";

export function IssueRegister({ categories = [], orgUnit, issues = [], loading, onUpdate, onSelectIssue }: IssueRegisterProps) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeIssues = Array.isArray(issues) ? issues : [];
  const categoryOptions = safeCategories.map((c) => ({ value: c.code, label: c.label }));
  const [showAddForm, setShowAddForm] = useState(false);
  const [editing, setEditing] = useState<Issue | null>(null);
  const [sortBy, setSortBy] = useState<IssueRegisterSortKey>("issueName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: IssueRegisterSortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const sortedIssues = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...safeIssues].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "issueName":
          cmp = (a.issueName ?? "").localeCompare(b.issueName ?? "", undefined, { sensitivity: "base" });
          break;
        case "category": {
          const labelA = categoryOptions.find((c) => c.value === a.category)?.label ?? a.category ?? "";
          const labelB = categoryOptions.find((c) => c.value === b.category)?.label ?? b.category ?? "";
          cmp = labelA.localeCompare(labelB, undefined, { sensitivity: "base" });
          break;
        }
        case "consequence":
          cmp = a.consequence - b.consequence;
          break;
        case "issueLevel":
          cmp = getNumericalIssueLevel(a.consequence) - getNumericalIssueLevel(b.consequence);
          break;
        case "status":
          cmp = (a.status ?? "").localeCompare(b.status ?? "", undefined, { sensitivity: "base" });
          break;
        case "owner":
          cmp = (a.owner ?? "").localeCompare(b.owner ?? "", undefined, { sensitivity: "base" });
          break;
        case "lastUpdated": {
          const dateA = new Date(a.lastUpdated ?? a.updatedAt ?? 0).getTime();
          const dateB = new Date(b.lastUpdated ?? b.updatedAt ?? 0).getTime();
          cmp = dateA - dateB;
          break;
        }
        default:
          break;
      }
      return cmp * dir;
    });
  }, [safeIssues, sortBy, sortDir, categoryOptions]);

  const [newIssue, setNewIssue] = useState({
    issueName: "",
    description: "",
    consequence: 3,
    category: "",
    status: "control" as "ignore" | "control",
    owner: "",
  });
  const [editForm, setEditForm] = useState({
    issueName: "",
    description: "",
    consequence: 3,
    category: "",
    status: "control" as "ignore" | "control",
    owner: "",
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationalUnitId: orgUnit.id,
        issueName: newIssue.issueName.trim(),
        description: newIssue.description.trim() || null,
        consequence: newIssue.consequence,
        category: newIssue.category || null,
        status: newIssue.status,
        owner: newIssue.owner.trim() || null,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setShowAddForm(false);
        setNewIssue({ issueName: "", description: "", consequence: 3, category: "", status: "control", owner: "" });
        onUpdate();
      })
      .catch((e) => console.error("Failed to add issue:", e));
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    fetch(`${API}/issues/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issueName: editForm.issueName.trim(),
        description: editForm.description.trim() || null,
        consequence: editForm.consequence,
        category: editForm.category || null,
        status: editForm.status,
        owner: editForm.owner.trim() || null,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setEditing(null);
        onUpdate();
      })
      .catch((e) => console.error("Failed to update issue:", e));
  };

  const startEdit = (i: Issue) => {
    setEditing(i);
    setEditForm({
      issueName: i.issueName ?? "",
      description: i.description ?? "",
      consequence: i.consequence,
      category: i.category ?? "",
      status: i.status ?? "control",
      owner: i.owner ?? "",
    });
  };

  const cancelEdit = () => setEditing(null);

  const cols: { key: IssueRegisterSortKey; label: string; align: "left" | "center" | "right" }[] = [
    { key: "issueName", label: "Issue Name", align: "left" },
    { key: "category", label: "Category", align: "left" },
    { key: "consequence", label: "C", align: "center" },
    { key: "issueLevel", label: "Level", align: "left" },
    { key: "status", label: "Status", align: "left" },
    { key: "owner", label: "Owner", align: "left" },
    { key: "lastUpdated", label: "Last Updated", align: "right" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
          Issue Register — {typeLabel[orgUnit.type]} {orgUnit.name}
        </h2>
        <button onClick={() => setShowAddForm(!showAddForm)} style={btnPrimary}>
          {showAddForm ? "Cancel" : "+ Add Issue"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          style={{ background: "white", padding: "1.5rem", borderRadius: 8, marginBottom: "1rem", border: "1px solid #e5e7eb" }}
        >
          <h3 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>New Issue</h3>
          <div style={{ display: "grid", gap: "1rem", maxWidth: 600 }}>
            <div>
              <label style={labelStyle}>Issue Name *</label>
              <input type="text" value={newIssue.issueName} onChange={(e) => setNewIssue((p) => ({ ...p, issueName: e.target.value }))} required placeholder="e.g. Delayed delivery" style={formInputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={newIssue.description} onChange={(e) => setNewIssue((p) => ({ ...p, description: e.target.value }))} rows={2} style={formInputStyle} placeholder="Describe the issue" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={newIssue.category} onChange={(e) => setNewIssue((p) => ({ ...p, category: e.target.value }))} style={formInputStyle}>
                  <option value="">—</option>
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Consequence (1-5)</label>
                <input type="number" min={1} max={5} value={newIssue.consequence} onChange={(e) => setNewIssue((p) => ({ ...p, consequence: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={newIssue.status} onChange={(e) => setNewIssue((p) => ({ ...p, status: e.target.value as "ignore" | "control" }))} style={formInputStyle}>
                  <option value="control">Control</option>
                  <option value="ignore">Ignore</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Owner</label>
              <input value={newIssue.owner} onChange={(e) => setNewIssue((p) => ({ ...p, owner: e.target.value }))} placeholder="Name or role" style={formInputStyle} />
            </div>
            <button type="submit" style={btnPrimary}>Add Issue</button>
          </div>
        </form>
      )}

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading issues...</p>
      ) : safeIssues.length === 0 ? (
        <div style={{ background: "white", padding: "2rem", borderRadius: 8, border: "1px solid #e5e7eb", color: "#6b7280", textAlign: "center" }}>
          No issues yet. Add one to get started.
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {cols.map(({ key, label, align }) => (
                  <th
                    key={key}
                    style={{ padding: "0.75rem 1rem", textAlign: align, fontSize: "0.75rem", color: "#6b7280", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    onClick={() => handleSort(key)}
                    title={`Sort by ${label}`}
                  >
                    {label}
                    {sortBy === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedIssues.map((i) =>
                editing?.id === i.id ? (
                  <tr key={i.id} style={{ borderBottom: "1px solid #f3f4f6", background: "#fffbeb" }}>
                    <td colSpan={7} style={{ padding: "1rem" }}>
                      <form onSubmit={handleEdit} style={{ display: "grid", gap: "1rem", maxWidth: 600 }}>
                        <h4 style={{ margin: "0 0 0.5rem" }}>Edit Issue</h4>
                        <div>
                          <label style={labelStyle}>Issue Name *</label>
                          <input type="text" value={editForm.issueName} onChange={(e) => setEditForm((p) => ({ ...p, issueName: e.target.value }))} required style={formInputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>Description</label>
                          <textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={2} style={formInputStyle} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
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
                            <label style={labelStyle}>Consequence (1-5)</label>
                            <input type="number" min={1} max={5} value={editForm.consequence} onChange={(e) => setEditForm((p) => ({ ...p, consequence: parseInt(e.target.value) || 1 }))} style={formInputStyle} />
                          </div>
                          <div>
                            <label style={labelStyle}>Status</label>
                            <select value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as "ignore" | "control" }))} style={formInputStyle}>
                              <option value="control">Control</option>
                              <option value="ignore">Ignore</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={labelStyle}>Owner</label>
                          <input value={editForm.owner} onChange={(e) => setEditForm((p) => ({ ...p, owner: e.target.value }))} style={formInputStyle} />
                        </div>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button type="submit" style={btnPrimary}>Save</button>
                          <button type="button" onClick={cancelEdit} style={btnSecondary}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={i.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <button
                        type="button"
                        onClick={() => (onSelectIssue ? onSelectIssue(i.id) : startEdit(i))}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#2563eb", textDecoration: "underline", fontSize: "inherit" }}
                      >
                        {i.issueName}
                      </button>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>{categoryOptions.find((c) => c.value === i.category)?.label ?? i.category ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "center" }}>{i.consequence}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ display: "inline-block", padding: "0.15rem 0.5rem", borderRadius: 4, background: `${getLevelColor(getNumericalIssueLevel(i.consequence))}33`, color: "#374151", fontSize: "0.75rem" }}>
                        {["Minimal", "Minor", "Moderate", "Significant", "Severe"][Math.max(0, Math.min(4, i.consequence - 1))]}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>{STATUS_LABELS[i.status ?? "control"]}</td>
                    <td style={{ padding: "0.75rem 1rem" }}>{i.owner ?? "—"}</td>
                    <td style={{ padding: "0.75rem 1rem", textAlign: "right", fontSize: "0.75rem", color: "#6b7280" }}>
                      {new Date(i.lastUpdated ?? i.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
