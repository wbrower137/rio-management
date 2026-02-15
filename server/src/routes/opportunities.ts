import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getOpportunityLevel, getNumericalOpportunityLevel } from "../lib/opportunityLevel.js";

export const opportunityRoutes = Router();

async function resolveOpportunityCategoryCode(code: string | null | undefined): Promise<string | null> {
  if (code == null || typeof code !== "string" || !code.trim()) return null;
  const cat = await prisma.opportunityCategory.findUnique({ where: { code: code.trim() }, select: { code: true } });
  return cat?.code ?? null;
}

function toSnapshot(opp: {
  opportunityName: string;
  opportunityCondition: string;
  opportunityIf: string;
  opportunityThen: string;
  category: string | null;
  likelihood: number;
  impact: number;
  opportunityLevel: string | null;
  owner: string | null;
  status: string;
}) {
  return {
    opportunityName: opp.opportunityName,
    opportunityCondition: opp.opportunityCondition,
    opportunityIf: opp.opportunityIf,
    opportunityThen: opp.opportunityThen,
    category: opp.category,
    likelihood: opp.likelihood,
    impact: opp.impact,
    opportunityLevel: opp.opportunityLevel,
    owner: opp.owner,
    status: opp.status,
  };
}

type PrismaClientLike = Pick<typeof prisma, "opportunityVersion">;

async function createOpportunityVersion(
  opportunityId: string,
  opp: Parameters<typeof toSnapshot>[0],
  options?: { likelihoodChangeReason?: string | null; impactChangeReason?: string | null; statusChangeRationale?: string | null },
  tx?: PrismaClientLike
) {
  const db = tx ?? prisma;
  const count = await db.opportunityVersion.count({ where: { opportunityId } });
  const version = count + 1;
  const snapshot = toSnapshot(opp);
  await db.opportunityVersion.create({
    data: {
      opportunityId,
      version,
      snapshot,
      likelihoodChangeReason: options?.likelihoodChangeReason ?? null,
      impactChangeReason: options?.impactChangeReason ?? null,
      statusChangeRationale: options?.statusChangeRationale ?? null,
    },
  });
}

function toStepSnapshot(step: {
  plannedAction: string;
  estimatedStartDate: Date | null;
  estimatedEndDate: Date | null;
  expectedLikelihood: number;
  expectedImpact: number;
  actualLikelihood: number | null;
  actualImpact: number | null;
  actualCompletedAt: Date | null;
}) {
  return {
    plannedAction: step.plannedAction,
    estimatedStartDate: step.estimatedStartDate?.toISOString() ?? null,
    estimatedEndDate: step.estimatedEndDate?.toISOString() ?? null,
    expectedLikelihood: step.expectedLikelihood,
    expectedImpact: step.expectedImpact,
    actualLikelihood: step.actualLikelihood,
    actualImpact: step.actualImpact,
    actualCompletedAt: step.actualCompletedAt?.toISOString() ?? null,
  };
}

async function createActionPlanStepVersion(stepId: string, step: Parameters<typeof toStepSnapshot>[0]) {
  const count = await prisma.opportunityActionPlanStepVersion.count({ where: { stepId } });
  await prisma.opportunityActionPlanStepVersion.create({
    data: {
      stepId,
      version: count + 1,
      snapshot: toStepSnapshot(step),
    },
  });
}

type AuditChange = { from: unknown; to: unknown };
type AuditDetails = {
  changedFields?: string[];
  stepNumber?: number;
  changes?: Record<string, AuditChange>;
  likelihoodChangeReason?: string;
  impactChangeReason?: string;
  statusChangeRationale?: string;
};

function auditValue(val: unknown): unknown {
  if (val instanceof Date) return val.toISOString();
  return val;
}

async function createAuditLog(
  opportunityId: string,
  entityType: "opportunity" | "action_plan_step",
  entityId: string,
  action: "created" | "updated" | "deleted",
  details?: AuditDetails
) {
  await prisma.opportunityAuditLog.create({
    data: {
      opportunityId,
      entityType,
      entityId,
      action,
      details: details ?? undefined,
    },
  });
}

function toCreatedAtISO(val: Date | string | unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return new Date(val as string).toISOString();
}

function getOriginalFromVersion(snapshot: unknown): { originalLikelihood: number; originalImpact: number } | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as { likelihood?: number; impact?: number };
  const l = s.likelihood;
  const i = s.impact;
  if (typeof l !== "number" || typeof i !== "number") return null;
  return {
    originalLikelihood: Math.max(1, Math.min(5, l)),
    originalImpact: Math.max(1, Math.min(5, i)),
  };
}

/** Status values that require rationale when changed (defer, reevaluate, reject) */
const STATUS_REQUIRING_RATIONALE = ["defer", "reevaluate", "reject"];

opportunityRoutes.get("/", async (req, res) => {
  try {
    const { organizationalUnitId } = req.query;
    if (typeof organizationalUnitId !== "string") {
      return res.status(400).json({ error: "organizationalUnitId is required" });
    }

    const opportunities = await prisma.opportunity.findMany({
      where: { organizationalUnitId },
      orderBy: { updatedAt: "desc" },
      include: {
        organizationalUnit: {
          select: { id: true, name: true, type: true, legalEntity: { select: { name: true } } },
        },
        actionPlanSteps: { select: { updatedAt: true } },
      },
    });

    if (opportunities.length > 0) {
      const v1s = await prisma.opportunityVersion.findMany({
        where: { opportunityId: { in: opportunities.map((o) => o.id) }, version: 1 },
        select: { opportunityId: true, snapshot: true },
      });
      const origByOppId = new Map<string, { originalLikelihood: number; originalImpact: number }>();
      for (const v of v1s) {
        const orig = getOriginalFromVersion(v.snapshot);
        if (orig) origByOppId.set(v.opportunityId, orig);
      }
      const deferRejectIds = opportunities
        .filter((o) => STATUS_REQUIRING_RATIONALE.includes(o.status))
        .map((o) => o.id);
      let rationaleByOppId = new Map<string, string>();
      if (deferRejectIds.length > 0) {
        const versionsWithRationale = await prisma.opportunityVersion.findMany({
          where: { opportunityId: { in: deferRejectIds }, statusChangeRationale: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { opportunityId: true, statusChangeRationale: true },
        });
        for (const v of versionsWithRationale) {
          if (v.statusChangeRationale && !rationaleByOppId.has(v.opportunityId)) {
            rationaleByOppId.set(v.opportunityId, v.statusChangeRationale);
          }
        }
      }
      for (const o of opportunities) {
        const orig = origByOppId.get(o.id);
        if (orig) {
          (o as { originalLikelihood: number; originalImpact: number }).originalLikelihood = orig.originalLikelihood;
          (o as { originalLikelihood: number; originalImpact: number }).originalImpact = orig.originalImpact;
        }
        const rationale = rationaleByOppId.get(o.id);
        if (rationale) (o as { statusChangeRationale?: string }).statusChangeRationale = rationale;
      }
    }

    const withLastUpdated = opportunities.map((o) => {
      const steps = o.actionPlanSteps ?? [];
      const lastMs =
        steps.length > 0
          ? Math.max(new Date(o.updatedAt).getTime(), ...steps.map((s) => new Date(s.updatedAt).getTime()))
          : new Date(o.updatedAt).getTime();
      const { actionPlanSteps: _s, ...rest } = o;
      return { ...rest, lastUpdated: new Date(lastMs).toISOString() };
    });
    res.json(withLastUpdated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

opportunityRoutes.get("/waterfall/data", async (req, res) => {
  try {
    const { organizationalUnitId } = req.query;
    if (typeof organizationalUnitId !== "string") {
      return res.status(400).json({ error: "organizationalUnitId is required" });
    }

    const opportunities = await prisma.opportunity.findMany({
      where: { organizationalUnitId },
      select: { id: true },
    });

    const allVersions: { date: string; opportunityId: string; opportunityLevelNumerical: number; version: number }[] = [];
    for (const o of opportunities) {
      const versions = await prisma.opportunityVersion.findMany({
        where: { opportunityId: o.id },
        orderBy: { createdAt: "asc" },
      });
      for (const v of versions) {
        const s = v.snapshot as { likelihood?: number; impact?: number };
        const lik = s.likelihood ?? 3;
        const imp = s.impact ?? 3;
        const ol = getNumericalOpportunityLevel(lik, imp);
        allVersions.push({
          date: (v.createdAt as Date).toISOString(),
          opportunityId: o.id,
          opportunityLevelNumerical: ol,
          version: v.version,
        });
      }
    }

    allVersions.sort((a, b) => a.date.localeCompare(b.date));
    res.json(allVersions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch waterfall data" });
  }
});

opportunityRoutes.get("/:id/audit-log", async (req, res) => {
  try {
    const { id } = req.params;
    const opp = await prisma.opportunity.findUnique({ where: { id }, select: { id: true } });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });

    const logs = await prisma.opportunityAuditLog.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: "desc" },
    });

    const list = logs.map((log) => ({
      id: log.id,
      entityType: log.entityType,
      entityId: log.entityId,
      action: log.action,
      details: log.details as AuditDetails | undefined,
      createdAt: toCreatedAtISO(log.createdAt),
    }));

    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

opportunityRoutes.get("/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    const oppExists = await prisma.opportunity.findUnique({ where: { id }, select: { id: true } });
    if (!oppExists) return res.status(404).json({ error: "Opportunity not found" });

    const { at: atParam } = req.query;
    const at = typeof atParam === "string" ? new Date(atParam) : null;

    let oppVersions = await prisma.opportunityVersion.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: "asc" },
    });

    if (oppVersions.length === 0) {
      const fullOpp = await prisma.opportunity.findUnique({ where: { id } });
      if (fullOpp) {
        try {
          const snapshot = toSnapshot(fullOpp);
          await prisma.opportunityVersion.create({
            data: {
              opportunityId: id,
              version: 1,
              snapshot,
              likelihoodChangeReason: null,
              impactChangeReason: null,
              statusChangeRationale: null,
            },
          });
          oppVersions = await prisma.opportunityVersion.findMany({
            where: { opportunityId: id },
            orderBy: { createdAt: "asc" },
          });
        } catch {
          // fall through to synthetic
        }
      }
      if (oppVersions.length === 0 && fullOpp) {
        oppVersions = [{
          id: "",
          opportunityId: id,
          version: 1,
          snapshot: toSnapshot(fullOpp),
          likelihoodChangeReason: null,
          impactChangeReason: null,
          statusChangeRationale: null,
          createdAt: fullOpp.createdAt,
        } as (typeof oppVersions)[0]];
      }
    }

    if (at) {
      const versionAt = oppVersions.filter((v) => new Date(v.createdAt) <= at);
      const latest = versionAt[versionAt.length - 1];
      if (!latest) return res.status(404).json({ error: "No version at that date" });
      return res.json({
        type: "opportunity",
        version: latest.version,
        snapshot: latest.snapshot,
        createdAt: toCreatedAtISO(latest.createdAt),
      });
    }

    const steps = await prisma.opportunityActionPlanStep.findMany({
      where: { opportunityId: id },
      orderBy: { sequenceOrder: "asc" },
      include: { versions: { orderBy: { createdAt: "asc" } } },
    });

    const oppEntries = oppVersions.map((v) => ({
      type: "opportunity" as const,
      version: v.version,
      snapshot: v.snapshot,
      statusChangeRationale: v.statusChangeRationale ?? undefined,
      createdAt: toCreatedAtISO(v.createdAt),
    }));

    const stepEntries = steps.flatMap((s) =>
      s.versions.map((v) => ({
        type: "action_plan_step" as const,
        stepId: s.id,
        stepNumber: s.sequenceOrder + 1,
        version: v.version,
        snapshot: v.snapshot,
        createdAt: toCreatedAtISO(v.createdAt),
      }))
    );

    const merged = [...oppEntries, ...stepEntries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch opportunity history" });
  }
});

opportunityRoutes.patch("/:id/action-plan-steps/reorder", async (req, res) => {
  try {
    const opportunityId = req.params.id;
    const { stepIds } = req.body;
    if (!Array.isArray(stepIds) || stepIds.length === 0) {
      return res.status(400).json({ error: "stepIds array is required" });
    }
    const stepsBefore = await prisma.opportunityActionPlanStep.findMany({
      where: { opportunityId },
      orderBy: { sequenceOrder: "asc" },
      select: { id: true },
    });

    const updates = stepIds.map((id: string, i: number) =>
      prisma.opportunityActionPlanStep.updateMany({
        where: { id, opportunityId },
        data: { sequenceOrder: i },
      })
    );
    await Promise.all(updates);

    const toOrder = stepIds
      .map((id: string) => {
        const idx = stepsBefore.findIndex((s) => s.id === id);
        return idx >= 0 ? idx + 1 : "?";
      })
      .join(", ");

    await createAuditLog(opportunityId, "opportunity", opportunityId, "updated", {
      changedFields: ["actionPlanStepsReordered"],
      changes: { actionPlanStepsReordered: { from: stepsBefore.map((_, i) => i + 1).join(", "), to: toOrder } },
    });
    const steps = await prisma.opportunityActionPlanStep.findMany({
      where: { opportunityId },
      orderBy: { sequenceOrder: "asc" },
    });
    res.json(steps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reorder action plan steps" });
  }
});

opportunityRoutes.get("/:id/action-plan-steps", async (req, res) => {
  try {
    const steps = await prisma.opportunityActionPlanStep.findMany({
      where: { opportunityId: req.params.id },
      orderBy: { sequenceOrder: "asc" },
    });
    res.json(steps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch action plan steps" });
  }
});

opportunityRoutes.post("/:id/action-plan-steps", async (req, res) => {
  try {
    const opportunityId = req.params.id;
    const {
      sequenceOrder,
      plannedAction,
      estimatedStartDate,
      estimatedEndDate,
      expectedLikelihood,
      expectedImpact,
      actualLikelihood,
      actualImpact,
      actualCompletedAt,
    } = req.body;
    if (!plannedAction || expectedLikelihood == null || expectedImpact == null) {
      return res.status(400).json({
        error: "plannedAction, expectedLikelihood, and expectedImpact are required",
      });
    }
    const el = Math.max(1, Math.min(5, Number(expectedLikelihood)));
    const ei = Math.max(1, Math.min(5, Number(expectedImpact)));
    const expectedOpportunityLevel = getNumericalOpportunityLevel(el, ei);
    const al =
      actualLikelihood != null && actualImpact != null ? Math.max(1, Math.min(5, Number(actualLikelihood))) : null;
    const ai =
      actualLikelihood != null && actualImpact != null ? Math.max(1, Math.min(5, Number(actualImpact))) : null;
    const actualOpportunityLevel = al != null && ai != null ? getNumericalOpportunityLevel(al, ai) : null;
    const step = await prisma.opportunityActionPlanStep.create({
      data: {
        opportunityId,
        sequenceOrder: sequenceOrder ?? 0,
        plannedAction,
        estimatedStartDate: estimatedStartDate ? new Date(estimatedStartDate) : null,
        estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null,
        expectedLikelihood: el,
        expectedImpact: ei,
        expectedOpportunityLevel,
        actualLikelihood: al,
        actualImpact: ai,
        actualOpportunityLevel,
        actualCompletedAt: actualCompletedAt ? new Date(actualCompletedAt) : null,
      },
    });
    await createActionPlanStepVersion(step.id, step);
    await createAuditLog(opportunityId, "action_plan_step", step.id, "created", {
      stepNumber: (step.sequenceOrder ?? 0) + 1,
    });
    res.status(201).json(step);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create action plan step" });
  }
});

opportunityRoutes.patch("/:id/action-plan-steps/:stepId", async (req, res) => {
  try {
    const { stepId } = req.params;
    const step = await prisma.opportunityActionPlanStep.findFirst({
      where: { id: stepId, opportunityId: req.params.id },
    });
    if (!step) return res.status(404).json({ error: "Action plan step not found" });
    const s = step as {
      expectedLikelihood: number;
      expectedImpact: number;
      actualLikelihood: number | null;
      actualImpact: number | null;
    };
    const {
      sequenceOrder,
      plannedAction,
      estimatedStartDate,
      estimatedEndDate,
      expectedLikelihood,
      expectedImpact,
      actualLikelihood,
      actualImpact,
      actualCompletedAt,
    } = req.body;
    const data: Record<string, unknown> = {};
    if (sequenceOrder !== undefined) data.sequenceOrder = sequenceOrder;
    if (plannedAction !== undefined) data.plannedAction = plannedAction;
    if (estimatedStartDate !== undefined) data.estimatedStartDate = estimatedStartDate ? new Date(estimatedStartDate) : null;
    if (estimatedEndDate !== undefined) data.estimatedEndDate = estimatedEndDate ? new Date(estimatedEndDate) : null;
    const el =
      expectedLikelihood !== undefined ? Math.max(1, Math.min(5, Number(expectedLikelihood))) : s.expectedLikelihood;
    const ei = expectedImpact !== undefined ? Math.max(1, Math.min(5, Number(expectedImpact))) : s.expectedImpact;
    data.expectedLikelihood = el;
    data.expectedImpact = ei;
    data.expectedOpportunityLevel = getNumericalOpportunityLevel(el, ei);
    const al =
      actualLikelihood !== undefined
        ? (actualLikelihood == null ? null : Math.max(1, Math.min(5, Number(actualLikelihood))))
        : s.actualLikelihood;
    const ai =
      actualImpact !== undefined
        ? (actualImpact == null ? null : Math.max(1, Math.min(5, Number(actualImpact))))
        : s.actualImpact;
    data.actualLikelihood = al ?? null;
    data.actualImpact = ai ?? null;
    data.actualOpportunityLevel = al != null && ai != null ? getNumericalOpportunityLevel(al, ai) : null;
    if (actualCompletedAt !== undefined) data.actualCompletedAt = actualCompletedAt ? new Date(actualCompletedAt) : null;
    const updated = await prisma.opportunityActionPlanStep.update({
      where: { id: stepId },
      data,
    });
    await createActionPlanStepVersion(updated.id, updated);

    const changes: Record<string, AuditChange> = {};
    for (const key of Object.keys(data)) {
      const oldVal = (step as Record<string, unknown>)[key];
      const newVal = (updated as Record<string, unknown>)[key];
      const oldNorm = oldVal instanceof Date ? oldVal.getTime() : oldVal;
      const newNorm = newVal instanceof Date ? newVal.getTime() : newVal;
      if (oldNorm !== newNorm) {
        changes[key] = { from: auditValue(oldVal), to: auditValue(newVal) };
      }
    }
    const changedFields = Object.keys(changes);
    await createAuditLog(req.params.id, "action_plan_step", stepId, "updated", {
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
      stepNumber: updated.sequenceOrder + 1,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update action plan step" });
  }
});

opportunityRoutes.delete("/:id/action-plan-steps/:stepId", async (req, res) => {
  try {
    const { stepId } = req.params;
    const opportunityId = req.params.id;
    const step = await prisma.opportunityActionPlanStep.findFirst({
      where: { id: stepId, opportunityId },
    });
    if (!step) return res.status(404).json({ error: "Action plan step not found" });
    await createAuditLog(opportunityId, "action_plan_step", stepId, "deleted", {
      stepNumber: step.sequenceOrder + 1,
    });
    await prisma.opportunityActionPlanStep.delete({ where: { id: stepId } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete action plan step" });
  }
});

opportunityRoutes.get("/:id/waterfall", async (req, res) => {
  try {
    const opportunityId = req.params.id;
    const opp = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { actionPlanSteps: { orderBy: { sequenceOrder: "asc" } } },
    });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });

    const versions = await prisma.opportunityVersion.findMany({
      where: { opportunityId },
      orderBy: { createdAt: "asc" },
    });

    const actual: {
      date: string;
      opportunityLevel: number;
      likelihood: number;
      impact: number;
      source: string;
      isOriginal: boolean;
    }[] = [];
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i];
      const s = v.snapshot as { likelihood?: number; impact?: number };
      const lik = s.likelihood ?? 3;
      const imp = s.impact ?? 3;
      actual.push({
        date: (v.createdAt as Date).toISOString(),
        opportunityLevel: getNumericalOpportunityLevel(lik, imp),
        likelihood: lik,
        impact: imp,
        source: "opportunity_update",
        isOriginal: i === 0,
      });
    }
    for (const step of opp.actionPlanSteps) {
      if (step.actualCompletedAt && step.actualLikelihood != null && step.actualImpact != null) {
        const al = Math.max(1, Math.min(5, step.actualLikelihood));
        const ai = Math.max(1, Math.min(5, step.actualImpact));
        actual.push({
          date: (step.actualCompletedAt as Date).toISOString(),
          opportunityLevel: getNumericalOpportunityLevel(al, ai),
          likelihood: al,
          impact: ai,
          source: "action_plan_step",
          isOriginal: false,
        });
      }
    }

    const planned: {
      date: string;
      opportunityLevel: number;
      likelihood: number;
      impact: number;
      plannedAction?: string;
    }[] = [];
    for (const step of opp.actionPlanSteps) {
      const endDate = step.estimatedEndDate ?? step.estimatedStartDate;
      if (endDate) {
        planned.push({
          date: (endDate as Date).toISOString(),
          opportunityLevel: step.expectedOpportunityLevel,
          likelihood: step.expectedLikelihood,
          impact: step.expectedImpact,
          plannedAction: step.plannedAction,
        });
      }
    }
    actual.sort((a, b) => a.date.localeCompare(b.date));
    planned.sort((a, b) => a.date.localeCompare(b.date));

    res.json({ planned, actual });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch waterfall data" });
  }
});

opportunityRoutes.get("/:id", async (req, res) => {
  try {
    const opp = await prisma.opportunity.findUnique({
      where: { id: req.params.id },
      include: {
        organizationalUnit: { include: { legalEntity: true } },
        actionPlanSteps: { orderBy: { sequenceOrder: "asc" } },
      },
    });
    if (!opp) return res.status(404).json({ error: "Opportunity not found" });
    const v1 = await prisma.opportunityVersion.findFirst({
      where: { opportunityId: opp.id, version: 1 },
      select: { snapshot: true },
    });
    const orig = v1 ? getOriginalFromVersion(v1.snapshot) : null;
    if (orig) {
      (opp as { originalLikelihood: number; originalImpact: number }).originalLikelihood = orig.originalLikelihood;
      (opp as { originalLikelihood: number; originalImpact: number }).originalImpact = orig.originalImpact;
    }
    if (STATUS_REQUIRING_RATIONALE.includes(opp.status)) {
      const latestWithRationale = await prisma.opportunityVersion.findFirst({
        where: { opportunityId: opp.id, statusChangeRationale: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { statusChangeRationale: true },
      });
      if (latestWithRationale?.statusChangeRationale) {
        (opp as { statusChangeRationale?: string }).statusChangeRationale = latestWithRationale.statusChangeRationale;
      }
    }
    res.json(opp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch opportunity" });
  }
});

opportunityRoutes.post("/", async (req, res) => {
  try {
    if ("originalLikelihood" in req.body || "originalImpact" in req.body) {
      return res.status(400).json({
        error: "Do not send originalLikelihood or originalImpact. They are set from the initial likelihood and impact.",
      });
    }
    const {
      organizationalUnitId,
      opportunityName,
      opportunityCondition,
      opportunityIf,
      opportunityThen,
      category,
      likelihood,
      impact,
      owner,
      status,
    } = req.body;

    if (!organizationalUnitId || !opportunityName || !opportunityCondition || !opportunityIf || !opportunityThen) {
      return res.status(400).json({
        error: "organizationalUnitId, opportunityName, opportunityCondition, opportunityIf, and opportunityThen are required",
      });
    }

    const cat = await resolveOpportunityCategoryCode(category);
    const lik = Math.max(1, Math.min(5, likelihood ?? 3));
    const imp = Math.max(1, Math.min(5, impact ?? 3));
    const opportunityLevel = getOpportunityLevel(lik, imp);
    const newStatus = status ?? "pursue_now";

    const opp = await prisma.$transaction(async (tx) => {
      const o = await tx.opportunity.create({
        data: {
          organizationalUnitId,
          opportunityName,
          opportunityCondition,
          opportunityIf,
          opportunityThen,
          category: cat,
          originalLikelihood: lik,
          originalImpact: imp,
          likelihood: lik,
          impact: imp,
          opportunityLevel,
          owner: owner ?? null,
          status: newStatus,
        },
        include: {
          organizationalUnit: { select: { id: true, name: true, type: true } },
        },
      });
      await createOpportunityVersion(o.id, o, undefined, tx);
      return o;
    });

    await createAuditLog(opp.id, "opportunity", opp.id, "created");
    res.status(201).json(opp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create opportunity" });
  }
});

const OPP_FIELDS_FOR_AUDIT = [
  "opportunityName", "opportunityCondition", "opportunityIf", "opportunityThen",
  "category", "likelihood", "impact", "owner", "status",
] as const;

opportunityRoutes.patch("/:id", async (req, res) => {
  try {
    if ("originalLikelihood" in req.body || "originalImpact" in req.body) {
      return res.status(400).json({
        error: "originalLikelihood and originalImpact cannot be changed. If incorrect, delete the opportunity and create a new one.",
      });
    }
    const {
      opportunityName,
      opportunityCondition,
      opportunityIf,
      opportunityThen,
      category,
      likelihood,
      impact,
      owner,
      status,
      likelihoodChangeReason,
      impactChangeReason,
      statusChangeRationale,
    } = req.body;

    const existing = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Opportunity not found" });

    const newStatus = status !== undefined ? status : existing.status;
    const statusChangingToDeferOrReject =
      STATUS_REQUIRING_RATIONALE.includes(newStatus) && newStatus !== existing.status;
    if (
      statusChangingToDeferOrReject &&
      (typeof statusChangeRationale !== "string" || !statusChangeRationale.trim())
    ) {
      return res.status(400).json({
        error: "statusChangeRationale is required when setting status to Defer, Reevaluate, or Reject",
      });
    }

    const cat =
      category !== undefined ? (await resolveOpportunityCategoryCode(category)) ?? existing.category : existing.category;
    const lik = likelihood !== undefined ? Math.max(1, Math.min(5, Number(likelihood))) : existing.likelihood;
    const imp = impact !== undefined ? Math.max(1, Math.min(5, Number(impact))) : existing.impact;

    const lChanged = lik !== existing.likelihood;
    const iChanged = imp !== existing.impact;
    if (lChanged && (typeof likelihoodChangeReason !== "string" || !likelihoodChangeReason.trim())) {
      return res.status(400).json({ error: "likelihoodChangeReason is required when likelihood changes" });
    }
    if (iChanged && (typeof impactChangeReason !== "string" || !impactChangeReason.trim())) {
      return res.status(400).json({ error: "impactChangeReason is required when impact changes" });
    }

    const opportunityLevel = getOpportunityLevel(lik, imp);

    const opp = await prisma.opportunity.update({
      where: { id: req.params.id },
      data: {
        opportunityName: opportunityName ?? existing.opportunityName,
        opportunityCondition: opportunityCondition ?? existing.opportunityCondition,
        opportunityIf: opportunityIf ?? existing.opportunityIf,
        opportunityThen: opportunityThen ?? existing.opportunityThen,
        category: cat,
        likelihood: lik,
        impact: imp,
        opportunityLevel,
        owner: owner ?? existing.owner,
        status: status ?? existing.status,
      },
      include: {
        organizationalUnit: { select: { id: true, name: true, type: true } },
      },
    });

    await createOpportunityVersion(opp.id, opp, {
      likelihoodChangeReason: lChanged ? likelihoodChangeReason.trim() : null,
      impactChangeReason: iChanged ? impactChangeReason.trim() : null,
      statusChangeRationale: statusChangingToDeferOrReject ? statusChangeRationale?.trim() ?? null : null,
    });

    const changes: Record<string, AuditChange> = {};
    for (const k of OPP_FIELDS_FOR_AUDIT) {
      const oldVal = (existing as Record<string, unknown>)[k];
      const newVal = (opp as Record<string, unknown>)[k];
      if (oldVal !== newVal) {
        changes[k] = { from: auditValue(oldVal), to: auditValue(newVal) };
      }
    }
    const changedFields = Object.keys(changes);
    await createAuditLog(opp.id, "opportunity", opp.id, "updated", {
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
      likelihoodChangeReason: lChanged && likelihoodChangeReason?.trim() ? likelihoodChangeReason.trim() : undefined,
      impactChangeReason: iChanged && impactChangeReason?.trim() ? impactChangeReason.trim() : undefined,
      statusChangeRationale:
        statusChangingToDeferOrReject && statusChangeRationale?.trim() ? statusChangeRationale.trim() : undefined,
    });

    res.json(opp);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update opportunity" });
  }
});

opportunityRoutes.delete("/:id", async (req, res) => {
  try {
    const opportunityId = req.params.id;
    await createAuditLog(opportunityId, "opportunity", opportunityId, "deleted");
    await prisma.opportunity.delete({ where: { id: opportunityId } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete opportunity" });
  }
});
