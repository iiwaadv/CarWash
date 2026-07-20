import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { publicUrl, uploadPhotos } from "../middleware/upload";

const router = Router();
const UPSELL_TARGET_PCT = 40; // matches the >40% success metric in the PRD

const fieldsSchema = z.object({
  shiftDate: z.string(), // ISO date
  chemicalsRemainingJson: z.string(), // JSON string {product: liters}
  towelsReceivedStart: z.coerce.number().int().nonnegative(),
  towelsCollectedEnd: z.coerce.number().int().nonnegative(),
});

// POST /api/shift-inventory (multipart: storagePhotos[], yardPhotos[])
// Implements the 3 mandatory steps of the shift-closure wizard in one submit.
router.post(
  "/",
  requireAuth,
  uploadPhotos.fields([
    { name: "storagePhotos", maxCount: 6 },
    { name: "yardPhotos", maxCount: 6 },
  ]),
  async (req, res) => {
    const parsed = fieldsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.flatten());

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const storagePhotos = files?.storagePhotos ?? [];
    const yardPhotos = files?.yardPhotos ?? [];

    if (storagePhotos.length === 0 || yardPhotos.length === 0) {
      return res.status(400).json({
        error: "خطوة 1 و 2 إلزاميتان: صور غرفة العهدة وصور الساحة قبل إغلاق الوردية",
      });
    }

    const branchId = req.auth!.branchId;
    const supervisorId = req.auth!.employeeId;
    const shiftDate = new Date(parsed.data.shiftDate);

    const dayStart = new Date(shiftDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(shiftDate);
    dayEnd.setHours(23, 59, 59, 999);

    const upsellLogs = await prisma.upsellingLog.findMany({
      where: { job: { branchId }, createdAt: { gte: dayStart, lte: dayEnd } },
    });
    const accepted = upsellLogs.filter((l) => l.status === "accepted").length;
    const upsellAchievedPct =
      upsellLogs.length > 0 ? Math.round((accepted / upsellLogs.length) * 1000) / 10 : 0;

    const report = await prisma.shiftInventoryReport.create({
      data: {
        branchId,
        supervisorId,
        shiftDate,
        chemicalsRemainingJson: parsed.data.chemicalsRemainingJson,
        towelsReceivedStart: parsed.data.towelsReceivedStart,
        towelsCollectedEnd: parsed.data.towelsCollectedEnd,
        storageRoomPhotosJson: JSON.stringify(storagePhotos.map((f) => publicUrl("photos", f.filename))),
        yardPhotosJson: JSON.stringify(yardPhotos.map((f) => publicUrl("photos", f.filename))),
        upsellTargetPct: upsellAchievedPct,
      },
    });

    const towelsLost = report.towelsReceivedStart - report.towelsCollectedEnd;
    const targetMet = upsellAchievedPct >= UPSELL_TARGET_PCT;

    res.status(201).json({
      ...report,
      towelsLost,
      targetMet,
      encouragementMessage: targetMet
        ? "🎉 أداء رائع اليوم! حافظ على هذا المستوى غداً وسنصل للقمة معاً."
        : "💪 يوم جديد، فرصة جديدة لتحقيق الهدف. نجاحك القادم أقرب مما تتوقع!",
    });
  }
);

router.get("/", requireAuth, async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const reports = await prisma.shiftInventoryReport.findMany({
    where: branchId ? { branchId } : undefined,
    include: { supervisor: { select: { id: true, name: true } }, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(
    reports.map((r) => ({ ...r, towelsLost: r.towelsReceivedStart - r.towelsCollectedEnd }))
  );
});

// GET /api/shift-inventory/missing-towels -> KPI per supervisor for the exec dashboard
router.get("/missing-towels", requireAuth, async (_req, res) => {
  const reports = await prisma.shiftInventoryReport.findMany({
    include: { supervisor: { select: { id: true, name: true } } },
  });

  const bySupervisor = new Map<number, { supervisorId: number; name: string; towelsLost: number; shifts: number }>();
  for (const r of reports) {
    const lost = r.towelsReceivedStart - r.towelsCollectedEnd;
    const entry = bySupervisor.get(r.supervisorId) ?? {
      supervisorId: r.supervisorId,
      name: r.supervisor.name,
      towelsLost: 0,
      shifts: 0,
    };
    entry.towelsLost += lost;
    entry.shifts += 1;
    bySupervisor.set(r.supervisorId, entry);
  }

  res.json(Array.from(bySupervisor.values()).sort((a, b) => b.towelsLost - a.towelsLost));
});

export default router;
