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

categoryRoutes.post("/", async (req, res) => {
  try {
    const { code, label, sortOrder } = req.body;
    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({ error: "code is required" });
    }
    const cleanCode = code.trim().toLowerCase().replace(/\s+/g, "_");
    const existing = await prisma.category.findUnique({ where: { code: cleanCode } });
    if (existing) return res.status(400).json({ error: "A category with this code already exists" });

    const category = await prisma.category.create({
      data: {
        code: cleanCode,
        label: (typeof label === "string" && label.trim()) ? label.trim() : cleanCode,
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
    if (typeof label === "string" && label.trim()) data.label = label.trim();
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
