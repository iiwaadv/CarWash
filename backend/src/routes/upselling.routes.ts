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
    include: { service: true },
  });

  const accepted = logs.filter((l) => l.status === "accepted").length;
  const rejected = logs.filter((l) => l.status === "rejected").length;
  const total = accepted + rejected;

  const rejectionBreakdown = REJECTION_REASON.reduce<Record<string, number>>((acc, reason) => {
    acc[reason] = logs.filter((l) => l.rejectionReason === reason).length;
    return acc;
  }, {});

  res.json({
    total,
    accepted,
    rejected,
    acceptanceRate: total > 0 ? Math.round((accepted / total) * 1000) / 10 : 0,
    rejectionBreakdown,
    totalBonusPaid: logs.reduce((sum, l) => sum + l.bonusAmount, 0),
  });
});

export default router;
