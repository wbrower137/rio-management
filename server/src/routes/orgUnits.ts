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

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "unit";
}

orgUnitRoutes.post("/", async (req, res) => {
  try {
    const { legalEntityId, type, name, description, parentId } = req.body;
    if (!legalEntityId || !type || !name) {
      return res.status(400).json({
        error: "legalEntityId, type, and name are required",
      });
    }
    const validTypes = ["program", "project", "department"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "type must be program, project, or department" });
    }
    const nameStr = typeof name === "string" ? name.trim() : "";
    if (!nameStr) return res.status(400).json({ error: "name is required" });
    const code = slugFromName(nameStr);
    const orgUnit = await prisma.organizationalUnit.create({
      data: {
        legalEntityId,
        type,
        name: nameStr,
        code,
        description: typeof description === "string" ? description.trim() || null : null,
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
    const { name, description, parentId, type } = req.body;
    const data: Record<string, unknown> = {};
    if (typeof name === "string" && name.trim()) {
      data.name = name.trim();
      data.code = slugFromName(name);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "description")) {
      data.description = typeof req.body.description === "string" && req.body.description.trim() ? req.body.description.trim() : null;
    }
    if (parentId !== undefined) data.parentId = parentId;
    if (type !== undefined) {
      const validTypes = ["program", "project", "department"];
      if (validTypes.includes(type)) data.type = type;
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "No fields to update" });
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
