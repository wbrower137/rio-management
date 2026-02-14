-- CreateEnum
CREATE TYPE "OrgUnitType" AS ENUM ('program', 'project', 'department');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('open', 'mitigating', 'accepted', 'closed');

-- CreateEnum
CREATE TYPE "MitigationStrategy" AS ENUM ('acceptance', 'avoidance', 'transfer', 'control', 'burn_down');

-- CreateTable
CREATE TABLE "LegalEntity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationalUnit" (
    "id" TEXT NOT NULL,
    "legalEntityId" TEXT NOT NULL,
    "type" "OrgUnitType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationalUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "organizationalUnitId" TEXT NOT NULL,
    "riskStatement" TEXT NOT NULL,
    "category" TEXT,
    "likelihood" INTEGER NOT NULL,
    "consequence" INTEGER NOT NULL,
    "riskLevel" TEXT,
    "mitigationStrategy" "MitigationStrategy",
    "mitigationPlan" TEXT,
    "owner" TEXT,
    "status" "RiskStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalEntity_code_key" ON "LegalEntity"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationalUnit_legalEntityId_type_code_key" ON "OrganizationalUnit"("legalEntityId", "type", "code");

-- AddForeignKey
ALTER TABLE "OrganizationalUnit" ADD CONSTRAINT "OrganizationalUnit_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "LegalEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationalUnit" ADD CONSTRAINT "OrganizationalUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationalUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_organizationalUnitId_fkey" FOREIGN KEY ("organizationalUnitId") REFERENCES "OrganizationalUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

