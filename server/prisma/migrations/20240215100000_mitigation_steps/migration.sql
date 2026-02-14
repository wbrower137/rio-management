-- CreateTable
CREATE TABLE "MitigationStep" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "mitigationActions" TEXT NOT NULL,
    "closureCriteria" TEXT NOT NULL,
    "estimatedStartDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "expectedRiskLevel" INTEGER NOT NULL,
    "actualRiskLevel" INTEGER,
    "actualCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MitigationStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MitigationStep_riskId_idx" ON "MitigationStep"("riskId");

-- AddForeignKey
ALTER TABLE "MitigationStep" ADD CONSTRAINT "MitigationStep_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
