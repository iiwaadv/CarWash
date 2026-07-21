import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { recentAlerts } from "../utils/alerts";
import { endOfRiyadhDay, riyadhDayLabel, startOfRiyadhDay } from "../utils/riyadh";

const router = Router();

// GET /api/dashboard/pending-decisions -> "صندوق القرارات المعلقة"
router.get("/pending-decisions", requireAuth, requireRole("manager"), async (_req, res) => {
  const incidents = await prisma.maintenanceIncident.findMany({
    where: { status: "pending_approval" },
    include: {
      branch: { select: { name: true } },
      bay: { select: { id: true, bayName: true } },
      equipment: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(incidents);
});

// GET /api/dashboard/kpis -> executive summary indicators (cumulative — unchanged)
router.get("/kpis", requireAuth, requireRole("manager"), async (_req, res) => {
  const [reports, qualityLogs, upsellLogs, feedback, incidents, overdueMaintenanceSchedules] = await Promise.all([
    prisma.shiftInventoryReport.findMany(),
    prisma.qualityLog.findMany({ where: { stage: "post_wash_checklist" } }),
    prisma.upsellingLog.findMany(),
    prisma.customerFeedback.findMany(),
    prisma.maintenanceIncident.findMany(),
    prisma.maintenanceSchedule.count({ where: { isActive: true, nextDueAt: { lt: new Date() } } }),
  ]);

  const towelsLost = reports.reduce((sum, r) => sum + (r.towelsReceivedStart - r.towelsCollectedEnd), 0);
  const towelsIssued = reports.reduce((sum, r) => sum + r.towelsReceivedStart, 0);
  const towelLossRate = towelsIssued > 0 ? Math.round((towelsLost / towelsIssued) * 1000) / 10 : 0;

  const touchUps = qualityLogs.filter((q) => q.touchUpNeeded).length;
  const touchUpRate = qualityLogs.length > 0 ? Math.round((touchUps / qualityLogs.length) * 1000) / 10 : 0;

  const accepted = upsellLogs.filter((l) => l.status === "accepted").length;
  const upsellAcceptanceRate =
    upsellLogs.length > 0 ? Math.round((accepted / upsellLogs.length) * 1000) / 10 : 0;

  const furiousCount = feedback.filter((f) => f.isCustomerFurious).length;
  const satisfactionScore =
    feedback.length > 0
      ? Math.round(((feedback.length - furiousCount) / feedback.length) * 45) / 10
      : 5;

  const pendingIncidents = incidents.filter((i) => i.status === "pending_approval").length;

  res.json({
    towelLossRatePct: towelLossRate,
    towelsLostTotal: towelsLost,
    touchUpCorrectionRatePct: touchUpRate,
    upsellAcceptanceRatePct: upsellAcceptanceRate,
    estimatedSatisfactionScore: satisfactionScore,
    pendingIncidents,
    shiftReportsCompleted: reports.length,
    overdueMaintenanceSchedules,
  });
});

// GET /api/dashboard/daily -> لوحة اليوم حسب توقيت الرياض (لا يحذف بيانات قديمة)
router.get("/daily", requireAuth, requireRole("manager"), async (_req, res) => {
  const dayStart = startOfRiyadhDay();
  const dayEnd = endOfRiyadhDay();
  const inToday = { gte: dayStart, lt: dayEnd };

  const [
    receivedToday,
    deliveredToday,
    cancelledToday,
    queued,
    washing,
    readyOrQc,
    upsellsToday,
    incidentsToday,
    feedbackToday,
    openingsToday,
    closuresToday,
    branches,
    lowStock,
    dirtyCarReports,
    activeEmployees,
    bayStats,
    deliveredJobsToday,
  ] = await Promise.all([
    prisma.jobOrder.count({ where: { createdAt: inToday } }),
    prisma.jobOrder.count({ where: { status: "delivered", deliveredAt: inToday } }),
    prisma.jobOrder.count({ where: { status: "cancelled", updatedAt: inToday } }),
    prisma.jobOrder.count({ where: { status: "queued" } }),
    prisma.jobOrder.count({ where: { status: "washing" } }),
    prisma.jobOrder.count({ where: { status: { in: ["quality_check", "ready"] } } }),
    prisma.upsellingLog.findMany({
      where: { createdAt: inToday },
      include: { service: true },
    }),
    prisma.maintenanceIncident.count({ where: { createdAt: inToday } }),
    prisma.customerFeedback.count({ where: { createdAt: inToday } }),
    prisma.shiftOpening.count({ where: { shiftDate: inToday } }),
    prisma.shiftInventoryReport.count({ where: { shiftDate: inToday } }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, status: true },
    }),
    prisma.branchInventoryBalance.findMany({
      where: { quantity: { lte: 10 } },
      include: { item: { select: { name: true, unit: true, minQty: true } }, branch: { select: { name: true } } },
      take: 20,
    }),
    prisma.maintenanceIncident.count({
      where: { createdAt: inToday, type: "customer_car_damage" },
    }),
    prisma.employee.count({ where: { isActive: true, role: { not: "manager" } } }),
    prisma.bay.findMany({
      select: {
        id: true,
        branchId: true,
        jobOrders: {
          where: { status: { in: ["queued", "washing", "quality_check", "ready"] } },
          select: { id: true },
        },
      },
    }),
    prisma.jobOrder.findMany({
      where: { status: "delivered", deliveredAt: inToday },
      select: { createdAt: true, washingStartedAt: true, readyAt: true, deliveredAt: true },
      take: 500,
    }),
  ]);

  const liveByBranch = await Promise.all(
    branches.map(async (b) => {
      const [q, w, r, active, received, delivered] = await Promise.all([
        prisma.jobOrder.count({ where: { branchId: b.id, status: "queued" } }),
        prisma.jobOrder.count({ where: { branchId: b.id, status: "washing" } }),
        prisma.jobOrder.count({ where: { branchId: b.id, status: { in: ["quality_check", "ready"] } } }),
        prisma.jobOrder.count({
          where: { branchId: b.id, status: { in: ["queued", "washing", "quality_check", "ready"] } },
        }),
        prisma.jobOrder.count({ where: { branchId: b.id, createdAt: inToday } }),
        prisma.jobOrder.count({ where: { branchId: b.id, status: "delivered", deliveredAt: inToday } }),
      ]);
      const branchBays = bayStats.filter((bay) => bay.branchId === b.id);
      const occupiedBays = branchBays.filter((bay) => bay.jobOrders.length > 0).length;
      const bayCount = branchBays.length;
      return {
        branchId: b.id,
        branchName: b.name,
        status: b.status,
        queued: q,
        washing: w,
        ready: r,
        activeInside: active,
        receivedToday: received,
        deliveredToday: delivered,
        bayCount,
        occupiedBays,
        occupancyPct: bayCount > 0 ? Math.round((occupiedBays / bayCount) * 1000) / 10 : 0,
      };
    })
  );

  const upsellAccepted = upsellsToday.filter((u) => u.status === "accepted");
  const upsellRevenue = upsellAccepted.reduce((s, u) => s + (u.service?.basePrice ?? 0), 0);
  const upsellBonus = upsellAccepted.reduce((s, u) => s + u.bonusAmount, 0);

  const occupiedTotal = bayStats.filter((b) => b.jobOrders.length > 0).length;
  const bayTotal = bayStats.length;
  const occupancyPct = bayTotal > 0 ? Math.round((occupiedTotal / bayTotal) * 1000) / 10 : 0;

  function avgMinutes(
    rows: Array<{ start: Date | null; end: Date | null }>,
  ): number | null {
    const vals = rows
      .filter((r) => r.start && r.end && r.end > r.start)
      .map((r) => (r.end!.getTime() - r.start!.getTime()) / 60000);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }

  const avgWaitMinutes = avgMinutes(
    deliveredJobsToday.map((j) => ({
      start: j.createdAt,
      end: j.washingStartedAt,
    }))
  );
  const avgServiceMinutes = avgMinutes(
    deliveredJobsToday.map((j) => ({
      start: j.washingStartedAt,
      end: j.deliveredAt,
    }))
  );
  const avgCycleMinutes = avgMinutes(
    deliveredJobsToday.map((j) => ({
      start: j.createdAt,
      end: j.deliveredAt,
    }))
  );

  res.json({
    timezone: "Asia/Riyadh",
    dayLabel: riyadhDayLabel(),
    dayStart,
    dayEnd,
    totals: {
      receivedToday,
      deliveredToday,
      cancelledToday,
      queued,
      washing,
      ready: readyOrQc,
      activeInside: queued + washing + readyOrQc,
      upsellAttempts: upsellsToday.length,
      upsellAccepted: upsellAccepted.length,
      upsellRevenue,
      upsellBonus,
      incidentsToday,
      dirtyCarReports,
      feedbackToday,
      openingsToday,
      closuresToday,
      activeEmployees,
      lowStockCount: lowStock.length,
      bayTotal,
      occupiedBays: occupiedTotal,
      occupancyPct,
      avgWaitMinutes,
      avgServiceMinutes,
      avgCycleMinutes,
    },
    byBranch: liveByBranch,
    lowStock: lowStock.map((row) => ({
      item: row.item.name,
      unit: row.item.unit,
      branch: row.branch.name,
      quantity: row.quantity,
      minQty: row.item.minQty,
    })),
  });
});

router.get("/alerts", requireAuth, requireRole("manager"), async (_req, res) => {
  res.json(recentAlerts);
});

export default router;
