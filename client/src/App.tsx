import { useState, useEffect, useCallback } from "react";
import { Header } from "./components/Header";
import { OrgUnitSelector } from "./components/OrgUnitSelector";
import { RiskFilters, filterRisks, type RiskFiltersState } from "./components/RiskFilters";
import { RiskRegister } from "./components/RiskRegister";
import { RiskMatrix } from "./components/RiskMatrix";
import { RiskDetailView } from "./components/RiskDetailView";
import { OpportunityRegister } from "./components/OpportunityRegister";
import { OpportunityMatrix } from "./components/OpportunityMatrix";
import { OpportunityDetailView } from "./components/OpportunityDetailView";
import { LegalEntityManager } from "./components/LegalEntityManager";
import { OrgUnitManager } from "./components/OrgUnitManager";
import { CategoryManager } from "./components/CategoryManager";
import { OpportunityCategoryManager } from "./components/OpportunityCategoryManager";
import { OpportunityFilters, filterOpportunities, type OpportunityFiltersState } from "./components/OpportunityFilters";
import type { Category, LegalEntity, Opportunity, OpportunityCategory, OrganizationalUnit, Risk } from "./types";

const API = "/api";

type MainTab = "risk_register" | "risk_matrix" | "opportunity_register" | "opportunity_matrix";

export default function App() {
  const [view, setView] = useState<"risks" | "settings">("risks");
  const [mainTab, setMainTab] = useState<MainTab>("risk_register");
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [selectedLegalEntity, setSelectedLegalEntity] = useState<LegalEntity | null>(null);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<OrganizationalUnit | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [filters, setFilters] = useState<RiskFiltersState>({ categories: new Set(), statuses: new Set() });
  const [opportunityFilters, setOpportunityFilters] = useState<OpportunityFiltersState>({ categories: [], statuses: [] });
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [opportunityCategories, setOpportunityCategories] = useState<OpportunityCategory[]>([]);

  const refreshLegalEntities = useCallback(() => {
    fetch(`${API}/legal-entities`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setLegalEntities(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error("Failed to load legal entities:", e);
        setLegalEntities([]);
      });
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

  const refreshOpportunities = useCallback(() => {
    if (!selectedOrgUnit) return;
    setOpportunitiesLoading(true);
    fetch(`${API}/opportunities?organizationalUnitId=${selectedOrgUnit.id}`)
      .then((r) => {
        if (!r.ok) return r.json().then((err) => Promise.reject(new Error(err?.error || `HTTP ${r.status}`)));
        return r.json();
      })
      .then((data) => setOpportunities(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error("Failed to load opportunities:", e);
        setOpportunities([]);
        alert(`Failed to load opportunities: ${e.message}`);
      })
      .finally(() => setOpportunitiesLoading(false));
  }, [selectedOrgUnit?.id]);

  const refreshCategories = useCallback(() => {
    fetch(`${API}/categories`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error("Failed to load categories:", e);
        setCategories([]);
      });
  }, []);

  const refreshOpportunityCategories = useCallback(() => {
    fetch(`${API}/opportunity-categories`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOpportunityCategories(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error("Failed to load opportunity categories:", e);
        setOpportunityCategories([]);
      });
  }, []);

  useEffect(() => {
    refreshLegalEntities();
  }, [refreshLegalEntities]);

  useEffect(() => {
    refreshCategories();
    refreshOpportunityCategories();
  }, [refreshCategories, refreshOpportunityCategories]);

  useEffect(() => {
    if (selectedOrgUnit) {
      refreshRisks();
      refreshOpportunities();
    } else {
      setRisks([]);
      setOpportunities([]);
    }
  }, [selectedOrgUnit, refreshRisks, refreshOpportunities]);

  const handleSelectLegalEntity = (entity: LegalEntity | null) => {
    setSelectedLegalEntity(entity);
    setSelectedOrgUnit(null);
  };

  const handleSelectOrgUnit = (unit: OrganizationalUnit | null) => {
    setSelectedOrgUnit(unit);
  };

  const mainTabs: { id: MainTab; label: string }[] = [
    { id: "risk_register", label: "Risk Register" },
    { id: "risk_matrix", label: "5×5 Risk Matrix" },
    { id: "opportunity_register", label: "Opportunity Register" },
    { id: "opportunity_matrix", label: "5×5 Opportunity Matrix" },
  ];

  const selectedRisk = selectedRiskId ? risks.find((r) => r.id === selectedRiskId) : null;
  const selectedOpportunity = selectedOpportunityId ? opportunities.find((o) => o.id === selectedOpportunityId) : null;
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeOpportunityCategories = Array.isArray(opportunityCategories) ? opportunityCategories : [];

  // Logging for crash debugging (step 1: filters disabled)
  useEffect(() => {
    if (mainTab === "opportunity_register" || mainTab === "opportunity_matrix") {
      console.log("[App] Opportunity tab active", { mainTab, orgUnitId: selectedOrgUnit?.id, opportunitiesCount: opportunities.length, categoriesCount: safeOpportunityCategories.length });
    }
  }, [mainTab, selectedOrgUnit?.id, opportunities.length, safeOpportunityCategories.length]);

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
                {!selectedRisk && !selectedOpportunity && (mainTab === "risk_register" || mainTab === "risk_matrix") && (
                  <section style={{ marginBottom: "1rem" }}>
                    <RiskFilters categories={safeCategories} filters={filters} onChange={setFilters} />
                  </section>
                )}
                {!selectedRisk && !selectedOpportunity && (mainTab === "opportunity_register" || mainTab === "opportunity_matrix") && (
                  <section style={{ marginBottom: "1rem" }} key="opp-filters">
                    <OpportunityFilters categories={safeOpportunityCategories} filters={opportunityFilters} onChange={setOpportunityFilters} />
                  </section>
                )}

                {selectedRisk ? (
                  <RiskDetailView
                    categories={safeCategories}
                    risk={selectedRisk}
                    orgUnit={selectedOrgUnit}
                    onBack={() => setSelectedRiskId(null)}
                    onUpdate={refreshRisks}
                  />
                ) : selectedOpportunity ? (
                  <OpportunityDetailView
                    categories={safeOpportunityCategories}
                    opportunity={selectedOpportunity}
                    orgUnit={selectedOrgUnit}
                    onBack={() => setSelectedOpportunityId(null)}
                    onUpdate={refreshOpportunities}
                  />
                ) : (
                  <>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                      {mainTabs.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setMainTab(t.id)}
                          style={{
                            padding: "0.5rem 1rem",
                            background: mainTab === t.id ? "#2563eb" : "#f3f4f6",
                            color: mainTab === t.id ? "white" : "#374151",
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

                    {mainTab === "risk_register" && (
                      <section>
                        <RiskRegister
                          categories={safeCategories}
                          orgUnit={selectedOrgUnit}
                          risks={filterRisks(risks, filters)}
                          loading={risksLoading}
                          onUpdate={refreshRisks}
                          onSelectRisk={setSelectedRiskId}
                        />
                      </section>
                    )}
                    {mainTab === "risk_matrix" && (
                      <section>
                        <RiskMatrix
                          categories={safeCategories}
                          orgUnit={selectedOrgUnit}
                          risks={filterRisks(risks, filters)}
                          onSelectRisk={setSelectedRiskId}
                        />
                      </section>
                    )}
                    {mainTab === "opportunity_register" && (
                      <section>
                        <OpportunityRegister
                          categories={safeOpportunityCategories}
                          orgUnit={selectedOrgUnit}
                          opportunities={filterOpportunities(opportunities, opportunityFilters)}
                          loading={opportunitiesLoading}
                          onUpdate={refreshOpportunities}
                          onSelectOpportunity={setSelectedOpportunityId}
                        />
                      </section>
                    )}
                    {mainTab === "opportunity_matrix" && (
                      <section>
                        <OpportunityMatrix
                          categories={safeOpportunityCategories}
                          orgUnit={selectedOrgUnit}
                          opportunities={filterOpportunities(opportunities, opportunityFilters)}
                          onSelectOpportunity={setSelectedOpportunityId}
                        />
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {!selectedOrgUnit && selectedLegalEntity && (
              <p style={{ color: "#6b7280", padding: "2rem" }}>
                Select a Program, Project, or Department to view and manage risks and opportunities.
              </p>
            )}

            {!selectedLegalEntity && (
              <p style={{ color: "#6b7280", padding: "2rem" }}>
                Select an Entity to get started.
              </p>
            )}
          </>
        )}

        {view === "settings" && (
          <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <LegalEntityManager onUpdate={refreshLegalEntities} />
            <OrgUnitManager legalEntities={legalEntities} onUpdate={refreshLegalEntities} />
            <div style={{ display: "flex", flexDirection: "row", gap: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <CategoryManager onUpdate={() => { refreshCategories(); refreshRisks(); }} />
              </div>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <OpportunityCategoryManager onUpdate={() => { refreshOpportunityCategories(); refreshOpportunities(); }} />
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
