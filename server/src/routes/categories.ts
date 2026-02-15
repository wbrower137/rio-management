import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
    });
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

function slugFromLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "category";
}

categoryRoutes.post("/", async (req, res) => {
  try {
    const { label, sortOrder } = req.body;
    const labelStr = typeof label === "string" && label.trim() ? label.trim() : "";
    if (!labelStr) return res.status(400).json({ error: "Label is required" });

    const all = await prisma.category.findMany({ select: { label: true } });
    if (all.some((c) => c.label.trim().toLowerCase() === labelStr.toLowerCase())) {
      return res.status(400).json({ error: "A category with this label already exists" });
    }

    const cleanCode = slugFromLabel(labelStr);
    const existingByCode = await prisma.category.findUnique({ where: { code: cleanCode } });
    if (existingByCode) return res.status(400).json({ error: "A category with this label already exists" });

    const category = await prisma.category.create({
      data: {
        code: cleanCode,
        label: labelStr,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
      },
    });
    res.status(201).json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

categoryRoutes.patch("/:id", async (req, res) => {
  try {
    const { label, sortOrder } = req.body;
    const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Category not found" });

    const data: { label?: string; sortOrder?: number } = {};
    if (typeof label === "string" && label.trim()) {
      const labelStr = label.trim();
      const all = await prisma.category.findMany({ where: { id: { not: req.params.id } }, select: { label: true } });
      if (all.some((c) => c.label.trim().toLowerCase() === labelStr.toLowerCase())) {
        return res.status(400).json({ error: "A category with this label already exists" });
      }
      data.label = labelStr;
    }
    if (typeof sortOrder === "number") data.sortOrder = sortOrder;

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data,
    });
    res.json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

categoryRoutes.delete("/:id", async (req, res) => {
  try {
    const category = await prisma.category.findUnique({ where: { id: req.params.id } });
    if (!category) return res.status(404).json({ error: "Category not found" });

    const risksWithCategory = await prisma.risk.findMany({
      where: { category: category.code },
      select: { id: true, riskName: true, organizationalUnitId: true },
      take: 500,
    });

    if (risksWithCategory.length > 0) {
      return res.status(400).json({
        error: "Cannot delete category while risks are assigned to it. Reassign or clear the category for the listed risks first.",
        code: category.code,
        risks: risksWithCategory,
      });
    }

    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});
