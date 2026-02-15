-- Add 'realized' to RiskStatus enum
ALTER TYPE "RiskStatus" ADD VALUE 'realized';

-- Add optional link from Issue to the Risk from which it was created (when risk is realized)
ALTER TABLE "Issue" ADD COLUMN "sourceRiskId" TEXT;

-- CreateIndex
CREATE INDEX "Issue_sourceRiskId_idx" ON "Issue"("sourceRiskId");

-- AddForeignKey (ON DELETE SET NULL: if risk is deleted, issue remains, link is cleared)
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_sourceRiskId_fkey" FOREIGN KEY ("sourceRiskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
