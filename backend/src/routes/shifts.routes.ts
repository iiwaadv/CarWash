import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { endOfRiyadhDay, startOfRiyadhDay } from "../utils/riyadh";

const router = Router();

router.get("/", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : undefined;
  const to = req.query.to ? new Date(String(req.query.to)) : undefined;

  const dateFilter =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  const whereBranch = branchId ? { branchId } : {};

  const [openings, closures] = await Promise.all([
    prisma.shiftOpening.findMany({
      where: {
        ...whereBranch,
        ...(dateFilter ? { shiftDate: dateFilter } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
      },
      orderBy: { shiftDate: "desc" },
      take: 200,
    }),
    prisma.shiftInventoryReport.findMany({
      where: {
        ...whereBranch,
        ...(dateFilter ? { shiftDate: dateFilter } : {}),
      },
      include: {
        branch: { select: { id: true, name: true } },
        supervisor: { select: { id: true, name: true } },
      },
      orderBy: { shiftDate: "desc" },
      take: 200,
    }),
  ]);

  res.json({ openings, closures });
});

router.get("/detail", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const branchId = Number(req.query.branchId);
  const day = String(req.query.date ?? "");
  if (!branchId || !day) return res.status(400).json({ error: "branchId and date are required" });

  const base = new Date(`${day}T12:00:00`);
  const dayStart = startOfRiyadhDay(base);
  const dayEnd = endOfRiyadhDay(base);
  const inDay = { gte: dayStart, lt: dayEnd };

  const [openings, closures, jobs, incidents, upsells, feedback] = await Promise.all([
    prisma.shiftOpening.findMany({
      where: { branchId, shiftDate: inDay },
      include: { supervisor: { select: { name: true } } },
    }),
    prisma.shiftInventoryReport.findMany({
      where: { branchId, shiftDate: inDay },
      include: { supervisor: { select: { name: true } } },
    }),
    prisma.jobOrder.findMany({
      where: { branchId, createdAt: inDay },
      include: { bay: { select: { bayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.maintenanceIncident.findMany({
      where: { branchId, createdAt: inDay },
      include: { bay: { select: { bayName: true } }, equipment: { select: { name: true } } },
    }),
    prisma.upsellingLog.findMany({
      where: { createdAt: inDay, job: { branchId } },
      include: {
        service: true,
        employee: { select: { name: true } },
        job: { select: { plateNumber: true } },
      },
    }),
    prisma.customerFeedback.findMany({
      where: { createdAt: inDay, job: { branchId } },
      include: { job: { select: { plateNumber: true } } },
    }),
  ]);

  const attachments: Array<{ kind: string; url: string; source: string }> = [];
  for (const c of closures) {
    try {
      const storage = c.storageRoomPhotosJson ? JSON.parse(c.storageRoomPhotosJson) : [];
      const yard = c.yardPhotosJson ? JSON.parse(c.yardPhotosJson) : [];
      for (const url of storage) attachments.push({ kind: "storage", url, source: `closure#${c.id}` });
      for (const url of yard) attachments.push({ kind: "yard", url, source: `closure#${c.id}` });
    } catch {
      /* ignore */
    }
  }

  type TimelineItem = { at: string; kind: string; title: string; detail?: string | null };
  const timeline: TimelineItem[] = [];
  for (const o of openings) {
    timeline.push({
      at: o.createdAt.toISOString(),
      kind: "opening",
      title: "فتح وردية",
      detail: o.supervisor.name,
    });
  }
  for (const c of closures) {
    timeline.push({
      at: c.createdAt.toISOString(),
      kind: "closure",
      title: "إغلاق وردية",
      detail: c.supervisor.name,
    });
  }
  for (const j of jobs) {
    timeline.push({
      at: j.createdAt.toISOString(),
      kind: "job",
      title: `استلام ${j.plateNumber}`,
      detail: j.bay?.bayName ?? null,
    });
    if (j.deliveredAt) {
      timeline.push({
        at: j.deliveredAt.toISOString(),
        kind: "delivered",
        title: `تسليم ${j.plateNumber}`,
        detail: j.status,
      });
    }
  }
  for (const i of incidents) {
    timeline.push({
      at: i.createdAt.toISOString(),
      kind: "incident",
      title: "بلاغ صيانة",
      detail: i.bay?.bayName ?? i.description.slice(0, 40),
    });
  }
  for (const u of upsells) {
    timeline.push({
      at: u.createdAt.toISOString(),
      kind: "upsell",
      title: `${u.status === "accepted" ? "بيع" : "رفض"} ${u.service.serviceName}`,
      detail: u.job.plateNumber,
    });
  }
  for (const f of feedback) {
    timeline.push({
      at: f.createdAt.toISOString(),
      kind: f.isCustomerFurious ? "furious" : "feedback",
      title: f.isCustomerFurious ? "عميل غاضب" : "تقييم",
      detail: f.job.plateNumber,
    });
  }
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1));

  const hour = openings[0]?.createdAt.getHours() ?? closures[0]?.createdAt.getHours() ?? 12;
  const period = hour < 14 ? "morning" : "evening";

  res.json({
    branchId,
    date: day,
    period,
    openings,
    closures,
    counts: {
      jobs: jobs.length,
      delivered: jobs.filter((j) => j.status === "delivered").length,
      incidents: incidents.length,
      upsells: upsells.filter((u) => u.status === "accepted").length,
      feedback: feedback.length,
      furious: feedback.filter((f) => f.isCustomerFurious).length,
    },
    attachments,
    timeline,
  });
});

export default router;
