-- CreateTable
CREATE TABLE "MitigationStepVersion" (
    "id" TEXT NOT NULL,
    "mitigationStepId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MitigationStepVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MitigationStepVersion_mitigationStepId_createdAt_idx" ON "MitigationStepVersion"("mitigationStepId", "createdAt");

-- AddForeignKey
ALTER TABLE "MitigationStepVersion" ADD CONSTRAINT "MitigationStepVersion_mitigationStepId_fkey" FOREIGN KEY ("mitigationStepId") REFERENCES "MitigationStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
