import { Router } from "express";
import { z } from "zod";
import { REJECTION_REASON } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Simple bonus rule: 10% of the additional service base price goes to the bay crew.
const BONUS_RATE = 0.1;

const acceptSchema = z.object({
  jobId: z.number().int(),
  serviceId: z.number().int(),
  extraInvoiceNo: z.string().min(1, "رقم الفاتورة الإضافية مطلوب"),
});

// POST /api/upselling/accept -> "تم القبول" -> ask for extra invoice # -> auto bonus
router.post("/accept", requireAuth, async (req, res) => {
  const parsed = acceptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const service = await prisma.service.findUnique({ where: { id: parsed.data.serviceId } });
  if (!service) return res.status(404).json({ error: "Service not found" });

  const log = await prisma.upsellingLog.create({
    data: {
      jobId: parsed.data.jobId,
      serviceId: parsed.data.serviceId,
      employeeId: req.auth!.employeeId,
      status: "accepted",
      extraInvoiceNo: parsed.data.extraInvoiceNo,
      bonusAmount: Math.round(service.basePrice * BONUS_RATE * 100) / 100,
    },
    include: { service: true },
  });

  res.status(201).json(log);
});

const rejectSchema = z.object({
  jobId: z.number().int(),
  serviceId: z.number().int(),
  rejectionReason: z.enum(REJECTION_REASON),
});

// POST /api/upselling/reject -> "تم الرفض" -> forces one of the 4 reason buttons
router.post("/reject", requireAuth, async (req, res) => {
  const parsed = rejectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const log = await prisma.upsellingLog.create({
    data: {
      jobId: parsed.data.jobId,
      serviceId: parsed.data.serviceId,
      employeeId: req.auth!.employeeId,
      status: "rejected",
      rejectionReason: parsed.data.rejectionReason,
    },
    include: { service: true },
  });

  res.status(201).json(log);
});

router.get("/analytics", requireAuth, async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const logs = await prisma.upsellingLog.findMany({
    where: branchId ? { job: { branchId } } : undefined,
    include: {
      service: true,
      employee: { select: { id: true, name: true } },
      job: { select: { branchId: true, plateNumber: true, branch: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const accepted = logs.filter((l) => l.status === "accepted").length;
  const rejected = logs.filter((l) => l.status === "rejected").length;
  const total = accepted + rejected;

  const rejectionBreakdown = REJECTION_REASON.reduce<Record<string, number>>((acc, reason) => {
    acc[reason] = logs.filter((l) => l.rejectionReason === reason).length;
    return acc;
  }, {});

  // من المستحق للبونص: كل عملية بيع مقبولة، مع اسم الموظف والخدمة والفرع وقيمة البونص.
  const bonusDetails = logs
    .filter((l) => l.status === "accepted")
    .map((l) => ({
      upsellId: l.id,
      employeeId: l.employee?.id ?? null,
      employeeName: l.employee?.name ?? "—",
      branchId: l.job.branchId,
      branchName: l.job.branch.name,
      plateNumber: l.job.plateNumber,
      serviceName: l.service.serviceName,
      bonusAmount: l.bonusAmount,
      extraInvoiceNo: l.extraInvoiceNo,
      createdAt: l.createdAt,
    }));

  // تفاصيل الرفض: الفرع، الموظف، الخدمة، السبب، ووقت الرفض.
  const rejectionDetails = logs
    .filter((l) => l.status === "rejected")
    .map((l) => ({
      upsellId: l.id,
      employeeId: l.employee?.id ?? null,
      employeeName: l.employee?.name ?? "—",
      branchId: l.job.branchId,
      branchName: l.job.branch.name,
      plateNumber: l.job.plateNumber,
      serviceName: l.service.serviceName,
      rejectionReason: l.rejectionReason,
      createdAt: l.createdAt,
    }));

  // ملخص لكل فرع: عدد المقبول/المرفوض/نسبة القبول/إجمالي البونص.
  const branchIds = Array.from(new Set(logs.map((l) => l.job.branchId)));
  const byBranch = branchIds.map((id) => {
    const branchLogs = logs.filter((l) => l.job.branchId === id);
    const branchAccepted = branchLogs.filter((l) => l.status === "accepted").length;
    const branchRejected = branchLogs.filter((l) => l.status === "rejected").length;
    const branchTotal = branchAccepted + branchRejected;
    return {
      branchId: id,
      branchName: branchLogs[0]?.job.branch.name ?? String(id),
      accepted: branchAccepted,
      rejected: branchRejected,
      acceptanceRate: branchTotal > 0 ? Math.round((branchAccepted / branchTotal) * 1000) / 10 : 0,
      totalBonusPaid: branchLogs.reduce((sum, l) => sum + l.bonusAmount, 0),
    };
  });

  res.json({
    total,
    accepted,
    rejected,
    acceptanceRate: total > 0 ? Math.round((accepted / total) * 1000) / 10 : 0,
    rejectionBreakdown,
    totalBonusPaid: logs.reduce((sum, l) => sum + l.bonusAmount, 0),
    bonusDetails,
    rejectionDetails,
    byBranch,
  });
});

export default router;
