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

const createSchema = z.object({
  name: z.string().min(1),
  status: z.enum(BRANCH_STATUS).optional(),
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
