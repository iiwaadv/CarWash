import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/bay-equipment?bayId=&branchId= -> equipment list feeding both the
// "report a breakdown" flow (pick bay -> pick equipment) and the manager's
// equipment management screen.
router.get("/", requireAuth, async (req, res) => {
  const bayId = req.query.bayId ? Number(req.query.bayId) : undefined;
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const equipment = await prisma.bayEquipment.findMany({
    where: {
      isActive: true,
      ...(bayId ? { bayId } : {}),
      ...(branchId ? { bay: { branchId } } : {}),
    },
    include: { bay: { select: { id: true, bayName: true, branchId: true } } },
    orderBy: { id: "asc" },
  });
  res.json(equipment);
});

const createSchema = z.object({
  bayId: z.coerce.number().int(),
  name: z.string().min(1),
});

router.post("/", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const equipment = await prisma.bayEquipment.create({ data: parsed.data });
  res.status(201).json(equipment);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

router.patch("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const equipment = await prisma.bayEquipment.update({ where: { id: Number(req.params.id) }, data: parsed.data });
  res.json(equipment);
});

// Soft-delete to keep historical incidents pointing at a valid equipment row.
router.delete("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const equipment = await prisma.bayEquipment.update({ where: { id: Number(req.params.id) }, data: { isActive: false } });
  res.json(equipment);
});

export default router;
