-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Unique index on code
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- Seed default categories
INSERT INTO "Category" ("id", "code", "label", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'technical', 'Technical', 0, NOW(), NOW()),
  (gen_random_uuid(), 'schedule', 'Schedule', 1, NOW(), NOW()),
  (gen_random_uuid(), 'cost', 'Cost', 2, NOW(), NOW()),
  (gen_random_uuid(), 'other', 'Other', 3, NOW(), NOW());

-- Convert Risk.category from enum to text
ALTER TABLE "Risk" ADD COLUMN "category_new" TEXT;
UPDATE "Risk" SET "category_new" = "category"::text WHERE "category" IS NOT NULL;
ALTER TABLE "Risk" DROP COLUMN "category";
ALTER TABLE "Risk" RENAME COLUMN "category_new" TO "category";

-- DropEnum
DROP TYPE "RiskCategory";
