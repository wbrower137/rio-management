-- AlterTable
ALTER TABLE "Risk" ADD COLUMN "originalLikelihood" INTEGER,
ADD COLUMN "originalConsequence" INTEGER;

-- Backfill original from current for existing rows
UPDATE "Risk" SET "originalLikelihood" = "likelihood", "originalConsequence" = "consequence" WHERE "originalLikelihood" IS NULL;

-- Make columns required
ALTER TABLE "Risk" ALTER COLUMN "originalLikelihood" SET NOT NULL;
ALTER TABLE "Risk" ALTER COLUMN "originalConsequence" SET NOT NULL;

-- AlterTable
ALTER TABLE "RiskVersion" ADD COLUMN "likelihoodChangeReason" TEXT,
ADD COLUMN "consequenceChangeReason" TEXT;
