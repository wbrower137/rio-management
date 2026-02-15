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
import { IssueFilters, filterIssues, type IssueFiltersState } from "./components/IssueFilters";
import { IssueRegister } from "./components/IssueRegister";
import { IssueMatrix } from "./components/IssueMatrix";
import { IssueDetailView } from "./components/IssueDetailView";
import type { Category, Issue, LegalEntity, Opportunity, OpportunityCategory, OrganizationalUnit, Risk } from "./types";

const API = "/api";

type MainTab = "risk_register" | "risk_matrix" | "opportunity_register" | "opportunity_matrix" | "issue_register" | "issue_matrix";

export default function App() {
  const [view, setView] = useState<"risks" | "help" | "settings">("risks");
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
  const [issueFilters, setIssueFilters] = useState<IssueFiltersState>({ categories: [], statuses: [] });
  const [issues, setIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
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

  const refreshIssues = useCallback(() => {
    if (!selectedOrgUnit) return;
    setIssuesLoading(true);
    fetch(`${API}/issues?organizationalUnitId=${selectedOrgUnit.id}`)
      .then((r) => {
        if (!r.ok) return r.json().then((err) => Promise.reject(new Error(err?.error || `HTTP ${r.status}`)));
        return r.json();
      })
      .then((data) => setIssues(Array.isArray(data) ? data : []))
      .catch((e) => {
        console.error("Failed to load issues:", e);
        setIssues([]);
        alert(`Failed to load issues: ${e.message}`);
      })
      .finally(() => setIssuesLoading(false));
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
      refreshIssues();
    } else {
      setRisks([]);
      setOpportunities([]);
      setIssues([]);
    }
    setSelectedIssueId(null);
  }, [selectedOrgUnit, refreshRisks, refreshOpportunities, refreshIssues]);

  const handleSelectLegalEntity = (entity: LegalEntity | null) => {
    setSelectedLegalEntity(entity);
    setSelectedOrgUnit(null);
  };

  const handleSelectOrgUnit = (unit: OrganizationalUnit | null) => {
    setSelectedOrgUnit(unit);
  };

  const tabGroups: { groupLabel: string; theme: { bg: string; border: string; accent: string }; tabs: { id: MainTab; label: string }[] }[] = [
    { groupLabel: "Risk", theme: { bg: "#fffbeb", border: "#d97706", accent: "#d97706" }, tabs: [{ id: "risk_register", label: "Risk Register" }, { id: "risk_matrix", label: "5×5 Risk Matrix" }] },
    { groupLabel: "Issues", theme: { bg: "#fef2f2", border: "#dc2626", accent: "#dc2626" }, tabs: [{ id: "issue_register", label: "Issue Register" }, { id: "issue_matrix", label: "1×5 Issue Matrix" }] },
    { groupLabel: "Opportunity", theme: { bg: "#eff6ff", border: "#2563eb", accent: "#2563eb" }, tabs: [{ id: "opportunity_register", label: "Opportunity Register" }, { id: "opportunity_matrix", label: "5×5 Opportunity Matrix" }] },
  ];

  const selectedRisk = selectedRiskId ? risks.find((r) => r.id === selectedRiskId) : null;
  const selectedOpportunity = selectedOpportunityId ? opportunities.find((o) => o.id === selectedOpportunityId) : null;
  const selectedIssue = selectedIssueId ? issues.find((i) => i.id === selectedIssueId) : null;
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeOpportunityCategories = Array.isArray(opportunityCategories) ? opportunityCategories : [];

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
                {!selectedRisk && !selectedOpportunity && !selectedIssue && (mainTab === "risk_register" || mainTab === "risk_matrix") && (
                  <section style={{ marginBottom: "1rem" }}>
                    <RiskFilters categories={safeCategories} filters={filters} onChange={setFilters} />
                  </section>
                )}
                {!selectedRisk && !selectedOpportunity && !selectedIssue && (mainTab === "opportunity_register" || mainTab === "opportunity_matrix") && (
                  <section style={{ marginBottom: "1rem" }} key="opp-filters">
                    <OpportunityFilters categories={safeOpportunityCategories} filters={opportunityFilters} onChange={setOpportunityFilters} />
                  </section>
                )}
                {!selectedRisk && !selectedOpportunity && !selectedIssue && (mainTab === "issue_register" || mainTab === "issue_matrix") && (
                  <section style={{ marginBottom: "1rem" }} key="issue-filters">
                    <IssueFilters categories={safeCategories} filters={issueFilters} onChange={setIssueFilters} />
                  </section>
                )}

                {selectedRisk ? (
                  <RiskDetailView
                    categories={safeCategories}
                    risk={selectedRisk}
                    orgUnit={selectedOrgUnit}
                    onBack={() => setSelectedRiskId(null)}
                    onUpdate={refreshRisks}
                    onIssueCreated={(issueId) => {
                      setSelectedRiskId(null);
                      setMainTab("issue_register");
                      setSelectedIssueId(issueId);
                      refreshIssues();
                    }}
                  />
                ) : selectedOpportunity ? (
                  <OpportunityDetailView
                    categories={safeOpportunityCategories}
                    opportunity={selectedOpportunity}
                    orgUnit={selectedOrgUnit}
                    onBack={() => setSelectedOpportunityId(null)}
                    onUpdate={refreshOpportunities}
                  />
                ) : selectedIssue ? (
                  <IssueDetailView
                    categories={safeCategories}
                    issue={selectedIssue}
                    orgUnit={selectedOrgUnit}
                    onBack={() => setSelectedIssueId(null)}
                    onUpdate={refreshIssues}
                    onSelectRisk={(riskId) => {
                      setSelectedIssueId(null);
                      setMainTab("risk_register");
                      setSelectedRiskId(riskId);
                      refreshRisks();
                    }}
                  />
                ) : (
                  <>
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                      {tabGroups.map((group) => (
                        <div
                          key={group.groupLabel}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.35rem 0.6rem 0.35rem 0.5rem",
                            background: group.theme.bg,
                            borderRadius: 8,
                            border: "1px solid " + group.theme.border,
                          }}
                        >
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: group.theme.accent, textTransform: "uppercase", letterSpacing: "0.04em", marginRight: "0.25rem" }}>
                            {group.groupLabel}
                          </span>
                          {group.tabs.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setMainTab(t.id)}
                              style={{
                                padding: "0.45rem 0.85rem",
                                background: mainTab === t.id ? group.theme.accent : "white",
                                color: mainTab === t.id ? "white" : "#374151",
                                border: mainTab === t.id ? "none" : "1px solid " + group.theme.border,
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: "0.8125rem",
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
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
                    {mainTab === "issue_register" && (
                      <section>
                        <IssueRegister
                          categories={safeCategories}
                          orgUnit={selectedOrgUnit}
                          issues={filterIssues(issues, issueFilters)}
                          loading={issuesLoading}
                          onUpdate={refreshIssues}
                          onSelectIssue={setSelectedIssueId}
                        />
                      </section>
                    )}
                    {mainTab === "issue_matrix" && (
                      <section>
                        <IssueMatrix
                          categories={safeCategories}
                          orgUnit={selectedOrgUnit}
                          issues={filterIssues(issues, issueFilters)}
                          onSelectIssue={setSelectedIssueId}
                        />
                      </section>
                    )}
                  </>
                )}
              </>
            )}

            {!selectedOrgUnit && selectedLegalEntity && (
              <p style={{ color: "#6b7280", padding: "2rem" }}>
                Select a Program, Project, or Department to view and manage risks, opportunities, and issues.
              </p>
            )}

            {!selectedLegalEntity && (
              <p style={{ color: "#6b7280", padding: "2rem" }}>
                Select an Entity to get started.
              </p>
            )}
          </>
        )}

        {view === "help" && (
          <section style={{ background: "white", borderRadius: 8, border: "1px solid #e5e7eb", padding: "2rem", maxWidth: 720 }}>
            <h2 style={{ margin: "0 0 1rem", fontSize: "1.25rem", fontWeight: 600 }}>Help</h2>
            <p style={{ margin: 0, color: "#374151", fontSize: "1rem", lineHeight: 1.6 }}>
              We're working on documentation for this application.
            </p>
          </section>
        )}

        {view === "settings" && (
          <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <LegalEntityManager onUpdate={refreshLegalEntities} />
            <OrgUnitManager legalEntities={legalEntities} onUpdate={refreshLegalEntities} />
            <div style={{ display: "flex", flexDirection: "row", gap: "1.5rem", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <CategoryManager onUpdate={() => { refreshCategories(); refreshRisks(); refreshIssues(); }} />
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
