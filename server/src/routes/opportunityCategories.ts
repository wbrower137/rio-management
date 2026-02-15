import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const opportunityCategoryRoutes = Router();

opportunityCategoryRoutes.get("/", async (_req, res) => {
  try {
    const categories = await prisma.opportunityCategory.findMany({
      orderBy: { sortOrder: "asc" },
    });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch opportunity categories" });
  }
});

function slugFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "category";
}

opportunityCategoryRoutes.post("/", async (req, res) => {
  try {
    const { label, sortOrder } = req.body;
    const labelStr = typeof label === "string" && label.trim() ? label.trim() : "";
    if (!labelStr) return res.status(400).json({ error: "Label is required" });

    const all = await prisma.opportunityCategory.findMany({ select: { label: true } });
    if (all.some((c) => c.label.trim().toLowerCase() === labelStr.toLowerCase())) {
      return res.status(400).json({ error: "An opportunity category with this label already exists" });
    }

    const cleanCode = slugFromLabel(labelStr);
    const existingByCode = await prisma.opportunityCategory.findUnique({ where: { code: cleanCode } });
    if (existingByCode) return res.status(400).json({ error: "An opportunity category with this label already exists" });

    const category = await prisma.opportunityCategory.create({
      data: {
        code: cleanCode,
        label: labelStr,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });
    res.status(201).json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create opportunity category" });
  }
});

opportunityCategoryRoutes.patch("/:id", async (req, res) => {
  try {
    const { label, sortOrder } = req.body;
    const existing = await prisma.opportunityCategory.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Opportunity category not found" });

    const data: { label?: string; sortOrder?: number } = {};
    if (typeof label === "string" && label.trim()) {
      const labelStr = label.trim();
      const all = await prisma.opportunityCategory.findMany({ where: { id: { not: req.params.id } }, select: { label: true } });
      if (all.some((c) => c.label.trim().toLowerCase() === labelStr.toLowerCase())) {
        return res.status(400).json({ error: "An opportunity category with this label already exists" });
      }
      data.label = labelStr;
    }
    if (typeof sortOrder === "number") data.sortOrder = sortOrder;

    const category = await prisma.opportunityCategory.update({
      where: { id: req.params.id },
      data,
    });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update opportunity category" });
  }
});

opportunityCategoryRoutes.delete("/:id", async (req, res) => {
  try {
    const category = await prisma.opportunityCategory.findUnique({ where: { id: req.params.id } });
    if (!category) return res.status(404).json({ error: "Opportunity category not found" });

    const opportunitiesWithCategory = await prisma.opportunity.findMany({
      where: { category: category.code },
      select: { id: true, opportunityName: true, organizationalUnitId: true },
      take: 500,
    });

    if (opportunitiesWithCategory.length > 0) {
      return res.status(400).json({
        error: "Cannot delete category while opportunities are assigned to it. Reassign or clear the category for the listed opportunities first.",
        code: category.code,
        opportunities: opportunitiesWithCategory,
      });
    }

    await prisma.opportunityCategory.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete opportunity category" });
  }
});
