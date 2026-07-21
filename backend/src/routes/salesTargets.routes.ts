import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendUrgentAlert } from "../utils/alerts";
import { writeAudit } from "../utils/audit";

const router = Router();

const PERIODS = ["daily", "weekly", "monthly"] as const;

router.get("/", requireAuth, async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const targets = await prisma.salesTarget.findMany({
    where: { isActive: true, ...(branchId ? { branchId } : {}) },
    include: {
      branch: { select: { id: true, name: true } },
      service: { select: { id: true, serviceName: true, basePrice: true } },
    },
    orderBy: [{ branchId: "asc" }, { period: "asc" }],
  });
  res.json(targets);
});

// تقدم الأهداف مقابل المبيعات الإضافية
router.get("/progress", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const targets = await prisma.salesTarget.findMany({
    where: { isActive: true },
    include: {
      branch: { select: { id: true, name: true } },
      service: { select: { id: true, serviceName: true, basePrice: true } },
    },
  });

  const progress = await Promise.all(
    targets.map(async (t) => {
      const upsells = await prisma.upsellingLog.findMany({
        where: {
          status: "accepted",
          createdAt: { gte: t.startDate },
          job: { branchId: t.branchId },
          ...(t.serviceId ? { serviceId: t.serviceId } : {}),
        },
        include: { service: true, employee: { select: { name: true } } },
      });
      const achievedQty = upsells.length;
      const achievedAmount = upsells.reduce((s, u) => s + (u.service.basePrice || 0), 0);
      const amountPct = t.amount > 0 ? Math.round((achievedAmount / t.amount) * 1000) / 10 : null;
      const qtyPct =
        t.targetQty && t.targetQty > 0 ? Math.round((achievedQty / t.targetQty) * 1000) / 10 : null;
      const byEmployee = new Map<string, number>();
      for (const u of upsells) {
        const name = u.employee?.name ?? "—";
        byEmployee.set(name, (byEmployee.get(name) ?? 0) + 1);
      }
      const bestEmployee = [...byEmployee.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
      return {
        target: t,
        achievedQty,
        achievedAmount,
        remainingAmount: Math.max(0, t.amount - achievedAmount),
        remainingQty: t.targetQty != null ? Math.max(0, t.targetQty - achievedQty) : null,
        amountPct,
        qtyPct,
        bestEmployee: bestEmployee ? { name: bestEmployee[0], count: bestEmployee[1] } : null,
      };
    })
  );

  res.json(progress);
});

const createSchema = z.object({
  branchId: z.number().int(),
  serviceId: z.number().int().nullable().optional(),
  period: z.enum(PERIODS),
  amount: z.number().nonnegative(),
  targetQty: z.number().int().nonnegative().nullable().optional(),
  startDate: z.coerce.date().optional(),
});

router.post("/", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  await prisma.salesTarget.updateMany({
    where: {
      branchId: parsed.data.branchId,
      period: parsed.data.period,
      isActive: true,
      serviceId: parsed.data.serviceId ?? null,
    },
    data: { isActive: false },
  });

  const target = await prisma.salesTarget.create({
    data: {
      branchId: parsed.data.branchId,
      serviceId: parsed.data.serviceId ?? null,
      period: parsed.data.period,
      amount: parsed.data.amount,
      targetQty: parsed.data.targetQty ?? null,
      startDate: parsed.data.startDate ?? new Date(),
    },
    include: {
      branch: { select: { id: true, name: true } },
      service: { select: { id: true, serviceName: true } },
    },
  });

  await sendUrgentAlert({
    title: "🎯 تحديث Target مبيعات",
    message: `فرع ${target.branch.name} — ${target.service?.serviceName ?? "هدف عام"} — ${target.period}: ${target.amount} ر.س`,
  });

  await writeAudit({
    actor: req.auth,
    action: "create",
    entityType: "sales_target",
    entityId: target.id,
    after: target,
  });

  res.status(201).json(target);
});

router.patch("/:id", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const schema = z.object({
    amount: z.number().nonnegative().optional(),
    targetQty: z.number().int().nonnegative().nullable().optional(),
    serviceId: z.number().int().nullable().optional(),
    isActive: z.boolean().optional(),
    startDate: z.coerce.date().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const target = await prisma.salesTarget.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
    include: {
      branch: { select: { id: true, name: true } },
      service: { select: { id: true, serviceName: true } },
    },
  });
  await sendUrgentAlert({
    title: "🎯 تعديل Target مبيعات",
    message: `فرع ${target.branch.name} — ${target.service?.serviceName ?? "هدف عام"}`,
  });
  await writeAudit({
    actor: req.auth,
    action: "update",
    entityType: "sales_target",
    entityId: target.id,
    after: target,
  });
  res.json(target);
});

router.delete("/:id", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  await prisma.salesTarget.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.status(204).end();
});

export default router;
