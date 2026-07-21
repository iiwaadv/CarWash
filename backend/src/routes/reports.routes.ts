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

async function loadExportRows(branchId: number | undefined, from: Date, to: Date) {
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
  return { jobs, upsells, incidents };
}

// GET /api/reports/export?format=csv|xlsx&from=&to=&branchId=
router.get("/export", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const format = String(req.query.format ?? "csv").toLowerCase();
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const from = req.query.from ? new Date(String(req.query.from)) : daysAgo(7);
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();
  const { jobs, upsells, incidents } = await loadExportRows(branchId, from, to);

  if (format === "xlsx") {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    wb.creator = "Ejaz Car Wash";
    wb.created = new Date();

    const accepted = upsells.filter((u) => u.status === "accepted");
    const kpis = wb.addWorksheet("KPIs");
    kpis.columns = [
      { header: "المؤشر", key: "metric", width: 28 },
      { header: "القيمة", key: "value", width: 18 },
    ];
    kpis.addRows([
      { metric: "من", value: from.toISOString().slice(0, 10) },
      { metric: "إلى", value: to.toISOString().slice(0, 10) },
      { metric: "إجمالي الطلبات", value: jobs.length },
      { metric: "مسلّمة", value: jobs.filter((j) => j.status === "delivered").length },
      { metric: "ملغاة", value: jobs.filter((j) => j.status === "cancelled").length },
      { metric: "بيع إضافي مقبول", value: accepted.length },
      { metric: "بونص", value: accepted.reduce((s, u) => s + u.bonusAmount, 0) },
      {
        metric: "إيراد إضافي تقديري",
        value: accepted.reduce((s, u) => s + (u.service?.basePrice ?? 0), 0),
      },
      { metric: "تكلفة صيانة", value: incidents.reduce((s, i) => s + (i.repairCost || 0), 0) },
      { metric: "بلاغات", value: incidents.length },
    ]);

    const jobsSheet = wb.addWorksheet("الطلبات");
    jobsSheet.columns = [
      { header: "المعرف", key: "id", width: 10 },
      { header: "الفرع", key: "branch", width: 18 },
      { header: "اللوحة", key: "plate", width: 14 },
      { header: "الحالة", key: "status", width: 14 },
      { header: "الموقف", key: "bay", width: 14 },
      { header: "التاريخ", key: "createdAt", width: 22 },
    ];
    for (const j of jobs) {
      jobsSheet.addRow({
        id: j.id,
        branch: j.branch.name,
        plate: j.plateNumber,
        status: j.status,
        bay: j.bay?.bayName ?? "",
        createdAt: j.createdAt.toISOString(),
      });
    }

    const upsellSheet = wb.addWorksheet("البيع الإضافي");
    upsellSheet.columns = [
      { header: "المعرف", key: "id", width: 10 },
      { header: "الفرع", key: "branch", width: 18 },
      { header: "اللوحة", key: "plate", width: 14 },
      { header: "الخدمة", key: "service", width: 20 },
      { header: "الحالة", key: "status", width: 12 },
      { header: "البونص", key: "bonus", width: 12 },
      { header: "الموظف", key: "employee", width: 18 },
      { header: "التاريخ", key: "createdAt", width: 22 },
    ];
    for (const u of upsells) {
      upsellSheet.addRow({
        id: u.id,
        branch: u.job.branch.name,
        plate: u.job.plateNumber,
        service: u.service.serviceName,
        status: u.status,
        bonus: u.bonusAmount,
        employee: u.employee?.name ?? "",
        createdAt: u.createdAt.toISOString(),
      });
    }

    const incSheet = wb.addWorksheet("الصيانة");
    incSheet.columns = [
      { header: "المعرف", key: "id", width: 10 },
      { header: "الفرع", key: "branch", width: 18 },
      { header: "الوصف", key: "desc", width: 40 },
      { header: "الحالة", key: "status", width: 14 },
      { header: "التكلفة", key: "cost", width: 12 },
      { header: "الموقف", key: "bay", width: 14 },
      { header: "الجهاز", key: "equipment", width: 18 },
      { header: "التاريخ", key: "createdAt", width: 22 },
    ];
    for (const i of incidents) {
      incSheet.addRow({
        id: i.id,
        branch: i.branch.name,
        desc: i.description,
        status: i.status,
        cost: i.repairCost,
        bay: i.bay?.bayName ?? "",
        equipment: i.equipment?.name ?? "",
        createdAt: i.createdAt.toISOString(),
      });
    }

    const branchMap = new Map<number, { name: string; jobs: number; delivered: number; cancelled: number }>();
    for (const j of jobs) {
      const cur = branchMap.get(j.branchId) ?? {
        name: j.branch.name,
        jobs: 0,
        delivered: 0,
        cancelled: 0,
      };
      cur.jobs += 1;
      if (j.status === "delivered") cur.delivered += 1;
      if (j.status === "cancelled") cur.cancelled += 1;
      branchMap.set(j.branchId, cur);
    }
    const branchSheet = wb.addWorksheet("حسب الفرع");
    branchSheet.columns = [
      { header: "الفرع", key: "name", width: 20 },
      { header: "طلبات", key: "jobs", width: 12 },
      { header: "مسلّمة", key: "delivered", width: 12 },
      { header: "ملغاة", key: "cancelled", width: 12 },
    ];
    for (const row of branchMap.values()) branchSheet.addRow(row);

    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="ejaz-report.xlsx"`);
    return res.send(Buffer.from(buffer));
  }

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
