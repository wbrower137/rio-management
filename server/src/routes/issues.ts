import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getIssueLevel, getNumericalIssueLevel } from "../lib/issueLevel.js";

type AuditDetails = {
  changedFields?: string[];
  stepNumber?: number;
  changes?: Record<string, { from: unknown; to: unknown }>;
  resolutionStepsReordered?: { from: string; to: string };
};

function auditValue(val: unknown): unknown {
  if (val instanceof Date) return val.toISOString();
  return val;
}

async function createIssueAuditLog(
  issueId: string,
  entityType: "issue" | "resolution_step",
  entityId: string,
  action: "created" | "updated" | "deleted",
  details?: AuditDetails
) {
  await prisma.issueAuditLog.create({
    data: {
      issueId,
      entityType,
      entityId,
      action,
      details: details ?? undefined,
    },
  });
}

export const issueRoutes = Router();

issueRoutes.get("/", async (req, res) => {
  try {
    const { organizationalUnitId } = req.query;
    const where: { organizationalUnitId?: string } = {};
    if (typeof organizationalUnitId === "string") where.organizationalUnitId = organizationalUnitId;
    const issues = await prisma.issue.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        organizationalUnit: { select: { id: true, name: true, type: true, legalEntity: { select: { id: true, name: true } } } },
      },
    });
    res.json(issues);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch issues" });
  }
});

issueRoutes.get("/:id/audit-log", async (req, res) => {
  try {
    const issueId = req.params.id;
    const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true } });
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    const logs = await prisma.issueAuditLog.findMany({
      where: { issueId },
      orderBy: { createdAt: "desc" },
    });
    res.json(logs);
  } catch (err: unknown) {
    console.error("Issue audit log error:", err);
    const msg = err && typeof err === "object" && "code" in err && String((err as { code: string }).code) === "P2021"
      ? "Audit log table not found. Run: npx prisma migrate deploy"
      : "Failed to fetch audit log";
    res.status(500).json({ error: msg });
  }
});

issueRoutes.get("/:id", async (req, res) => {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: req.params.id },
      include: {
        organizationalUnit: true,
        resolutionSteps: { orderBy: { sequenceOrder: "asc" } },
        sourceRisk: { select: { id: true, riskName: true } },
      },
    });
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    res.json(issue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch issue" });
  }
});

issueRoutes.post("/", async (req, res) => {
  try {
    const { organizationalUnitId, issueName, description, consequence, owner, category, status } = req.body;
    if (!organizationalUnitId || !issueName) {
      return res.status(400).json({ error: "organizationalUnitId and issueName are required" });
    }
    const c = Math.max(1, Math.min(5, typeof consequence === "number" ? consequence : 3));
    const issueLevel = getIssueLevel(c);
    const issue = await prisma.issue.create({
      data: {
        organizationalUnitId,
        issueName: String(issueName).trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        consequence: c,
        issueLevel,
        owner: typeof owner === "string" && owner.trim() ? owner.trim() : null,
        category: typeof category === "string" && category.trim() ? category.trim() : null,
        status: status === "ignore" ? "ignore" : "control",
      },
    });
    await createIssueAuditLog(issue.id, "issue", issue.id, "created");
    res.status(201).json(issue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create issue" });
  }
});

const ISSUE_FIELDS_FOR_AUDIT = [
  "issueName", "description", "consequence", "owner", "category", "status",
] as const;

issueRoutes.patch("/:id", async (req, res) => {
  try {
    const { issueName, description, consequence, owner, category, status } = req.body;
    const existing = await prisma.issue.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Issue not found" });
    const data: Record<string, unknown> = {};
    if (typeof issueName === "string" && issueName.trim()) data.issueName = issueName.trim();
    if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
      data.description = typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim() : null;
    }
    if (typeof consequence === "number" && consequence >= 1 && consequence <= 5) {
      data.consequence = consequence;
      data.issueLevel = getIssueLevel(consequence);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "owner")) {
      data.owner = typeof req.body.owner === "string" && req.body.owner.trim() ? req.body.owner.trim() : null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "category")) {
      data.category = typeof req.body.category === "string" && req.body.category.trim() ? req.body.category.trim() : null;
    }
    if (status === "ignore" || status === "control") data.status = status;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });
    const issue = await prisma.issue.update({
      where: { id: req.params.id },
      data,
    });
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of ISSUE_FIELDS_FOR_AUDIT) {
      const oldVal = (existing as Record<string, unknown>)[k];
      const newVal = (issue as Record<string, unknown>)[k];
      if (oldVal !== newVal) {
        changes[k] = { from: auditValue(oldVal), to: auditValue(newVal) };
      }
    }
    const changedFields = Object.keys(changes);
    await createIssueAuditLog(issue.id, "issue", issue.id, "updated", {
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
    });
    res.json(issue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update issue" });
  }
});

issueRoutes.delete("/:id", async (req, res) => {
  try {
    const issueId = req.params.id;
    await createIssueAuditLog(issueId, "issue", issueId, "deleted");
    await prisma.issue.delete({ where: { id: issueId } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete issue" });
  }
});

// Resolution steps
issueRoutes.get("/:id/resolution-steps", async (req, res) => {
  try {
    const steps = await prisma.issueResolutionStep.findMany({
      where: { issueId: req.params.id },
      orderBy: { sequenceOrder: "asc" },
    });
    res.json(steps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch resolution steps" });
  }
});

issueRoutes.post("/:id/resolution-steps", async (req, res) => {
  try {
    const { sequenceOrder, plannedAction, estimatedStartDate, estimatedEndDate, expectedConsequence } = req.body;
    const issue = await prisma.issue.findUnique({ where: { id: req.params.id } });
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    const c = Math.max(1, Math.min(5, typeof expectedConsequence === "number" ? expectedConsequence : issue.consequence));
    const step = await prisma.issueResolutionStep.create({
      data: {
        issueId: req.params.id,
        sequenceOrder: typeof sequenceOrder === "number" ? sequenceOrder : 0,
        plannedAction: String(plannedAction ?? "").trim() || "Resolution step",
        estimatedStartDate: estimatedStartDate ? new Date(estimatedStartDate) : null,
        estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null,
        expectedConsequence: c,
        expectedIssueLevel: getNumericalIssueLevel(c),
      },
    });
    await createIssueAuditLog(req.params.id, "resolution_step", step.id, "created", {
      stepNumber: step.sequenceOrder + 1,
    });
    res.status(201).json(step);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create resolution step" });
  }
});

const RESOLUTION_STEP_FIELDS_FOR_AUDIT = [
  "sequenceOrder", "plannedAction", "estimatedStartDate", "estimatedEndDate",
  "expectedConsequence", "expectedIssueLevel", "actualConsequence", "actualIssueLevel", "actualCompletedAt",
] as const;

issueRoutes.patch("/:issueId/resolution-steps/:stepId", async (req, res) => {
  try {
    const { issueId, stepId } = req.params;
    const { sequenceOrder, plannedAction, estimatedStartDate, estimatedEndDate, expectedConsequence, actualConsequence, actualCompletedAt } = req.body;
    const step = await prisma.issueResolutionStep.findFirst({ where: { id: stepId, issueId } });
    if (!step) return res.status(404).json({ error: "Resolution step not found" });
    const data: Record<string, unknown> = {};
    if (typeof sequenceOrder === "number") data.sequenceOrder = sequenceOrder;
    if (typeof plannedAction === "string") data.plannedAction = plannedAction.trim() || "Resolution step";
    if (Object.prototype.hasOwnProperty.call(req.body, "estimatedStartDate")) {
      data.estimatedStartDate = estimatedStartDate ? new Date(estimatedStartDate) : null;
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "estimatedEndDate")) {
      data.estimatedEndDate = estimatedEndDate ? new Date(estimatedEndDate) : null;
    }
    if (typeof expectedConsequence === "number" && expectedConsequence >= 1 && expectedConsequence <= 5) {
      data.expectedConsequence = expectedConsequence;
      data.expectedIssueLevel = getNumericalIssueLevel(expectedConsequence);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "actualConsequence")) {
      if (actualConsequence != null && actualConsequence >= 1 && actualConsequence <= 5) {
        data.actualConsequence = actualConsequence;
        data.actualIssueLevel = getNumericalIssueLevel(actualConsequence);
      } else {
        data.actualConsequence = null;
        data.actualIssueLevel = null;
      }
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "actualCompletedAt")) {
      data.actualCompletedAt = actualCompletedAt ? new Date(actualCompletedAt) : null;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });
    const updated = await prisma.issueResolutionStep.update({
      where: { id: stepId },
      data,
    });
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of RESOLUTION_STEP_FIELDS_FOR_AUDIT) {
      const oldVal = (step as Record<string, unknown>)[key];
      const newVal = (updated as Record<string, unknown>)[key];
      const oldNorm = oldVal instanceof Date ? oldVal.getTime() : oldVal;
      const newNorm = newVal instanceof Date ? newVal.getTime() : newVal;
      if (oldNorm !== newNorm) {
        changes[key] = { from: auditValue(oldVal), to: auditValue(newVal) };
      }
    }
    const changedFields = Object.keys(changes);
    await createIssueAuditLog(issueId, "resolution_step", stepId, "updated", {
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
      stepNumber: updated.sequenceOrder + 1,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update resolution step" });
  }
});

issueRoutes.delete("/:issueId/resolution-steps/:stepId", async (req, res) => {
  try {
    const { issueId, stepId } = req.params;
    const step = await prisma.issueResolutionStep.findFirst({ where: { id: stepId, issueId } });
    if (!step) return res.status(404).json({ error: "Resolution step not found" });
    await createIssueAuditLog(issueId, "resolution_step", stepId, "deleted", {
      stepNumber: step.sequenceOrder + 1,
    });
    await prisma.issueResolutionStep.delete({ where: { id: stepId } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete resolution step" });
  }
});

issueRoutes.post("/:issueId/resolution-steps/reorder", async (req, res) => {
  try {
    const { issueId } = req.params;
    const { stepIds } = req.body as { stepIds: string[] };
    if (!Array.isArray(stepIds) || stepIds.length === 0) {
      return res.status(400).json({ error: "stepIds array is required" });
    }
    const stepsBefore = await prisma.issueResolutionStep.findMany({
      where: { issueId },
      orderBy: { sequenceOrder: "asc" },
    });
    const fromOrder = stepsBefore.map((s) => s.sequenceOrder + 1).join(", ");
    await prisma.$transaction(
      stepIds.map((id, i) =>
        prisma.issueResolutionStep.updateMany({
          where: { id, issueId },
          data: { sequenceOrder: i },
        })
      )
    );
    const toOrder = stepIds
      .map((id: string) => {
        const idx = stepsBefore.findIndex((s) => s.id === id);
        return idx >= 0 ? stepsBefore[idx].sequenceOrder + 1 : "?";
      })
      .join(", ");
    await createIssueAuditLog(issueId, "issue", issueId, "updated", {
      changedFields: ["resolutionStepsReordered"],
      changes: { resolutionStepsReordered: { from: fromOrder, to: toOrder } },
    });
    const steps = await prisma.issueResolutionStep.findMany({
      where: { issueId },
      orderBy: { sequenceOrder: "asc" },
    });
    res.json(steps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reorder resolution steps" });
  }
});

// Waterfall: issue + resolution steps over time (consequence -> 8,16,20,23,25)
issueRoutes.get("/:id/waterfall", async (req, res) => {
  try {
    const issue = await prisma.issue.findUnique({
      where: { id: req.params.id },
      include: { resolutionSteps: { orderBy: { sequenceOrder: "asc" } } },
    });
    if (!issue) return res.status(404).json({ error: "Issue not found" });
    const originalLevel = getNumericalIssueLevel(issue.consequence);
    const planned: { date: string; issueLevel: number; consequence: number; plannedAction?: string }[] = [];
    const actual: { date: string; issueLevel: number; consequence: number; source?: string; isOriginal?: boolean }[] = [];
    const createdDate = issue.createdAt.toISOString().slice(0, 10);
    actual.push({
      date: createdDate,
      issueLevel: originalLevel,
      consequence: issue.consequence,
      source: "issue_create",
      isOriginal: true,
    });
    for (const step of issue.resolutionSteps) {
      const stepDate = step.estimatedStartDate?.toISOString().slice(0, 10) ?? createdDate;
      planned.push({
        date: stepDate,
        issueLevel: step.expectedIssueLevel,
        consequence: step.expectedConsequence,
        plannedAction: step.plannedAction,
      });
      if (step.actualCompletedAt != null) {
        actual.push({
          date: step.actualCompletedAt.toISOString().slice(0, 10),
          issueLevel: step.actualIssueLevel ?? step.expectedIssueLevel,
          consequence: step.actualConsequence ?? step.expectedConsequence,
          source: "resolution_step",
          isOriginal: false,
        });
      }
    }
    res.json({ planned, actual });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load waterfall" });
  }
});
