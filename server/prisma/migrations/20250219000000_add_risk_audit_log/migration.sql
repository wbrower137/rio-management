-- CreateTable
CREATE TABLE "RiskAuditLog" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RiskAuditLog_riskId_createdAt_idx" ON "RiskAuditLog"("riskId", "createdAt");

-- AddForeignKey
ALTER TABLE "RiskAuditLog" ADD CONSTRAINT "RiskAuditLog_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
