import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function withComputedFields<T extends { nextDueAt: Date }>(schedule: T) {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = Math.ceil((schedule.nextDueAt.getTime() - now.getTime()) / msPerDay);
  return {
    ...schedule,
    isOverdue: schedule.nextDueAt.getTime() < now.getTime(),
    daysUntilDue,
  };
}

// GET /api/maintenance-schedules -> جدول الصيانة الوقائية الدورية لكل المعدات
// المدير العام يرى كل الفروع، والمشرف يرى فرعه فقط تلقائياً.
router.get("/", requireAuth, async (req, res) => {
  const queryBranchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const branchId = req.auth!.role === "manager" ? queryBranchId : req.auth!.branchId;

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { isActive: true, ...(branchId ? { branchId } : {}) },
    include: { branch: { select: { name: true } } },
    orderBy: { nextDueAt: "asc" },
  });

  res.json(schedules.map(withComputedFields));
});

const createSchema = z.object({
  branchId: z.coerce.number().int(),
  equipmentName: z.string().min(1, "اسم المعدة مطلوب"),
  intervalDays: z.coerce.number().int().min(1, "عدد الأيام يجب أن يكون 1 أو أكثر"),
  notes: z.string().optional(),
  // اختياري: تاريخ أول صيانة مستحقة، وإلا تُحسب بعد intervalDays من اليوم.
  firstDueAt: z.coerce.date().optional(),
});

// POST /api/maintenance-schedules -> إضافة معدة جديدة لجدول الصيانة الوقائية (مدير فقط)
router.post("/", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const nextDueAt = parsed.data.firstDueAt ?? addDays(new Date(), parsed.data.intervalDays);

  const schedule = await prisma.maintenanceSchedule.create({
    data: {
      branchId: parsed.data.branchId,
      equipmentName: parsed.data.equipmentName,
      intervalDays: parsed.data.intervalDays,
      notes: parsed.data.notes,
      nextDueAt,
    },
    include: { branch: { select: { name: true } } },
  });

  res.status(201).json(withComputedFields(schedule));
});

const updateSchema = z.object({
  equipmentName: z.string().min(1).optional(),
  intervalDays: z.coerce.number().int().min(1).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/maintenance-schedules/:id -> تعديل بيانات معدة (مدير فقط)
router.patch("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const schedule = await prisma.maintenanceSchedule.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
    include: { branch: { select: { name: true } } },
  });

  res.json(withComputedFields(schedule));
});

// POST /api/maintenance-schedules/:id/complete -> تسجيل تنفيذ الصيانة الآن
// وحساب تاريخ الاستحقاق القادم تلقائياً. متاح للمشرف الميداني وللمدير.
router.post("/:id/complete", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Schedule not found" });
  if (req.auth!.role !== "manager" && existing.branchId !== req.auth!.branchId) {
    return res.status(403).json({ error: "لا يمكنك تعديل صيانة فرع آخر" });
  }

  const now = new Date();
  const schedule = await prisma.maintenanceSchedule.update({
    where: { id },
    data: { lastPerformedAt: now, nextDueAt: addDays(now, existing.intervalDays) },
    include: { branch: { select: { name: true } } },
  });

  res.json(withComputedFields(schedule));
});

// DELETE /api/maintenance-schedules/:id -> إلغاء/أرشفة معدة من الجدول (مدير فقط)
router.delete("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  await prisma.maintenanceSchedule.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.status(204).send();
});

export default router;
