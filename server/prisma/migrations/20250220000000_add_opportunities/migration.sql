-- CreateTable
CREATE TABLE "OpportunityCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "organizationalUnitId" TEXT NOT NULL,
    "opportunityName" TEXT NOT NULL,
    "opportunityCondition" TEXT NOT NULL,
    "opportunityIf" TEXT NOT NULL,
    "opportunityThen" TEXT NOT NULL,
    "category" TEXT,
    "originalLikelihood" INTEGER NOT NULL,
    "originalImpact" INTEGER NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "opportunityLevel" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pursue_now',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityVersion" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "likelihoodChangeReason" TEXT,
    "impactChangeReason" TEXT,
    "statusChangeRationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityActionPlanStep" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "plannedAction" TEXT NOT NULL,
    "estimatedStartDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "expectedLikelihood" INTEGER NOT NULL,
    "expectedImpact" INTEGER NOT NULL,
    "expectedOpportunityLevel" INTEGER NOT NULL,
    "actualLikelihood" INTEGER,
    "actualImpact" INTEGER,
    "actualOpportunityLevel" INTEGER,
    "actualCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityActionPlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityActionPlanStepVersion" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityActionPlanStepVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityAuditLog" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityCategory_code_key" ON "OpportunityCategory"("code");

-- CreateIndex
CREATE INDEX "Opportunity_organizationalUnitId_idx" ON "Opportunity"("organizationalUnitId");

-- CreateIndex
CREATE INDEX "OpportunityVersion_opportunityId_createdAt_idx" ON "OpportunityVersion"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityActionPlanStep_opportunityId_idx" ON "OpportunityActionPlanStep"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityActionPlanStepVersion_stepId_createdAt_idx" ON "OpportunityActionPlanStepVersion"("stepId", "createdAt");

-- CreateIndex
CREATE INDEX "OpportunityAuditLog_opportunityId_createdAt_idx" ON "OpportunityAuditLog"("opportunityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_organizationalUnitId_fkey" FOREIGN KEY ("organizationalUnitId") REFERENCES "OrganizationalUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityVersion" ADD CONSTRAINT "OpportunityVersion_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActionPlanStep" ADD CONSTRAINT "OpportunityActionPlanStep_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityActionPlanStepVersion" ADD CONSTRAINT "OpportunityActionPlanStepVersion_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "OpportunityActionPlanStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAuditLog" ADD CONSTRAINT "OpportunityAuditLog_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
