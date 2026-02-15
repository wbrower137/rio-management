import type { OpportunityCategory } from "../types";

const STATUSES: { value: string; label: string }[] = [
  { value: "pursue_now", label: "Pursue now" },
  { value: "defer", label: "Defer" },
  { value: "reevaluate", label: "Reevaluate" },
  { value: "reject", label: "Reject" },
];

export interface OpportunityFiltersState {
  categories: string[];
  statuses: string[];
}

interface OpportunityFiltersProps {
  categories: OpportunityCategory[];
  filters: OpportunityFiltersState;
  onChange: (filters: OpportunityFiltersState) => void;
}

const checkboxStyle = { margin: 0, cursor: "pointer" as const };
const labelStyle = { fontSize: "0.8rem", cursor: "pointer" as const, marginRight: "0.75rem" };

export function OpportunityFilters({ categories = [], filters, onChange }: OpportunityFiltersProps) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const categoryOptions = safeCategories.map((c) => ({ value: c.code, label: c.label }));
  const cats = Array.isArray(filters?.categories) ? filters.categories : [];
  const sts = Array.isArray(filters?.statuses) ? filters.statuses : [];

  const toggleCategory = (cat: string) => {
    const next = cats.includes(cat) ? cats.filter((x) => x !== cat) : [...cats, cat];
    onChange({ ...filters, categories: next, statuses: sts });
  };

  const toggleStatus = (status: string) => {
    const next = sts.includes(status) ? sts.filter((x) => x !== status) : [...sts, status];
    onChange({ ...filters, categories: cats, statuses: next });
  };

  const clearAll = () => onChange({ categories: [], statuses: [] });

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
          <label key={String(c.value) || "cat"} style={labelStyle}>
            <input type="checkbox" checked={cats.includes(c.value)} onChange={() => toggleCategory(c.value)} style={checkboxStyle} />
            {" "}{c.label}
          </label>
        ))}
      </div>
      <div style={rowStyle}>
        <span style={labelStyleInner}>Status:</span>
        {STATUSES.map((s) => (
          <label key={s.value} style={labelStyle}>
            <input type="checkbox" checked={sts.includes(s.value)} onChange={() => toggleStatus(s.value)} style={checkboxStyle} />
            {" "}{s.label}
          </label>
        ))}
        {(cats.length > 0 || sts.length > 0) && (
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

export function filterOpportunities<T extends { category?: string | null; status?: string }>(
  opportunities: T[] | null | undefined,
  filters: OpportunityFiltersState | null | undefined
): T[] {
  const list = Array.isArray(opportunities) ? opportunities : [];
  const cats = Array.isArray(filters?.categories) ? filters.categories : [];
  const sts = Array.isArray(filters?.statuses) ? filters.statuses : [];
  if (cats.length === 0 && sts.length === 0) return list;
  return list.filter((o) => {
    const categoryOk = cats.length === 0 || (o.category != null && cats.includes(o.category));
    const statusOk = sts.length === 0 || sts.includes(o.status ?? "");
    return categoryOk && statusOk;
  });
}
