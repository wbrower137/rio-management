import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { getRiskLevel, getNumericalRiskLevel } from "../lib/riskLevel.js";

export const riskRoutes = Router();

const VALID_CATEGORIES = ["technical", "schedule", "cost", "other"] as const;

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

async function createRiskVersion(
  riskId: string,
  risk: Parameters<typeof toSnapshot>[0],
  options?: { likelihoodChangeReason?: string | null; consequenceChangeReason?: string | null }
) {
  const count = await prisma.riskVersion.count({ where: { riskId } });
  await prisma.riskVersion.create({
    data: {
      riskId,
      version: count + 1,
      snapshot: toSnapshot(risk),
      likelihoodChangeReason: options?.likelihoodChangeReason ?? null,
      consequenceChangeReason: options?.consequenceChangeReason ?? null,
    },
  });
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
      for (const r of risks) {
        const orig = origByRiskId.get(r.id);
        if (orig) {
          (r as { originalLikelihood: number; originalConsequence: number }).originalLikelihood = orig.originalLikelihood;
          (r as { originalLikelihood: number; originalConsequence: number }).originalConsequence = orig.originalConsequence;
        }
      }
    }
    res.json(risks);
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

// Mitigation steps (must be before /:id)
riskRoutes.patch("/:id/mitigation-steps/reorder", async (req, res) => {
  try {
    const riskId = req.params.id;
    const { stepIds } = req.body;
    if (!Array.isArray(stepIds) || stepIds.length === 0) {
      return res.status(400).json({ error: "stepIds array is required" });
    }
    const updates = stepIds.map((id: string, i: number) =>
      prisma.mitigationStep.updateMany({
        where: { id, riskId },
        data: { sequenceOrder: i },
      })
    );
    await Promise.all(updates);
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
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update mitigation step" });
  }
});

riskRoutes.delete("/:id/mitigation-steps/:stepId", async (req, res) => {
  try {
    const { stepId } = req.params;
    const step = await prisma.mitigationStep.findFirst({
      where: { id: stepId, riskId: req.params.id },
    });
    if (!step) return res.status(404).json({ error: "Mitigation step not found" });
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
    res.json(risk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch risk" });
  }
});

// Version history for waterfall / time-travel
riskRoutes.get("/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    const { at: atParam } = req.query;
    const at = typeof atParam === "string" ? new Date(atParam) : null;

    const versions = await prisma.riskVersion.findMany({
      where: { riskId: id },
      orderBy: { createdAt: "asc" },
    });

    if (at) {
      const versionAt = versions.filter((v) => new Date(v.createdAt) <= at);
      const latest = versionAt[versionAt.length - 1];
      if (!latest) return res.status(404).json({ error: "No version at that date" });
      return res.json({ version: latest.version, snapshot: latest.snapshot, createdAt: latest.createdAt });
    }

    res.json(versions.map((v) => ({ version: v.version, snapshot: v.snapshot, createdAt: v.createdAt })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch risk history" });
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

    const cat = VALID_CATEGORIES.includes(category) ? category : null;
    const lik = Math.max(1, Math.min(5, likelihood ?? 3));
    const cons = Math.max(1, Math.min(5, consequence ?? 3));
    const riskLevel = getRiskLevel(lik, cons);

    const risk = await prisma.risk.create({
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

    await createRiskVersion(risk.id, risk);
    res.status(201).json(risk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create risk" });
  }
});

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
    } = req.body;

    const existing = await prisma.risk.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Risk not found" });

    const cat = category !== undefined
      ? (VALID_CATEGORIES.includes(category) ? category : existing.category)
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
    });
    res.json(risk);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update risk" });
  }
});

riskRoutes.delete("/:id", async (req, res) => {
  try {
    await prisma.risk.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete risk" });
  }
});
