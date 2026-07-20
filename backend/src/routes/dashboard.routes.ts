import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { recentAlerts } from "../utils/alerts";

const router = Router();

// GET /api/dashboard/pending-decisions -> "صندوق القرارات المعلقة"
router.get("/pending-decisions", requireAuth, requireRole("manager"), async (_req, res) => {
  const incidents = await prisma.maintenanceIncident.findMany({
    where: { status: "pending_approval" },
    include: { branch: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(incidents);
});

// GET /api/dashboard/kpis -> executive summary indicators
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

router.get("/alerts", requireAuth, requireRole("manager"), async (_req, res) => {
  res.json(recentAlerts);
});

export default router;
