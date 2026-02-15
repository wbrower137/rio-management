import type { Category, RiskCategory } from "../types";

const STATUSES: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "mitigating", label: "Mitigating" },
  { value: "accepted", label: "Accepted" },
  { value: "closed", label: "Closed" },
];

export interface RiskFiltersState {
  categories: Set<RiskCategory>;
  statuses: Set<string>;
}

interface RiskFiltersProps {
  categories: Category[];
  filters: RiskFiltersState;
  onChange: (filters: RiskFiltersState) => void;
}

const checkboxStyle = { margin: 0, cursor: "pointer" as const };
const labelStyle = { fontSize: "0.8rem", cursor: "pointer" as const, marginRight: "0.75rem" };

export function RiskFilters({ categories, filters, onChange }: RiskFiltersProps) {
  const categoryOptions = categories.map((c) => ({ value: c.code as RiskCategory, label: c.label }));
  const toggleCategory = (cat: RiskCategory) => {
    const next = new Set(filters.categories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onChange({ ...filters, categories: next });
  };

  const toggleStatus = (status: string) => {
    const next = new Set(filters.statuses);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onChange({ ...filters, statuses: next });
  };

  const clearAll = () => onChange({ categories: new Set(), statuses: new Set() });

  const rowStyle = { display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: "0.25rem 0.5rem" };
  const labelStyleInner = { fontSize: "0.75rem", color: "#374151", marginRight: "0.5rem", fontWeight: 700, minWidth: 60 };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "0.75rem 1rem",
        background: "#f9fafb",
        borderRadius: 8,
        border: "1px solid #e5e7eb",
      }}
    >
      <div style={rowStyle}>
        <span style={labelStyleInner}>Category:</span>
        {categoryOptions.map((c) => (
          <label key={c.value} style={labelStyle}>
            <input type="checkbox" checked={filters.categories.has(c.value)} onChange={() => toggleCategory(c.value)} style={checkboxStyle} />
            {" "}{c.label}
          </label>
        ))}
      </div>
      <div style={rowStyle}>
        <span style={labelStyleInner}>Status:</span>
        {STATUSES.map((s) => (
          <label key={s.value} style={labelStyle}>
            <input type="checkbox" checked={filters.statuses.has(s.value)} onChange={() => toggleStatus(s.value)} style={checkboxStyle} />
            {" "}{s.label}
          </label>
        ))}
        {(filters.categories.size > 0 || filters.statuses.size > 0) && (
          <button
            type="button"
            onClick={clearAll}
            style={{ marginLeft: "auto", fontSize: "0.75rem", padding: "0.25rem 0.5rem", border: "1px solid #d1d5db", background: "white", borderRadius: 4, cursor: "pointer", color: "#6b7280" }}
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

export function filterRisks<T extends { category?: RiskCategory | null; status?: string }>(
  risks: T[],
  filters: RiskFiltersState
): T[] {
  return risks.filter((r) => {
    const categoryOk = filters.categories.size === 0 || (r.category != null && filters.categories.has(r.category));
    const statusOk = filters.statuses.size === 0 || filters.statuses.has(r.status ?? "");
    return categoryOk && statusOk;
  });
}
