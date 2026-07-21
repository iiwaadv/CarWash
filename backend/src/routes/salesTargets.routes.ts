import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const PERIODS = ["daily", "weekly", "monthly"] as const;

router.get("/", requireAuth, async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const targets = await prisma.salesTarget.findMany({
    where: { isActive: true, ...(branchId ? { branchId } : {}) },
    include: { branch: { select: { id: true, name: true } } },
    orderBy: [{ branchId: "asc" }, { period: "asc" }],
  });
  res.json(targets);
});

const createSchema = z.object({
  branchId: z.number().int(),
  period: z.enum(PERIODS),
  amount: z.number().nonnegative(),
  startDate: z.coerce.date().optional(),
});

router.post("/", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  // أرشفة الهدف السابق لنفس الفرع ونفس الفترة ثم إنشاء هدف جديد
  await prisma.salesTarget.updateMany({
    where: { branchId: parsed.data.branchId, period: parsed.data.period, isActive: true },
    data: { isActive: false },
  });

  const target = await prisma.salesTarget.create({
    data: {
      branchId: parsed.data.branchId,
      period: parsed.data.period,
      amount: parsed.data.amount,
      startDate: parsed.data.startDate ?? new Date(),
    },
    include: { branch: { select: { id: true, name: true } } },
  });
  res.status(201).json(target);
});

router.patch("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const schema = z.object({
    amount: z.number().nonnegative().optional(),
    isActive: z.boolean().optional(),
    startDate: z.coerce.date().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const target = await prisma.salesTarget.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
    include: { branch: { select: { id: true, name: true } } },
  });
  res.json(target);
});

router.delete("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  await prisma.salesTarget.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.status(204).end();
});

export default router;
