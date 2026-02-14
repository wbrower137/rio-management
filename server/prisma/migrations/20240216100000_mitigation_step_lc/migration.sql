-- Add L/C columns to MitigationStep; RL remains stored (derived from L/C on save)
ALTER TABLE "MitigationStep" ADD COLUMN "expectedLikelihood" INTEGER;
ALTER TABLE "MitigationStep" ADD COLUMN "expectedConsequence" INTEGER;
ALTER TABLE "MitigationStep" ADD COLUMN "actualLikelihood" INTEGER;
ALTER TABLE "MitigationStep" ADD COLUMN "actualConsequence" INTEGER;

-- Backfill existing rows with default L,C (3,3) so we can set NOT NULL
UPDATE "MitigationStep" SET "expectedLikelihood" = 3, "expectedConsequence" = 3 WHERE "expectedLikelihood" IS NULL;

ALTER TABLE "MitigationStep" ALTER COLUMN "expectedLikelihood" SET NOT NULL;
ALTER TABLE "MitigationStep" ALTER COLUMN "expectedConsequence" SET NOT NULL;
