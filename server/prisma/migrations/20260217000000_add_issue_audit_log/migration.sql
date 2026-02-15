-- CreateTable
CREATE TABLE "IssueAuditLog" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueAuditLog_issueId_createdAt_idx" ON "IssueAuditLog"("issueId", "createdAt");

-- AddForeignKey
ALTER TABLE "IssueAuditLog" ADD CONSTRAINT "IssueAuditLog_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
