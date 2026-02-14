import type { LegalEntity, OrganizationalUnit } from "../types";

interface OrgUnitSelectorProps {
  legalEntities: LegalEntity[];
  selectedLegalEntity: LegalEntity | null;
  selectedOrgUnit: OrganizationalUnit | null;
  onSelectLegalEntity: (e: LegalEntity | null) => void;
  onSelectOrgUnit: (u: OrganizationalUnit | null) => void;
}

const typeLabel: Record<string, string> = {
  program: "Program",
  project: "Project",
  department: "Department",
};

export function OrgUnitSelector({
  legalEntities,
  selectedLegalEntity,
  selectedOrgUnit,
  onSelectLegalEntity,
  onSelectOrgUnit,
}: OrgUnitSelectorProps) {
  const orgUnits = selectedLegalEntity?.organizationalUnits ?? [];

  return (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
      <div>
        <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
          Legal Entity
        </label>
        <select
          value={selectedLegalEntity?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            const entity = legalEntities.find((l) => l.id === id) ?? null;
            onSelectLegalEntity(entity);
          }}
          style={{
            padding: "0.5rem 2rem 0.5rem 0.75rem",
            fontSize: "1rem",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            minWidth: 200,
          }}
        >
          <option value="">— Select —</option>
          {legalEntities.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
          Program / Project / Department
        </label>
        <select
          value={selectedOrgUnit?.id ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            const unit = orgUnits.find((u) => u.id === id) ?? null;
            onSelectOrgUnit(unit);
          }}
          disabled={!selectedLegalEntity}
          style={{
            padding: "0.5rem 2rem 0.5rem 0.75rem",
            fontSize: "1rem",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            minWidth: 260,
            opacity: selectedLegalEntity ? 1 : 0.6,
          }}
        >
          <option value="">— Select —</option>
          {orgUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {typeLabel[u.type]}: {u.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
