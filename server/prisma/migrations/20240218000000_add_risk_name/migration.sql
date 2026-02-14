-- Add riskName: human-readable label for lists, tooltips, reference
ALTER TABLE "Risk" ADD COLUMN "riskName" TEXT;

UPDATE "Risk" SET "riskName" = LEFT("riskCondition", 80) WHERE "riskCondition" IS NOT NULL AND "riskName" IS NULL;
UPDATE "Risk" SET "riskName" = 'Unnamed Risk' WHERE "riskName" IS NULL;

ALTER TABLE "Risk" ALTER COLUMN "riskName" SET NOT NULL;
