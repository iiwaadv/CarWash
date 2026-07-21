import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return startOfDay(d);
}

// GET /api/reports/summary?from=&to=&branchId=
router.get("/summary", requireAuth, requireRole("manager"), async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : daysAgo(7);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();

  const jobWhere = {
    createdAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
  };

  const [
    jobs,
    upsells,
    feedback,
    incidents,
    shiftReports,
    shiftOpenings,
    cancelledCount,
    deliveredCount,
    washingCount,
  ] = await Promise.all([
    prisma.jobOrder.findMany({
      where: jobWhere,
      select: {
        id: true,
        status: true,
        branchId: true,
        plateNumber: true,
        createdAt: true,
        deliveredAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.upsellingLog.findMany({
      where: { createdAt: { gte: from, lte: to }, ...(branchId ? { job: { branchId } } : {}) },
      include: {
        service: true,
        employee: { select: { name: true } },
        job: { select: { plateNumber: true, branchId: true, branch: { select: { name: true } } } },
      },
    }),
    prisma.customerFeedback.findMany({
      where: { createdAt: { gte: from, lte: to }, ...(branchId ? { job: { branchId } } : {}) },
      include: { job: { select: { plateNumber: true, branch: { select: { name: true } } } } },
    }),
    prisma.maintenanceIncident.findMany({
      where: { createdAt: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      include: {
        branch: { select: { name: true } },
        bay: { select: { bayName: true } },
        equipment: { select: { name: true } },
      },
    }),
    prisma.shiftInventoryReport.findMany({
      where: { shiftDate: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { name: true } }, supervisor: { select: { name: true } } },
    }),
    prisma.shiftOpening.findMany({
      where: { shiftDate: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { name: true } }, supervisor: { select: { name: true } } },
    }),
    prisma.jobOrder.count({ where: { ...jobWhere, status: "cancelled" } }),
    prisma.jobOrder.count({ where: { ...jobWhere, status: "delivered" } }),
    prisma.jobOrder.count({
      where: { ...jobWhere, status: { in: ["queued", "washing", "quality_check", "ready"] } },
    }),
  ]);

  const acceptedUpsells = upsells.filter((u) => u.status === "accepted");
  const totalBonus = acceptedUpsells.reduce((s, u) => s + u.bonusAmount, 0);
  const estimatedRevenue = acceptedUpsells.reduce((s, u) => s + (u.service?.basePrice ?? 0), 0);
  const towelsLost = shiftReports.reduce(
    (s, r) => s + Math.max(0, r.towelsReceivedStart - r.towelsCollectedEnd),
    0
  );
  const maintenanceCost = incidents.reduce((s, i) => s + (i.repairCost || 0), 0);
  const furiousCount = feedback.filter((f) => f.isCustomerFurious).length;

  const byBranchMap = new Map<
    number,
    { branchId: number; branchName: string; jobs: number; delivered: number; cancelled: number; bonus: number }
  >();

  for (const j of jobs) {
    const cur = byBranchMap.get(j.branchId) ?? {
      branchId: j.branchId,
      branchName: j.branch.name,
      jobs: 0,
      delivered: 0,
      cancelled: 0,
      bonus: 0,
    };
    cur.jobs += 1;
    if (j.status === "delivered") cur.delivered += 1;
    if (j.status === "cancelled") cur.cancelled += 1;
    byBranchMap.set(j.branchId, cur);
  }

  for (const u of acceptedUpsells) {
    const bid = u.job.branchId;
    const cur = byBranchMap.get(bid) ?? {
      branchId: bid,
      branchName: u.job.branch.name,
      jobs: 0,
      delivered: 0,
      cancelled: 0,
      bonus: 0,
    };
    cur.bonus += u.bonusAmount;
    byBranchMap.set(bid, cur);
  }

  const targets = await prisma.salesTarget.findMany({
    where: { isActive: true, ...(branchId ? { branchId } : {}) },
    include: {
      branch: { select: { name: true } },
      service: { select: { serviceName: true } },
    },
  });

  const cycleSamples = jobs.filter((j) => j.deliveredAt);
  const avgCycleMinutes =
    cycleSamples.length > 0
      ? Math.round(
          (cycleSamples.reduce(
            (s, j) => s + (j.deliveredAt!.getTime() - j.createdAt.getTime()) / 60000,
            0
          ) /
            cycleSamples.length) *
            10
        ) / 10
      : null;

  const bayCount = await prisma.bay.count(branchId ? { where: { branchId } } : undefined);
  const occupiedNow = await prisma.jobOrder.count({
    where: {
      status: { in: ["washing", "quality_check", "ready"] },
      bayId: { not: null },
      ...(branchId ? { branchId } : {}),
    },
  });
  const occupancyPct = bayCount > 0 ? Math.round((occupiedNow / bayCount) * 1000) / 10 : 0;

  res.json({
    range: { from, to },
    kpis: {
      totalJobs: jobs.length,
      deliveredCount,
      cancelledCount,
      activeNow: washingCount,
      upsellAccepted: acceptedUpsells.length,
      upsellRejected: upsells.filter((u) => u.status === "rejected").length,
      totalBonus,
      estimatedUpsellRevenue: estimatedRevenue,
      towelsLost,
      maintenanceCost,
      feedbackCount: feedback.length,
      furiousCount,
      shiftClosures: shiftReports.length,
      shiftOpenings: shiftOpenings.length,
      incidents: incidents.length,
      occupancyPct,
      avgCycleMinutes,
    },
    byBranch: Array.from(byBranchMap.values()),
    targets,
    recentJobs: jobs.slice(0, 50),
    recentUpsells: upsells.slice(0, 50),
    recentIncidents: incidents.slice(0, 50),
    recentShiftReports: shiftReports.slice(0, 30),
    recentFeedback: feedback.slice(0, 30),
  });
});

// CSV export — additive on top of summary
router.get("/export", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : daysAgo(7);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();

  const [jobs, upsells, incidents] = await Promise.all([
    prisma.jobOrder.findMany({
      where: { createdAt: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      include: { branch: { select: { name: true } }, bay: { select: { bayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.upsellingLog.findMany({
      where: { createdAt: { gte: from, lte: to }, ...(branchId ? { job: { branchId } } : {}) },
      include: {
        service: true,
        employee: { select: { name: true } },
        job: { select: { plateNumber: true, branch: { select: { name: true } } } },
      },
      take: 2000,
    }),
    prisma.maintenanceIncident.findMany({
      where: { createdAt: { gte: from, lte: to }, ...(branchId ? { branchId } : {}) },
      include: {
        branch: { select: { name: true } },
        bay: { select: { bayName: true } },
        equipment: { select: { name: true } },
      },
      take: 2000,
    }),
  ]);

  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push("section,id,branch,plate_or_desc,status,amount,bay,employee,created_at");
  for (const j of jobs) {
    lines.push(
      ["job", j.id, j.branch.name, j.plateNumber, j.status, "", j.bay?.bayName ?? "", "", j.createdAt.toISOString()]
        .map(esc)
        .join(",")
    );
  }
  for (const u of upsells) {
    lines.push(
      [
        "upsell",
        u.id,
        u.job.branch.name,
        u.job.plateNumber,
        u.status,
        u.bonusAmount,
        "",
        u.employee?.name ?? "",
        u.createdAt.toISOString(),
      ]
        .map(esc)
        .join(",")
    );
  }
  for (const i of incidents) {
    lines.push(
      [
        "incident",
        i.id,
        i.branch.name,
        i.description.slice(0, 80),
        i.status,
        i.repairCost,
        i.bay?.bayName ?? "",
        i.equipment?.name ?? "",
        i.createdAt.toISOString(),
      ]
        .map(esc)
        .join(",")
    );
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="ejaz-report.csv"`);
  res.send("\uFEFF" + lines.join("\n"));
});

export default router;
