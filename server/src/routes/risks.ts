import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getRiskLevel, getNumericalRiskLevel } from "../lib/riskLevel.js";

export const riskRoutes = Router();

async function resolveCategoryCode(code: string | null | undefined): Promise<string | null> {
  if (code == null || typeof code !== "string" || !code.trim()) return null;
  const cat = await prisma.category.findUnique({ where: { code: code.trim() }, select: { code: true } });
  return cat?.code ?? null;
}

function toSnapshot(risk: {
  riskName: string;
  riskCondition: string;
  riskIf: string;
  riskThen: string;
  category: string | null;
  likelihood: number;
  consequence: number;
  riskLevel: string | null;
  mitigationStrategy: string | null;
  mitigationPlan: string | null;
  owner: string | null;
  status: string;
}) {
  return {
    riskName: risk.riskName,
    riskCondition: risk.riskCondition,
    riskIf: risk.riskIf,
    riskThen: risk.riskThen,
    category: risk.category,
    likelihood: risk.likelihood,
    consequence: risk.consequence,
    riskLevel: risk.riskLevel,
    mitigationStrategy: risk.mitigationStrategy,
    mitigationPlan: risk.mitigationPlan,
    owner: risk.owner,
    status: risk.status,
  };
}

type PrismaClientLike = Pick<typeof prisma, "riskVersion">;

/** Persist a new risk version for audit/history. Call after every risk create and update. Use tx when inside a transaction. */
async function createRiskVersion(
  riskId: string,
  risk: Parameters<typeof toSnapshot>[0],
  options?: { likelihoodChangeReason?: string | null; consequenceChangeReason?: string | null; statusChangeRationale?: string | null },
  tx?: PrismaClientLike
) {
  const db = tx ?? prisma;
  const count = await db.riskVersion.count({ where: { riskId } });
  const version = count + 1;
  const snapshot = toSnapshot(risk);
  await db.riskVersion.create({
    data: {
      riskId,
      version,
      snapshot,
      likelihoodChangeReason: options?.likelihoodChangeReason ?? null,
      consequenceChangeReason: options?.consequenceChangeReason ?? null,
      statusChangeRationale: options?.statusChangeRationale ?? null,
    },
  });
}

function toStepSnapshot(step: {
  mitigationActions: string;
  closureCriteria: string;
  estimatedStartDate: Date | null;
  estimatedEndDate: Date | null;
  expectedLikelihood: number;
  expectedConsequence: number;
  actualLikelihood: number | null;
  actualConsequence: number | null;
  actualCompletedAt: Date | null;
}) {
  return {
    mitigationActions: step.mitigationActions,
    closureCriteria: step.closureCriteria,
    estimatedStartDate: step.estimatedStartDate?.toISOString() ?? null,
    estimatedEndDate: step.estimatedEndDate?.toISOString() ?? null,
    expectedLikelihood: step.expectedLikelihood,
    expectedConsequence: step.expectedConsequence,
    actualLikelihood: step.actualLikelihood,
    actualConsequence: step.actualConsequence,
    actualCompletedAt: step.actualCompletedAt?.toISOString() ?? null,
  };
}

async function createMitigationStepVersion(stepId: string, step: Parameters<typeof toStepSnapshot>[0]) {
  const count = await prisma.mitigationStepVersion.count({ where: { mitigationStepId: stepId } });
  await prisma.mitigationStepVersion.create({
    data: {
      mitigationStepId: stepId,
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
  consequenceChangeReason?: string;
  statusChangeRationale?: string;
};

/** Serialize a value for audit storage (Date → ISO string) so JSON is consistent. */
function auditValue(val: unknown): unknown {
  if (val instanceof Date) return val.toISOString();
  return val;
}

async function createAuditLog(
  riskId: string,
  entityType: "risk" | "mitigation_step",
  entityId: string,
  action: "created" | "updated" | "deleted",
  details?: AuditDetails
) {
  await prisma.riskAuditLog.create({
    data: {
      riskId,
      entityType,
      entityId,
      action,
      details: details ?? undefined,
    },
  });
}

/** Serialize createdAt from Prisma (Date or string) to ISO string for API response. */
function toCreatedAtISO(val: Date | string | unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return new Date(val as string).toISOString();
}

/** Get original L×C from version 1 (creation). Version history is the source of truth; DB may have wrong values from migration backfill. */
function getOriginalFromVersion(snapshot: unknown): { originalLikelihood: number; originalConsequence: number } | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as { likelihood?: number; consequence?: number };
  const l = s.likelihood;
  const c = s.consequence;
  if (typeof l !== "number" || typeof c !== "number") return null;
  return {
    originalLikelihood: Math.max(1, Math.min(5, l)),
    originalConsequence: Math.max(1, Math.min(5, c)),
  };
}

riskRoutes.get("/", async (req, res) => {
  try {
    const { organizationalUnitId } = req.query;
    if (typeof organizationalUnitId !== "string") {
      return res.status(400).json({ error: "organizationalUnitId is required" });
    }

    const risks = await prisma.risk.findMany({
      where: { organizationalUnitId },
      orderBy: { updatedAt: "desc" },
      include: {
        organizationalUnit: {
          select: { id: true, name: true, type: true, legalEntity: { select: { name: true } } },
        },
        mitigationSteps: { select: { updatedAt: true } },
      },
    });
    if (risks.length > 0) {
      const v1s = await prisma.riskVersion.findMany({
        where: { riskId: { in: risks.map((r) => r.id) }, version: 1 },
        select: { riskId: true, snapshot: true },
      });
      const origByRiskId = new Map<string, { originalLikelihood: number; originalConsequence: number }>();
      for (const v of v1s) {
        const orig = getOriginalFromVersion(v.snapshot);
        if (orig) origByRiskId.set(v.riskId, orig);
      }
      const closedAcceptedIds = risks.filter((r) => r.status === "closed" || r.status === "accepted").map((r) => r.id);
      let rationaleByRiskId = new Map<string, string>();
      if (closedAcceptedIds.length > 0) {
        const versionsWithRationale = await prisma.riskVersion.findMany({
          where: { riskId: { in: closedAcceptedIds }, statusChangeRationale: { not: null } },
          orderBy: { createdAt: "desc" },
          select: { riskId: true, statusChangeRationale: true },
        });
        for (const v of versionsWithRationale) {
          if (v.statusChangeRationale && !rationaleByRiskId.has(v.riskId)) {
            rationaleByRiskId.set(v.riskId, v.statusChangeRationale);
          }
        }
      }
      for (const r of risks) {
        const orig = origByRiskId.get(r.id);
        if (orig) {
          (r as { originalLikelihood: number; originalConsequence: number }).originalLikelihood = orig.originalLikelihood;
          (r as { originalLikelihood: number; originalConsequence: number }).originalConsequence = orig.originalConsequence;
        }
        const rationale = rationaleByRiskId.get(r.id);
        if (rationale) (r as { statusChangeRationale?: string }).statusChangeRationale = rationale;
      }
    }
    const withLastUpdated = risks.map((r) => {
      const steps = r.mitigationSteps ?? [];
      const lastMs =
        steps.length > 0
          ? Math.max(new Date(r.updatedAt).getTime(), ...steps.map((s) => new Date(s.updatedAt).getTime()))
          : new Date(r.updatedAt).getTime();
      const { mitigationSteps: _s, ...rest } = r;
      return { ...rest, lastUpdated: new Date(lastMs).toISOString() };
    });
    res.json(withLastUpdated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch risks" });
  }
});

// Fix original L×C from version history (corrects bad migration backfill that used current instead of creation)
riskRoutes.post("/fix-originals", async (_req, res) => {
  try {
    const risks = await prisma.risk.findMany({ select: { id: true } });
    const v1s = await prisma.riskVersion.findMany({
      where: { riskId: { in: risks.map((r) => r.id) }, version: 1 },
      select: { riskId: true, snapshot: true },
    });
    let fixed = 0;
    for (const v of v1s) {
      const orig = getOriginalFromVersion(v.snapshot);
      if (!orig) continue;
      await prisma.$executeRaw`UPDATE "Risk" SET "originalLikelihood" = ${orig.originalLikelihood}, "originalConsequence" = ${orig.originalConsequence} WHERE id = ${v.riskId}`;
      fixed++;
    }
    res.json({ message: `Fixed original L×C for ${fixed} risk(s) from version history` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("fix-originals failed:", err);
    res.status(500).json({ error: "Failed to fix originals", detail: message });
  }
});

// Backfill mitigation step versions for existing steps (creates v1 from current state)
riskRoutes.post("/backfill-step-versions", async (_req, res) => {
  try {
    const steps = await prisma.mitigationStep.findMany();
    let created = 0;
    for (const step of steps) {
      const count = await prisma.mitigationStepVersion.count({ where: { mitigationStepId: step.id } });
      if (count === 0) {
        await createMitigationStepVersion(step.id, step);
        created++;
      }
    }
    res.json({ message: `Created initial version for ${created} mitigation step(s)` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to backfill step versions" });
  }
});

// Backfill versions for risks that don't have any (e.g. after migration)
riskRoutes.post("/backfill-versions", async (_req, res) => {
  try {
    const risks = await prisma.risk.findMany();
    let created = 0;
    for (const risk of risks) {
      const count = await prisma.riskVersion.count({ where: { riskId: risk.id } });
      if (count === 0) {
        await createRiskVersion(risk.id, risk);
        created++;
      }
    }
    res.json({ message: `Created ${created} initial version(s) for risks without history` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to backfill versions" });
  }
});

// Waterfall data route MUST be before /:id (else "waterfall" matches :id)
// Returns version events with numerical risk level (1-25) per L,C
riskRoutes.get("/waterfall/data", async (req, res) => {
  try {
    const { organizationalUnitId } = req.query;
    if (typeof organizationalUnitId !== "string") {
      return res.status(400).json({ error: "organizationalUnitId is required" });
    }

    const risks = await prisma.risk.findMany({
      where: { organizationalUnitId },
      select: { id: true },
    });

    const allVersions: { date: string; riskId: string; riskLevelNumerical: number; version: number }[] = [];
    for (const r of risks) {
      const versions = await prisma.riskVersion.findMany({
        where: { riskId: r.id },
        orderBy: { createdAt: "asc" },
      });
      for (const v of versions) {
        const s = v.snapshot as { likelihood?: number; consequence?: number };
        const lik = s.likelihood ?? 3;
        const cons = s.consequence ?? 3;
        const rl = getNumericalRiskLevel(lik, cons);
        allVersions.push({
          date: (v.createdAt as Date).toISOString(),
          riskId: r.id,
          riskLevelNumerical: rl,
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

// Audit log: every create/update/delete on risk and mitigation steps. Must be before GET /:id.
riskRoutes.get("/:id/audit-log", async (req, res) => {
  try {
    const { id } = req.params;
    const risk = await prisma.risk.findUnique({ where: { id }, select: { id: true } });
    if (!risk) return res.status(404).json({ error: "Risk not found" });

    const logs = await prisma.riskAuditLog.findMany({
      where: { riskId: id },
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

// Version history for risk + mitigation steps (History tab). Must be first GET with :id so /:id/history is never matched by GET /:id.
riskRoutes.get("/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    const riskExists = await prisma.risk.findUnique({ where: { id }, select: { id: true } });
    if (!riskExists) return res.status(404).json({ error: "Risk not found" });

    const { at: atParam } = req.query;
    const at = typeof atParam === "string" ? new Date(atParam) : null;

    let riskVersions = await prisma.riskVersion.findMany({
      where: { riskId: id },
      orderBy: { createdAt: "asc" },
    });

    // Backfill: if risk exists but has no versions (e.g. created before versioning), create v1 from current state.
    if (riskVersions.length === 0) {
      const fullRisk = await prisma.risk.findUnique({ where: { id } });
      if (fullRisk) {
        try {
          const snapshot = {
            riskName: fullRisk.riskName,
            riskCondition: fullRisk.riskCondition,
            riskIf: fullRisk.riskIf,
            riskThen: fullRisk.riskThen,
            category: fullRisk.category,
            likelihood: fullRisk.likelihood,
            consequence: fullRisk.consequence,
            riskLevel: fullRisk.riskLevel,
            mitigationStrategy: fullRisk.mitigationStrategy,
            mitigationPlan: fullRisk.mitigationPlan,
            owner: fullRisk.owner,
            status: fullRisk.status,
          };
          await prisma.riskVersion.create({
            data: {
              riskId: id,
              version: 1,
              snapshot,
              likelihoodChangeReason: null,
              consequenceChangeReason: null,
              statusChangeRationale: null,
            },
          });
          riskVersions = await prisma.riskVersion.findMany({
            where: { riskId: id },
            orderBy: { createdAt: "asc" },
          });
        } catch (backfillErr) {
          console.error("History backfill failed for risk", id, backfillErr);
        }
      }
      // If we still have no versions (e.g. backfill failed), return a synthetic v1 so the UI shows "Risk created"
      if (riskVersions.length === 0 && fullRisk) {
        const snapshot = {
          riskName: fullRisk.riskName,
          riskCondition: fullRisk.riskCondition,
          riskIf: fullRisk.riskIf,
          riskThen: fullRisk.riskThen,
          category: fullRisk.category,
          likelihood: fullRisk.likelihood,
          consequence: fullRisk.consequence,
          riskLevel: fullRisk.riskLevel,
          mitigationStrategy: fullRisk.mitigationStrategy,
          mitigationPlan: fullRisk.mitigationPlan,
          owner: fullRisk.owner,
          status: fullRisk.status,
        };
        riskVersions = [{
          id: "",
          riskId: id,
          version: 1,
          snapshot,
          likelihoodChangeReason: null,
          consequenceChangeReason: null,
          statusChangeRationale: null,
          createdAt: fullRisk.createdAt,
        } as (typeof riskVersions)[0]];
      }
    }

    if (at) {
      const versionAt = riskVersions.filter((v) => new Date(v.createdAt) <= at);
      const latest = versionAt[versionAt.length - 1];
      if (!latest) return res.status(404).json({ error: "No version at that date" });
      return res.json({ type: "risk", version: latest.version, snapshot: latest.snapshot, createdAt: toCreatedAtISO(latest.createdAt) });
    }

    const steps = await prisma.mitigationStep.findMany({
      where: { riskId: id },
      orderBy: { sequenceOrder: "asc" },
      include: { versions: { orderBy: { createdAt: "asc" } } },
    });

    const riskEntries = riskVersions.map((v) => ({
      type: "risk" as const,
      version: v.version,
      snapshot: v.snapshot,
      statusChangeRationale: v.statusChangeRationale ?? undefined,
      createdAt: toCreatedAtISO(v.createdAt),
    }));

    const stepEntries = steps.flatMap((s) =>
      s.versions.map((v) => ({
        type: "mitigation_step" as const,
        stepId: s.id,
        stepNumber: s.sequenceOrder + 1,
        version: v.version,
        snapshot: v.snapshot,
        createdAt: toCreatedAtISO(v.createdAt),
      }))
    );

    const merged = [...riskEntries, ...stepEntries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch risk history" });
  }
});

// Mitigation steps (must be before /:id)
riskRoutes.patch("/:id/mitigation-steps/reorder", async (req, res) => {
  try {
    const riskId = req.params.id;
    const { stepIds } = req.body;
    if (!Array.isArray(stepIds) || stepIds.length === 0) {
      return res.status(400).json({ error: "stepIds array is required" });
    }
    const stepsBefore = await prisma.mitigationStep.findMany({
      where: { riskId },
      orderBy: { sequenceOrder: "asc" },
      select: { id: true },
    });
    const fromOrder = stepsBefore.map((_, i) => i + 1).join(", ");

    const updates = stepIds.map((id: string, i: number) =>
      prisma.mitigationStep.updateMany({
        where: { id, riskId },
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

    await createAuditLog(riskId, "risk", riskId, "updated", {
      changedFields: ["mitigationStepsReordered"],
      changes: { mitigationStepsReordered: { from: fromOrder, to: toOrder } },
    });
    const steps = await prisma.mitigationStep.findMany({
      where: { riskId },
      orderBy: { sequenceOrder: "asc" },
    });
    res.json(steps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reorder steps" });
  }
});

riskRoutes.get("/:id/mitigation-steps", async (req, res) => {
  try {
    const steps = await prisma.mitigationStep.findMany({
      where: { riskId: req.params.id },
      orderBy: { sequenceOrder: "asc" },
    });
    res.json(steps);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch mitigation steps" });
  }
});

riskRoutes.post("/:id/mitigation-steps", async (req, res) => {
  try {
    const riskId = req.params.id;
    const {
      sequenceOrder,
      mitigationActions,
      closureCriteria,
      estimatedStartDate,
      estimatedEndDate,
      expectedLikelihood,
      expectedConsequence,
      actualLikelihood,
      actualConsequence,
      actualCompletedAt,
    } = req.body;
    if (!mitigationActions || !closureCriteria || expectedLikelihood == null || expectedConsequence == null) {
      return res.status(400).json({ error: "mitigationActions, closureCriteria, expectedLikelihood, and expectedConsequence are required" });
    }
    const el = Math.max(1, Math.min(5, Number(expectedLikelihood)));
    const ec = Math.max(1, Math.min(5, Number(expectedConsequence)));
    const expectedRiskLevel = getNumericalRiskLevel(el, ec);
    const al = actualLikelihood != null && actualConsequence != null
      ? Math.max(1, Math.min(5, Number(actualLikelihood)))
      : null;
    const ac = actualLikelihood != null && actualConsequence != null
      ? Math.max(1, Math.min(5, Number(actualConsequence)))
      : null;
    const actualRiskLevel = al != null && ac != null ? getNumericalRiskLevel(al, ac) : null;
    const step = await prisma.mitigationStep.create({
      data: {
        riskId,
        sequenceOrder: sequenceOrder ?? 0,
        mitigationActions,
        closureCriteria,
        estimatedStartDate: estimatedStartDate ? new Date(estimatedStartDate) : null,
        estimatedEndDate: estimatedEndDate ? new Date(estimatedEndDate) : null,
        expectedLikelihood: el,
        expectedConsequence: ec,
        expectedRiskLevel,
        actualLikelihood: al,
        actualConsequence: ac,
        actualRiskLevel,
        actualCompletedAt: actualCompletedAt ? new Date(actualCompletedAt) : null,
      },
    });
    await createMitigationStepVersion(step.id, step);
    await createAuditLog(riskId, "mitigation_step", step.id, "created", { stepNumber: (step.sequenceOrder ?? 0) + 1 });
    res.status(201).json(step);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create mitigation step" });
  }
});

riskRoutes.patch("/:id/mitigation-steps/:stepId", async (req, res) => {
  try {
    const { stepId } = req.params;
    const step = await prisma.mitigationStep.findFirst({
      where: { id: stepId, riskId: req.params.id },
    });
    if (!step) return res.status(404).json({ error: "Mitigation step not found" });
    const s = step as { expectedLikelihood: number; expectedConsequence: number; actualLikelihood: number | null; actualConsequence: number | null };
    const {
      sequenceOrder,
      mitigationActions,
      closureCriteria,
      estimatedStartDate,
      estimatedEndDate,
      expectedLikelihood,
      expectedConsequence,
      actualLikelihood,
      actualConsequence,
      actualCompletedAt,
    } = req.body;
    const data: Record<string, unknown> = {};
    if (sequenceOrder !== undefined) data.sequenceOrder = sequenceOrder;
    if (mitigationActions !== undefined) data.mitigationActions = mitigationActions;
    if (closureCriteria !== undefined) data.closureCriteria = closureCriteria;
    if (estimatedStartDate !== undefined) data.estimatedStartDate = estimatedStartDate ? new Date(estimatedStartDate) : null;
    if (estimatedEndDate !== undefined) data.estimatedEndDate = estimatedEndDate ? new Date(estimatedEndDate) : null;
    const el = expectedLikelihood !== undefined ? Math.max(1, Math.min(5, Number(expectedLikelihood))) : s.expectedLikelihood;
    const ec = expectedConsequence !== undefined ? Math.max(1, Math.min(5, Number(expectedConsequence))) : s.expectedConsequence;
    data.expectedLikelihood = el;
    data.expectedConsequence = ec;
    data.expectedRiskLevel = getNumericalRiskLevel(el, ec);
    const al = actualLikelihood !== undefined ? (actualLikelihood == null ? null : Math.max(1, Math.min(5, Number(actualLikelihood)))) : s.actualLikelihood;
    const ac = actualConsequence !== undefined ? (actualConsequence == null ? null : Math.max(1, Math.min(5, Number(actualConsequence)))) : s.actualConsequence;
    data.actualLikelihood = al ?? null;
    data.actualConsequence = ac ?? null;
    data.actualRiskLevel = al != null && ac != null ? getNumericalRiskLevel(al, ac) : null;
    if (actualCompletedAt !== undefined) data.actualCompletedAt = actualCompletedAt ? new Date(actualCompletedAt) : null;
    const updated = await prisma.mitigationStep.update({
      where: { id: stepId },
      data,
    });
    await createMitigationStepVersion(updated.id, updated);

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
    await createAuditLog(req.params.id, "mitigation_step", stepId, "updated", {
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
      stepNumber: updated.sequenceOrder + 1,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update mitigation step" });
  }
});

riskRoutes.delete("/:id/mitigation-steps/:stepId", async (req, res) => {
  try {
    const { stepId } = req.params;
    const riskId = req.params.id;
    const step = await prisma.mitigationStep.findFirst({
      where: { id: stepId, riskId },
    });
    if (!step) return res.status(404).json({ error: "Mitigation step not found" });
    await createAuditLog(riskId, "mitigation_step", stepId, "deleted", { stepNumber: step.sequenceOrder + 1 });
    await prisma.mitigationStep.delete({ where: { id: stepId } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete mitigation step" });
  }
});

// Per-risk waterfall: planned (from mitigation steps) + actual (from version history + step completions)
riskRoutes.get("/:id/waterfall", async (req, res) => {
  try {
    const riskId = req.params.id;
    const risk = await prisma.risk.findUnique({
      where: { id: riskId },
      include: { mitigationSteps: { orderBy: { sequenceOrder: "asc" } } },
    });
    if (!risk) return res.status(404).json({ error: "Risk not found" });

    const versions = await prisma.riskVersion.findMany({
      where: { riskId },
      orderBy: { createdAt: "asc" },
    });

    // Actual = risk version history (Original at creation, Current at updates) + completed mitigation steps.
    const actual: { date: string; riskLevel: number; likelihood: number; consequence: number; source: string; isOriginal: boolean }[] = [];
    for (let i = 0; i < versions.length; i++) {
      const v = versions[i];
      const s = v.snapshot as { likelihood?: number; consequence?: number };
      const lik = s.likelihood ?? 3;
      const cons = s.consequence ?? 3;
      actual.push({
        date: (v.createdAt as Date).toISOString(),
        riskLevel: getNumericalRiskLevel(lik, cons),
        likelihood: lik,
        consequence: cons,
        source: "risk_update",
        isOriginal: i === 0,
      });
    }
    for (const step of risk.mitigationSteps) {
      if (step.actualCompletedAt && step.actualLikelihood != null && step.actualConsequence != null) {
        const al = Math.max(1, Math.min(5, step.actualLikelihood));
        const ac = Math.max(1, Math.min(5, step.actualConsequence));
        actual.push({
          date: (step.actualCompletedAt as Date).toISOString(),
          riskLevel: getNumericalRiskLevel(al, ac),
          likelihood: al,
          consequence: ac,
          source: "mitigation_step",
          isOriginal: false,
        });
      }
    }

    // Planned = mitigation steps only. Not initial risk/version state.
    const steps = risk.mitigationSteps;
    const planned: { date: string; riskLevel: number; likelihood: number; consequence: number; mitigationActions?: string }[] = [];
    for (const step of steps) {
      const endDate = step.estimatedEndDate ?? step.estimatedStartDate;
      if (endDate) {
        planned.push({
          date: (endDate as Date).toISOString(),
          riskLevel: step.expectedRiskLevel,
          likelihood: step.expectedLikelihood,
          consequence: step.expectedConsequence,
          mitigationActions: step.mitigationActions,
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

riskRoutes.get("/:id", async (req, res) => {
  try {
    const risk = await prisma.risk.findUnique({
      where: { id: req.params.id },
      include: {
        organizationalUnit: {
          include: { legalEntity: true },
        },
        mitigationSteps: { orderBy: { sequenceOrder: "asc" } },
      },
    });
    if (!risk) return res.status(404).json({ error: "Risk not found" });
    const v1 = await prisma.riskVersion.findFirst({
      where: { riskId: risk.id, version: 1 },
      select: { snapshot: true },
    });
    const orig = v1 ? getOriginalFromVersion(v1.snapshot) : null;
    if (orig) {
      (risk as { originalLikelihood: number; originalConsequence: number }).originalLikelihood = orig.originalLikelihood;
      (risk as { originalLikelihood: number; originalConsequence: number }).originalConsequence = orig.originalConsequence;
    }
    if (risk.status === "closed" || risk.status === "accepted") {
      const latestWithRationale = await prisma.riskVersion.findFirst({
        where: { riskId: risk.id, statusChangeRationale: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { statusChangeRationale: true },
      });
      if (latestWithRationale?.statusChangeRationale) {
        (risk as { statusChangeRationale?: string }).statusChangeRationale = latestWithRationale.statusChangeRationale;
      }
    }
    res.json(risk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch risk" });
  }
});

riskRoutes.post("/", async (req, res) => {
  try {
    // Original L×C is derived from initial likelihood/consequence; never accept from client.
    if ("originalLikelihood" in req.body || "originalConsequence" in req.body) {
      return res.status(400).json({ error: "Do not send originalLikelihood or originalConsequence. They are set from the initial likelihood and consequence." });
    }
    const {
      organizationalUnitId,
      riskName,
      riskCondition,
      riskIf,
      riskThen,
      category,
      likelihood,
      consequence,
      mitigationStrategy,
      mitigationPlan,
      owner,
      status,
    } = req.body;

    if (!organizationalUnitId || !riskName || !riskCondition || !riskIf || !riskThen) {
      return res.status(400).json({ error: "organizationalUnitId, riskName, riskCondition, riskIf, and riskThen are required" });
    }

    const cat = await resolveCategoryCode(category);
    const lik = Math.max(1, Math.min(5, likelihood ?? 3));
    const cons = Math.max(1, Math.min(5, consequence ?? 3));
    const riskLevel = getRiskLevel(lik, cons);

    // Create risk and v1 in a single transaction so we never have a risk without history.
    const risk = await prisma.$transaction(async (tx) => {
      const r = await tx.risk.create({
        data: {
          organizationalUnitId,
          riskName,
          riskCondition,
          riskIf,
          riskThen,
          category: cat,
          originalLikelihood: lik,
          originalConsequence: cons,
          likelihood: lik,
          consequence: cons,
          riskLevel,
          mitigationStrategy: mitigationStrategy ?? null,
          mitigationPlan: mitigationPlan ?? null,
          owner: owner ?? null,
          status: status ?? "open",
        },
        include: {
          organizationalUnit: {
            select: { id: true, name: true, type: true },
          },
        },
      });
      await createRiskVersion(r.id, r, undefined, tx);
      return r;
    });

    await createAuditLog(risk.id, "risk", risk.id, "created");
    res.status(201).json(risk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create risk" });
  }
});

const RISK_FIELDS_FOR_AUDIT = [
  "riskName", "riskCondition", "riskIf", "riskThen", "category",
  "likelihood", "consequence", "mitigationStrategy", "mitigationPlan", "owner", "status",
] as const;

riskRoutes.patch("/:id", async (req, res) => {
  try {
    // Original L×C is immutable. Reject any attempt to change it.
    if ("originalLikelihood" in req.body || "originalConsequence" in req.body) {
      return res.status(400).json({ error: "originalLikelihood and originalConsequence cannot be changed. If incorrect, delete the risk and create a new one." });
    }
    const {
      riskName,
      riskCondition,
      riskIf,
      riskThen,
      category,
      likelihood,
      consequence,
      mitigationStrategy,
      mitigationPlan,
      owner,
      status,
      likelihoodChangeReason,
      consequenceChangeReason,
      statusChangeRationale,
    } = req.body;

    const existing = await prisma.risk.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Risk not found" });

    const newStatus = status !== undefined ? status : existing.status;
    const statusChangingToClosedOrAccepted =
      (newStatus === "closed" || newStatus === "accepted") && newStatus !== existing.status;
    if (statusChangingToClosedOrAccepted && (typeof statusChangeRationale !== "string" || !statusChangeRationale.trim())) {
      return res.status(400).json({
        error: "statusChangeRationale is required when setting status to Closed or Accepted",
      });
    }

    const cat = category !== undefined
      ? (await resolveCategoryCode(category)) ?? existing.category
      : existing.category;
    const lik = likelihood !== undefined ? Math.max(1, Math.min(5, Number(likelihood))) : existing.likelihood;
    const cons = consequence !== undefined ? Math.max(1, Math.min(5, Number(consequence))) : existing.consequence;

    const lChanged = lik !== existing.likelihood;
    const cChanged = cons !== existing.consequence;
    if (lChanged && (typeof likelihoodChangeReason !== "string" || !likelihoodChangeReason.trim())) {
      return res.status(400).json({ error: "likelihoodChangeReason is required when likelihood changes" });
    }
    if (cChanged && (typeof consequenceChangeReason !== "string" || !consequenceChangeReason.trim())) {
      return res.status(400).json({ error: "consequenceChangeReason is required when consequence changes" });
    }

    const riskLevel = getRiskLevel(lik, cons);

    const risk = await prisma.risk.update({
      where: { id: req.params.id },
      data: {
        riskName: riskName ?? existing.riskName,
        riskCondition: riskCondition ?? existing.riskCondition,
        riskIf: riskIf ?? existing.riskIf,
        riskThen: riskThen ?? existing.riskThen,
        category: cat,
        likelihood: lik,
        consequence: cons,
        riskLevel,
        mitigationStrategy: mitigationStrategy ?? existing.mitigationStrategy,
        mitigationPlan: mitigationPlan ?? existing.mitigationPlan,
        owner: owner ?? existing.owner,
        status: status ?? existing.status,
      },
      include: {
        organizationalUnit: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    await createRiskVersion(risk.id, risk, {
      likelihoodChangeReason: lChanged ? likelihoodChangeReason.trim() : null,
      consequenceChangeReason: cChanged ? consequenceChangeReason.trim() : null,
      statusChangeRationale: statusChangingToClosedOrAccepted ? statusChangeRationale.trim() : null,
    });

    const changes: Record<string, AuditChange> = {};
    for (const k of RISK_FIELDS_FOR_AUDIT) {
      const oldVal = (existing as Record<string, unknown>)[k];
      const newVal = (risk as Record<string, unknown>)[k];
      if (oldVal !== newVal) {
        changes[k] = { from: auditValue(oldVal), to: auditValue(newVal) };
      }
    }
    const changedFields = Object.keys(changes);
    await createAuditLog(risk.id, "risk", risk.id, "updated", {
      changedFields: changedFields.length > 0 ? changedFields : undefined,
      changes: Object.keys(changes).length > 0 ? changes : undefined,
      likelihoodChangeReason: lChanged && likelihoodChangeReason?.trim() ? likelihoodChangeReason.trim() : undefined,
      consequenceChangeReason: cChanged && consequenceChangeReason?.trim() ? consequenceChangeReason.trim() : undefined,
      statusChangeRationale: statusChangingToClosedOrAccepted && statusChangeRationale?.trim() ? statusChangeRationale.trim() : undefined,
    });

    res.json(risk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update risk" });
  }
});

riskRoutes.delete("/:id", async (req, res) => {
  try {
    const riskId = req.params.id;
    await createAuditLog(riskId, "risk", riskId, "deleted");
    await prisma.risk.delete({ where: { id: riskId } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete risk" });
  }
});
