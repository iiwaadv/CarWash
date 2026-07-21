import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const where = branchId ? { branchId } : {};
  const bays = await prisma.bay.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true } },
      jobOrders: {
        where: { status: { in: ["queued", "washing", "quality_check", "ready"] } },
      },
      _count: { select: { equipment: true } },
    },
    orderBy: [{ branchId: "asc" }, { id: "asc" }],
  });
  res.json(bays);
});

const createSchema = z.object({
  branchId: z.number().int(),
  bayName: z.string().min(1),
  bayType: z.string().optional(),
});

router.post("/", requireAuth, requireRole("manager", "supervisor"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const bay = await prisma.bay.create({ data: parsed.data });
  res.status(201).json(bay);
});

const updateSchema = z.object({
  bayName: z.string().min(1).optional(),
  bayType: z.string().nullable().optional(),
});

router.patch("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const bay = await prisma.bay.update({ where: { id: Number(req.params.id) }, data: parsed.data });
  res.json(bay);
});

router.delete("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  await prisma.bay.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

export default router;
