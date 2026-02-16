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
    res.status(500).json({ error: "Failed to fetch entities" });
  }
});

legalEntityRoutes.get("/:id", async (req, res) => {
  try {
    const entity = await prisma.legalEntity.findUnique({
      where: { id: req.params.id },
      include: { organizationalUnits: { orderBy: { name: "asc" } } },
    });
    if (!entity) return res.status(404).json({ error: "Entity not found" });
    res.json(entity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch entity" });
  }
});

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "entity";
}

legalEntityRoutes.post("/", async (req, res) => {
  try {
    const { name, description } = req.body;
    const nameStr = typeof name === "string" && name.trim() ? name.trim() : "";
    if (!nameStr) return res.status(400).json({ error: "Name is required" });
    const code = slugFromName(nameStr);
    const entity = await prisma.legalEntity.create({
      data: { name: nameStr, code, description: typeof description === "string" ? description.trim() || null : null },
    });
    res.status(201).json(entity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create entity" });
  }
});

legalEntityRoutes.patch("/:id", async (req, res) => {
  try {
    const { name, description } = req.body;
    const data: { name?: string; code?: string; description?: string | null } = {};
    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
      data.code = slugFromName(name);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
      data.description = typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim() : null;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });
    const entity = await prisma.legalEntity.update({
      where: { id: req.params.id },
      data,
    });
    res.json(entity);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update entity" });
  }
});

legalEntityRoutes.delete("/:id", async (req, res) => {
  try {
    await prisma.legalEntity.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete entity" });
  }
});
