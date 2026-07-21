import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const bayId = req.query.bayId ? Number(req.query.bayId) : undefined;
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const equipment = await prisma.bayEquipment.findMany({
    where: {
      isActive: true,
      ...(bayId ? { bayId } : {}),
      ...(branchId ? { bay: { branchId } } : {}),
    },
    include: {
      bay: {
        select: {
          id: true,
          bayName: true,
          branchId: true,
          branch: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { id: "asc" },
  });
  res.json(equipment);
});

// ملف أصل الجهاز: أعطال + تكاليف
router.get("/:id", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const id = Number(req.params.id);
  const equipment = await prisma.bayEquipment.findUnique({
    where: { id },
    include: {
      bay: {
        select: {
          id: true,
          bayName: true,
          branch: { select: { id: true, name: true } },
        },
      },
      incidents: {
        orderBy: { createdAt: "desc" },
        include: {
          branch: { select: { name: true } },
          decidedBy: { select: { name: true } },
          receivedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!equipment) return res.status(404).json({ error: "Equipment not found" });

  const totalRepairCost = equipment.incidents.reduce((s, i) => s + (i.repairCost || 0), 0);
  const totalSpareCost = equipment.incidents.reduce((s, i) => s + (i.sparePartCost || 0), 0);
  const totalLaborCost = equipment.incidents.reduce((s, i) => s + (i.laborCost || 0), 0);
  const byStatus: Record<string, number> = {};
  for (const i of equipment.incidents) {
    byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
  }

  res.json({
    equipment,
    summary: {
      incidentCount: equipment.incidents.length,
      totalRepairCost,
      totalSpareCost,
      totalLaborCost,
      byStatus,
    },
  });
});

const createSchema = z.object({
  bayId: z.coerce.number().int(),
  name: z.string().min(1),
  serialNumber: z.string().optional(),
  installedAt: z.coerce.date().optional(),
  warrantyUntil: z.coerce.date().optional(),
  notes: z.string().optional(),
});

router.post("/", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const equipment = await prisma.bayEquipment.create({ data: parsed.data });
  res.status(201).json(equipment);
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  serialNumber: z.string().nullable().optional(),
  installedAt: z.coerce.date().nullable().optional(),
  warrantyUntil: z.coerce.date().nullable().optional(),
  notes: z.string().nullable().optional(),
  bayId: z.number().int().optional(),
});

router.patch("/:id", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const equipment = await prisma.bayEquipment.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
  });
  res.json(equipment);
});

router.delete("/:id", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const equipment = await prisma.bayEquipment.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.json(equipment);
});

export default router;
