import { Router } from "express";
import { z } from "zod";
import { BRANCH_STATUS } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// Public on purpose: the login screen needs to list branches before the
// supervisor has authenticated (branch selection happens before the PIN pad).
// Only active (non-archived) branches are offered for login.
router.get("/", async (_req, res) => {
  const branches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
  res.json(branches);
});

// GET /api/branches/manage -> full list (including archived) for the branch
// management screen in the executive dashboard.
router.get("/manage", requireAuth, requireRole("manager"), async (_req, res) => {
  const branches = await prisma.branch.findMany({ orderBy: { id: "asc" } });
  res.json(branches);
});

// GET /api/branches/live -> 360-degree live cards for the executive dashboard
router.get("/live", requireAuth, async (_req, res) => {
  const branches = await prisma.branch.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });

  const cards = await Promise.all(
    branches.map(async (branch) => {
      const [activeJobs, pendingIncidents, furiousFeedback, lastReport, overdueCleanliness] =
        await Promise.all([
          prisma.jobOrder.count({
            where: { branchId: branch.id, status: { in: ["queued", "washing", "quality_check", "ready"] } },
          }),
          prisma.maintenanceIncident.count({
            where: { branchId: branch.id, status: "pending_approval" },
          }),
          prisma.customerFeedback.count({
            where: { isCustomerFurious: true, alertAcknowledged: false, job: { branchId: branch.id } },
          }),
          prisma.shiftInventoryReport.findFirst({
            where: { branchId: branch.id },
            orderBy: { createdAt: "desc" },
          }),
          prisma.cleanlinessCheck.findFirst({
            where: { branchId: branch.id, completedAt: null, dueAt: { lt: new Date() } },
            orderBy: { dueAt: "asc" },
          }),
        ]);

      return {
        ...branch,
        activeJobs,
        pendingIncidents,
        unresolvedFuriousFeedback: furiousFeedback,
        lastShiftReportAt: lastReport?.createdAt ?? null,
        towelsLostLastShift: lastReport
          ? lastReport.towelsReceivedStart - lastReport.towelsCollectedEnd
          : null,
        cleanlinessOverdue: Boolean(overdueCleanliness),
      };
    })
  );

  res.json(cards);
});

// GET /api/branches/:id/detail -> صفحة تفاصيل فرع (إضافة فوق الأساس بدون تغييره)
router.get("/:id/detail", requireAuth, requireRole("manager"), async (req, res) => {
  const id = Number(req.params.id);
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) return res.status(404).json({ error: "Branch not found" });

  const [bays, employees, equipmentCount, activeJobs, jobsByStatus, recentUpsells, recentIncidents, openings, closures, inventory] =
    await Promise.all([
      prisma.bay.findMany({
        where: { branchId: id },
        include: {
          equipment: { where: { isActive: true } },
          jobOrders: {
            where: { status: { in: ["queued", "washing", "quality_check", "ready"] } },
            select: { id: true, plateNumber: true, status: true },
          },
        },
        orderBy: { id: "asc" },
      }),
      prisma.employee.findMany({
        where: { branchId: id },
        select: {
          id: true,
          name: true,
          role: true,
          isActive: true,
          defaultBayId: true,
          defaultBay: { select: { bayName: true } },
        },
        orderBy: { id: "asc" },
      }),
      prisma.bayEquipment.count({ where: { isActive: true, bay: { branchId: id } } }),
      prisma.jobOrder.count({
        where: { branchId: id, status: { in: ["queued", "washing", "quality_check", "ready"] } },
      }),
      prisma.jobOrder.groupBy({
        by: ["status"],
        where: { branchId: id, status: { in: ["queued", "washing", "quality_check", "ready", "delivered", "cancelled"] } },
        _count: true,
      }),
      prisma.upsellingLog.findMany({
        where: { job: { branchId: id }, status: "accepted" },
        include: {
          service: true,
          employee: { select: { name: true } },
          job: { select: { plateNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.maintenanceIncident.findMany({
        where: { branchId: id },
        include: { bay: true, equipment: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.shiftOpening.findMany({
        where: { branchId: id },
        include: { supervisor: { select: { name: true } } },
        orderBy: { shiftDate: "desc" },
        take: 15,
      }),
      prisma.shiftInventoryReport.findMany({
        where: { branchId: id },
        include: { supervisor: { select: { name: true } } },
        orderBy: { shiftDate: "desc" },
        take: 15,
      }),
      prisma.branchInventoryBalance.findMany({
        where: { branchId: id },
        include: { item: true },
      }),
    ]);

  const occupiedBays = bays.filter((b) => b.jobOrders.length > 0).length;
  const freeBays = bays.length - occupiedBays;

  res.json({
    branch,
    counts: {
      bays: bays.length,
      occupiedBays,
      freeBays,
      equipment: equipmentCount,
      employees: employees.length,
      activeEmployees: employees.filter((e) => e.isActive).length,
      activeJobs,
    },
    jobsByStatus: Object.fromEntries(jobsByStatus.map((g) => [g.status, g._count])),
    bays: bays.map((b) => ({
      id: b.id,
      bayName: b.bayName,
      equipment: b.equipment.map((e) => ({ id: e.id, name: e.name })),
      occupied: b.jobOrders.length > 0,
      cars: b.jobOrders,
    })),
    employees,
    recentUpsells,
    recentIncidents,
    openings,
    closures,
    inventory,
  });
});

const TIME_HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "صيغة الوقت يجب أن تكون HH:MM");

const createSchema = z.object({
  name: z.string().min(1),
  status: z.enum(BRANCH_STATUS).optional(),
  shiftOpenTime: TIME_HHMM.optional(),
  shiftCloseTime: TIME_HHMM.optional(),
});

router.post("/", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const branch = await prisma.branch.create({ data: parsed.data });
  res.status(201).json(branch);
});

router.patch("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const id = Number(req.params.id);
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const branch = await prisma.branch.update({ where: { id }, data: parsed.data });
  res.json(branch);
});

// Soft-delete: archive the branch instead of a hard delete so existing job
// history / employees keep a valid foreign key. Archived branches disappear
// from the login screen and live dashboard but stay visible (greyed out) on
// the branch management screen with an option to restore them.
router.delete("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const id = Number(req.params.id);
  const branch = await prisma.branch.update({ where: { id }, data: { isActive: false } });
  res.json(branch);
});

router.post("/:id/activate", requireAuth, requireRole("manager"), async (req, res) => {
  const id = Number(req.params.id);
  const branch = await prisma.branch.update({ where: { id }, data: { isActive: true } });
  res.json(branch);
});

export default router;
