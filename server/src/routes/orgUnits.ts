import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const orgUnitRoutes = Router();

orgUnitRoutes.get("/", async (req, res) => {
  try {
    const { legalEntityId, type } = req.query;
    const where: { legalEntityId?: string; type?: string } = {};
    if (typeof legalEntityId === "string") where.legalEntityId = legalEntityId;
    if (typeof type === "string") where.type = type as "program" | "project" | "department";

    const orgUnits = await prisma.organizationalUnit.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: {
        legalEntity: { select: { id: true, name: true, code: true } },
        _count: { select: { risks: true } },
      },
    });
    res.json(orgUnits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch organizational units" });
  }
});

orgUnitRoutes.get("/:id", async (req, res) => {
  try {
    const orgUnit = await prisma.organizationalUnit.findUnique({
      where: { id: req.params.id },
      include: {
        legalEntity: true,
        _count: { select: { risks: true } },
      },
    });
    if (!orgUnit) return res.status(404).json({ error: "Organizational unit not found" });
    res.json(orgUnit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch organizational unit" });
  }
});

orgUnitRoutes.post("/", async (req, res) => {
  try {
    const { legalEntityId, type, name, code, description, parentId } = req.body;
    if (!legalEntityId || !type || !name || !code) {
      return res.status(400).json({
        error: "legalEntityId, type, name, and code are required",
      });
    }
    const validTypes = ["program", "project", "department"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "type must be program, project, or department" });
    }
    const orgUnit = await prisma.organizationalUnit.create({
      data: {
        legalEntityId,
        type,
        name,
        code,
        description: description ?? null,
        parentId: parentId ?? null,
      },
    });
    res.status(201).json(orgUnit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create organizational unit" });
  }
});

orgUnitRoutes.patch("/:id", async (req, res) => {
  try {
    const { name, code, description, parentId, type } = req.body;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (description !== undefined) data.description = description;
    if (parentId !== undefined) data.parentId = parentId;
    if (type !== undefined) {
      const validTypes = ["program", "project", "department"];
      if (validTypes.includes(type)) data.type = type;
    }
    const orgUnit = await prisma.organizationalUnit.update({
      where: { id: req.params.id },
      data,
    });
    res.json(orgUnit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update organizational unit" });
  }
});

orgUnitRoutes.delete("/:id", async (req, res) => {
  try {
    await prisma.organizationalUnit.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete organizational unit" });
  }
});
