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
  _count?: { risks: number; opportunities?: number; issues?: number };
}

export type IssueStatus = "ignore" | "control";

/** When an issue was created from a realized risk, the source risk. */
export interface IssueSourceRisk {
  id: string;
  riskName: string;
}

export interface Issue {
  id: string;
  organizationalUnitId: string;
  issueName: string;
  description: string | null;
  consequence: number; // 1-5
  issueLevel: string | null; // low, moderate, high
  owner: string | null;
  category: string | null; // Category.code (Risk Categories)
  status: IssueStatus;
  /** When this issue was created from a realized risk. */
  sourceRiskId?: string | null;
  sourceRisk?: IssueSourceRisk | null;
  createdAt: string;
  updatedAt: string;
  lastUpdated?: string;
}

export interface IssueResolutionStep {
  id: string;
  issueId: string;
  sequenceOrder: number;
  plannedAction: string;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  expectedConsequence: number;
  expectedIssueLevel: number; // 8, 16, 20, 23, 25
  actualConsequence: number | null;
  actualIssueLevel: number | null;
  actualCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

/** When a risk is Realized and an issue was created from it, the linked issue (at most one). */
export interface RiskLinkedIssue {
  id: string;
  issueName: string;
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
  /** When status is Closed, Accepted, or Realized, the rationale required when it was set. */
  statusChangeRationale?: string;
  /** When status is Realized, the issue created from this risk (if any). */
  linkedIssue?: RiskLinkedIssue | null;
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

export interface OpportunityCategory {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStatus = "pursue_now" | "defer" | "reevaluate" | "reject";

export interface Opportunity {
  id: string;
  organizationalUnitId: string;
  opportunityName: string;
  opportunityCondition: string;
  opportunityIf: string;
  opportunityThen: string;
  category: string | null;
  originalLikelihood?: number;
  originalImpact?: number;
  likelihood: number;
  impact: number;
  opportunityLevel: string | null;
  owner: string | null;
  status: OpportunityStatus;
  statusChangeRationale?: string;
  createdAt: string;
  updatedAt: string;
  lastUpdated?: string;
}

export interface OpportunityActionPlanStep {
  id: string;
  opportunityId: string;
  sequenceOrder: number;
  plannedAction: string;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  expectedLikelihood: number;
  expectedImpact: number;
  expectedOpportunityLevel: number;
  actualLikelihood: number | null;
  actualImpact: number | null;
  actualOpportunityLevel: number | null;
  actualCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
