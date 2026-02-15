-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('ignore', 'control');

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "organizationalUnitId" TEXT NOT NULL,
    "issueName" TEXT NOT NULL,
    "description" TEXT,
    "consequence" INTEGER NOT NULL,
    "issueLevel" TEXT,
    "owner" TEXT,
    "category" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'control',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueResolutionStep" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "plannedAction" TEXT NOT NULL,
    "estimatedStartDate" TIMESTAMP(3),
    "estimatedEndDate" TIMESTAMP(3),
    "expectedConsequence" INTEGER NOT NULL,
    "expectedIssueLevel" INTEGER NOT NULL,
    "actualConsequence" INTEGER,
    "actualIssueLevel" INTEGER,
    "actualCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueResolutionStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Issue_organizationalUnitId_idx" ON "Issue"("organizationalUnitId");

-- CreateIndex
CREATE INDEX "IssueResolutionStep_issueId_idx" ON "IssueResolutionStep"("issueId");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_organizationalUnitId_fkey" FOREIGN KEY ("organizationalUnitId") REFERENCES "OrganizationalUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueResolutionStep" ADD CONSTRAINT "IssueResolutionStep_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
