import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/customers/center?plate=&phone=
 * مركز عميل/سيارة — تجميع فوق JobOrder الحالي بدون جدول عملاء منفصل.
 */
router.get("/center", requireAuth, requireRole("manager"), async (req, res) => {
  const plate = String(req.query.plate ?? "").trim();
  const phone = String(req.query.phone ?? "").trim();

  if (!plate && !phone) {
    return res.status(400).json({ error: "plate or phone is required" });
  }

  const where = plate
    ? { plateNumber: { equals: plate, mode: "insensitive" as const } }
    : { customerPhone: { contains: phone, mode: "insensitive" as const } };

  const jobs = await prisma.jobOrder.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true } },
      bay: { select: { id: true, bayName: true } },
      qualityLogs: {
        orderBy: { createdAt: "desc" },
        include: { inspector: { select: { id: true, name: true } } },
      },
      upsellingLogs: {
        orderBy: { createdAt: "desc" },
        include: {
          service: { select: { id: true, serviceName: true, basePrice: true } },
          employee: { select: { id: true, name: true } },
        },
      },
      customerFeedback: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (!jobs.length) {
    return res.json({
      identity: { plate: plate || null, phone: phone || null },
      summary: null,
      jobs: [],
      dirtyCarLog: [],
      timeline: [],
    });
  }

  const phones = [...new Set(jobs.map((j) => j.customerPhone).filter(Boolean))] as string[];
  const plates = [...new Set(jobs.map((j) => j.plateNumber))];
  const carTypes = [...new Set(jobs.map((j) => j.carType).filter(Boolean))] as string[];
  const latest = jobs[0];
  const dirtyCount = jobs.filter((j) => j.isHighlyDirty).length;
  const furiousCount = jobs.reduce(
    (n, j) => n + j.customerFeedback.filter((f) => f.isCustomerFurious).length,
    0
  );
  const upsellAccepted = jobs.reduce(
    (n, j) => n + j.upsellingLogs.filter((u) => u.status === "accepted").length,
    0
  );
  const upsellBonus = jobs.reduce(
    (n, j) => n + j.upsellingLogs.reduce((s, u) => s + (u.bonusAmount || 0), 0),
    0
  );

  const dirtyCarLog = jobs
    .filter((j) => j.isHighlyDirty)
    .map((j) => {
      const pre = j.qualityLogs.find((q) => q.stage === "pre_wash_photos");
      return {
        jobId: j.id,
        plateNumber: j.plateNumber,
        branch: j.branch.name,
        bay: j.bay?.bayName ?? null,
        createdAt: j.createdAt,
        status: j.status,
        scratchesNotes: pre?.scratchesNotes ?? null,
        photosJson: pre?.photosJson ?? null,
      };
    });

  type TimelineItem = {
    at: string;
    kind: string;
    jobId: number;
    title: string;
    detail?: string | null;
  };

  const timeline: TimelineItem[] = [];
  for (const j of jobs) {
    timeline.push({
      at: j.createdAt.toISOString(),
      kind: "job_created",
      jobId: j.id,
      title: `استلام — ${j.plateNumber}`,
      detail: `${j.branch.name}${j.isHighlyDirty ? " · سيارة متسخة" : ""}`,
    });
    if (j.deliveredAt) {
      timeline.push({
        at: j.deliveredAt.toISOString(),
        kind: "delivered",
        jobId: j.id,
        title: `تسليم — ${j.plateNumber}`,
        detail: j.branch.name,
      });
    }
    for (const u of j.upsellingLogs) {
      timeline.push({
        at: u.createdAt.toISOString(),
        kind: u.status === "accepted" ? "upsell_accepted" : "upsell_rejected",
        jobId: j.id,
        title: `${u.status === "accepted" ? "بيع إضافي" : "رفض بيع"} — ${u.service.serviceName}`,
        detail: u.employee?.name ?? null,
      });
    }
    for (const f of j.customerFeedback) {
      timeline.push({
        at: f.createdAt.toISOString(),
        kind: f.isCustomerFurious ? "furious_feedback" : "feedback",
        jobId: j.id,
        title: f.isCustomerFurious ? "عميل غاضب" : "تقييم صوت",
        detail: f.voiceRecUrl,
      });
    }
    for (const q of j.qualityLogs) {
      if (q.touchUpNeeded) {
        timeline.push({
          at: (q.touchUpAt ?? q.createdAt).toISOString(),
          kind: "touch_up",
          jobId: j.id,
          title: "تصحيح تنشيف",
          detail: q.inspector?.name ?? null,
        });
      }
    }
  }
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

  res.json({
    identity: {
      plate: plate || plates[0] || null,
      plates,
      phones,
      carTypes,
      phone: phone || phones[0] || null,
    },
    summary: {
      visitCount: jobs.length,
      dirtyCount,
      furiousCount,
      upsellAccepted,
      upsellBonus,
      latestStatus: latest.status,
      latestBranch: latest.branch.name,
      latestBay: latest.bay?.bayName ?? null,
      latestAt: latest.createdAt,
      activeJob: ["queued", "washing", "quality_check", "ready"].includes(latest.status)
        ? {
            id: latest.id,
            status: latest.status,
            branch: latest.branch.name,
            bay: latest.bay?.bayName ?? null,
          }
        : null,
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      plateNumber: j.plateNumber,
      customerPhone: j.customerPhone,
      carType: j.carType,
      status: j.status,
      isHighlyDirty: j.isHighlyDirty,
      posInvoiceNo: j.posInvoiceNo,
      createdAt: j.createdAt,
      deliveredAt: j.deliveredAt,
      branch: j.branch,
      bay: j.bay,
      upsells: j.upsellingLogs.map((u) => ({
        id: u.id,
        status: u.status,
        bonusAmount: u.bonusAmount,
        service: u.service.serviceName,
        employee: u.employee?.name ?? null,
        createdAt: u.createdAt,
      })),
      feedback: j.customerFeedback,
      qualityCount: j.qualityLogs.length,
    })),
    dirtyCarLog,
    timeline: timeline.slice(0, 80),
  });
});

export default router;
