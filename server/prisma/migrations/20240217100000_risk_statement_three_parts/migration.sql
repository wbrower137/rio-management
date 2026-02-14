-- Replace riskStatement with three-part DoD 2.2.3 format: Condition, If, Then
ALTER TABLE "Risk" ADD COLUMN "riskCondition" TEXT;
ALTER TABLE "Risk" ADD COLUMN "riskIf" TEXT;
ALTER TABLE "Risk" ADD COLUMN "riskThen" TEXT;

UPDATE "Risk" SET "riskCondition" = "riskStatement", "riskIf" = '', "riskThen" = '' WHERE "riskStatement" IS NOT NULL;
UPDATE "Risk" SET "riskCondition" = COALESCE("riskCondition", ''), "riskIf" = COALESCE("riskIf", ''), "riskThen" = COALESCE("riskThen", '') WHERE "riskCondition" IS NULL;

ALTER TABLE "Risk" ALTER COLUMN "riskCondition" SET NOT NULL;
ALTER TABLE "Risk" ALTER COLUMN "riskIf" SET NOT NULL;
ALTER TABLE "Risk" ALTER COLUMN "riskThen" SET NOT NULL;

ALTER TABLE "Risk" DROP COLUMN "riskStatement";
