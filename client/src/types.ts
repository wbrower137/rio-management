export interface LegalEntity {
  id: string;
  name: string;
  code: string;
  description: string | null;
  organizationalUnits: OrganizationalUnit[];
}

export interface OrganizationalUnit {
  id: string;
  legalEntityId: string;
  type: "program" | "project" | "department";
  name: string;
  code: string;
  description: string | null;
  _count?: { risks: number };
}

/** Category code (from Settings → Risk Categories). Use Category[] from API for labels. */
export type RiskCategory = string;

export interface Category {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Risk {
  id: string;
  organizationalUnitId: string;
  riskName: string;
  riskCondition: string;
  riskIf: string;
  riskThen: string;
  category: RiskCategory | null;
  originalLikelihood?: number;  // Immutable: set at creation, never changed
  originalConsequence?: number; // Immutable: set at creation, never changed
  likelihood: number;   // Current
  consequence: number;  // Current
  riskLevel: string | null;
  mitigationStrategy: string | null;
  mitigationPlan: string | null;
  owner: string | null;
  status: string;
  /** When status is Closed or Accepted, the rationale required when it was set. */
  statusChangeRationale?: string;
  createdAt: string;
  updatedAt: string;
  /** Latest of risk.updatedAt and any mitigation step updatedAt (from list API) */
  lastUpdated?: string;
}

export interface MitigationStep {
  id: string;
  riskId: string;
  sequenceOrder: number;
  mitigationActions: string;
  closureCriteria: string;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  expectedLikelihood: number;
  expectedConsequence: number;
  expectedRiskLevel: number; // derived from L,C, for waterfall
  actualLikelihood: number | null;
  actualConsequence: number | null;
  actualRiskLevel: number | null; // derived from L,C, for waterfall
  actualCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
