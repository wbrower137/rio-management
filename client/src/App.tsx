import { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { OrgUnitSelector } from "./components/OrgUnitSelector";
import { RiskFilters, filterRisks, type RiskFiltersState } from "./components/RiskFilters";
import { RiskRegister } from "./components/RiskRegister";
import { RiskMatrix } from "./components/RiskMatrix";
import { RiskDetailView } from "./components/RiskDetailView";
import { LegalEntityManager } from "./components/LegalEntityManager";
import { OrgUnitManager } from "./components/OrgUnitManager";
import type { LegalEntity, OrganizationalUnit, Risk } from "./types";

const API = "/api";

type RiskTab = "register" | "matrix";

export default function App() {
  const [view, setView] = useState<"risks" | "settings">("risks");
  const [riskTab, setRiskTab] = useState<RiskTab>("register");
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [selectedLegalEntity, setSelectedLegalEntity] = useState<LegalEntity | null>(null);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<OrganizationalUnit | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);
  const [filters, setFilters] = useState<RiskFiltersState>({ categories: new Set(), statuses: new Set() });
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  const refreshLegalEntities = useCallback(() => {
    fetch(`${API}/legal-entities`)
      .then((r) => r.json())
      .then(setLegalEntities)
      .catch((e) => console.error("Failed to load legal entities:", e));
  }, []);

  const refreshRisks = useCallback(() => {
    if (!selectedOrgUnit) return;
    setRisksLoading(true);
    fetch(`${API}/risks?organizationalUnitId=${selectedOrgUnit.id}`)
      .then((r) => {
        if (!r.ok) return r.json().then((err) => Promise.reject(new Error(err?.error || `HTTP ${r.status}`)));
        return r.json();
      })
      .then((data) => setRisks(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error("Failed to load risks:", e);
        setRisks([]);
        alert(`Failed to load risks: ${e.message}`);
      })
      .finally(() => setRisksLoading(false));
  }, [selectedOrgUnit?.id]);

  useEffect(() => {
    refreshLegalEntities();
  }, [refreshLegalEntities]);

  useEffect(() => {
    if (selectedOrgUnit) refreshRisks();
    else setRisks([]);
  }, [selectedOrgUnit, refreshRisks]);

  const handleSelectLegalEntity = (entity: LegalEntity | null) => {
    setSelectedLegalEntity(entity);
    setSelectedOrgUnit(null);
  };

  const handleSelectOrgUnit = (unit: OrganizationalUnit | null) => {
    setSelectedOrgUnit(unit);
  };

  const riskTabs: { id: RiskTab; label: string }[] = [
    { id: "register", label: "Risk Register" },
    { id: "matrix", label: "5×5 Matrix" },
  ];

  const selectedRisk = selectedRiskId ? risks.find((r) => r.id === selectedRiskId) : null;

  return (
    <>
      <Header view={view} onViewChange={setView} />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "1.5rem 1rem" }}>
        {view === "risks" && (
          <>
            <section style={{ marginBottom: "1.5rem" }}>
              <h2 style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
                Scope
              </h2>
              <OrgUnitSelector
                legalEntities={legalEntities}
                selectedLegalEntity={selectedLegalEntity}
                selectedOrgUnit={selectedOrgUnit}
                onSelectLegalEntity={handleSelectLegalEntity}
                onSelectOrgUnit={handleSelectOrgUnit}
              />
            </section>

            {selectedOrgUnit && (
              <>
                {!selectedRisk && (
                  <section style={{ marginBottom: "1rem" }}>
                    <RiskFilters filters={filters} onChange={setFilters} />
                  </section>
                )}

                {selectedRisk ? (
                  <RiskDetailView
                    risk={selectedRisk}
                    orgUnit={selectedOrgUnit}
                    onBack={() => setSelectedRiskId(null)}
                    onUpdate={refreshRisks}
                  />
                ) : (
                  <>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                      {riskTabs.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setRiskTab(t.id)}
                          style={{
                            padding: "0.5rem 1rem",
                            background: riskTab === t.id ? "#2563eb" : "#f3f4f6",
                            color: riskTab === t.id ? "white" : "#374151",
                            border: "none",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: "0.875rem",
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {riskTab === "register" && (
                      <section>
                        <RiskRegister
                          orgUnit={selectedOrgUnit}
                          risks={filterRisks(risks, filters)}
                          loading={risksLoading}
                          onUpdate={refreshRisks}
                          onSelectRisk={setSelectedRiskId}
                        />
                      </section>
                    )}
                    {riskTab === "matrix" && (
                      <section>
                        <RiskMatrix
                          orgUnit={selectedOrgUnit}
                          risks={filterRisks(risks, filters)}
                          onSelectRisk={setSelectedRiskId}
                        />
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {!selectedOrgUnit && selectedLegalEntity && (
              <p style={{ color: "#6b7280", padding: "2rem" }}>
                Select a Program, Project, or Department to view and manage risks.
              </p>
            )}

            {!selectedLegalEntity && (
              <p style={{ color: "#6b7280", padding: "2rem" }}>
                Select a Legal Entity to get started.
              </p>
            )}
          </>
        )}

        {view === "settings" && (
          <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <LegalEntityManager onUpdate={refreshLegalEntities} />
            <OrgUnitManager legalEntities={legalEntities} onUpdate={refreshLegalEntities} />
          </section>
        )}
      </main>
    </>
  );
}
