-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('technical', 'schedule', 'cost', 'other');

-- CreateTable
CREATE TABLE "RiskVersion" (
    "id" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskVersion_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Change Risk.category from TEXT to RiskCategory
-- Map existing values: technical/schedule/cost/other -> enum; anything else -> other
ALTER TABLE "Risk" ALTER COLUMN "category" TYPE "RiskCategory" USING (
  CASE
    WHEN "category" IS NULL THEN NULL
    WHEN "category" = 'technical' THEN 'technical'::"RiskCategory"
    WHEN "category" = 'schedule' THEN 'schedule'::"RiskCategory"
    WHEN "category" = 'cost' THEN 'cost'::"RiskCategory"
    WHEN "category" = 'other' THEN 'other'::"RiskCategory"
    ELSE 'other'::"RiskCategory"
  END
);

-- CreateIndex
CREATE INDEX "RiskVersion_riskId_createdAt_idx" ON "RiskVersion"("riskId", "createdAt");

-- AddForeignKey
ALTER TABLE "RiskVersion" ADD CONSTRAINT "RiskVersion_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
