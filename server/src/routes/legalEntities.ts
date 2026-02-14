import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const legalEntityRoutes = Router();

legalEntityRoutes.get("/", async (_req, res) => {
  try {
    const entities = await prisma.legalEntity.findMany({
      orderBy: { name: "asc" },
      include: { organizationalUnits: { orderBy: { name: "asc" } } },
    });
    res.json(entities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch legal entities" });
  }
});

legalEntityRoutes.get("/:id", async (req, res) => {
  try {
    const entity = await prisma.legalEntity.findUnique({
      where: { id: req.params.id },
      include: { organizationalUnits: { orderBy: { name: "asc" } } },
    });
    if (!entity) return res.status(404).json({ error: "Legal entity not found" });
    res.json(entity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch legal entity" });
  }
});

legalEntityRoutes.post("/", async (req, res) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: "Name and code are required" });
    }
    const entity = await prisma.legalEntity.create({
      data: { name, code, description: description ?? null },
    });
    res.status(201).json(entity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create legal entity" });
  }
});

legalEntityRoutes.patch("/:id", async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const entity = await prisma.legalEntity.update({
      where: { id: req.params.id },
      data: { name, code, description },
    });
    res.json(entity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update legal entity" });
  }
});

legalEntityRoutes.delete("/:id", async (req, res) => {
  try {
    await prisma.legalEntity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete legal entity" });
  }
});
