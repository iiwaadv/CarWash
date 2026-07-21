import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { isWithinShiftWindow } from "../utils/shiftWindow";

const router = Router();

const fieldsSchema = z.object({
  shiftDate: z.string(), // ISO date
  towelsReceived: z.coerce.number().int().nonnegative(),
  chemicalsJson: z.string().optional(),
  otherItemsJson: z.string().optional(),
});

// POST /api/shift-openings -> "شاشة فتح الوردية"
// Restricted to the manager-configured shift window per branch, unless the
// logged-in employee is a manager (managers can override the restriction).
router.post("/", requireAuth, async (req, res) => {
  const parsed = fieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const branchId = req.auth!.branchId;
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) return res.status(404).json({ error: "Branch not found" });

  if (req.auth!.role !== "manager" && !isWithinShiftWindow(branch.shiftOpenTime, branch.shiftCloseTime)) {
    return res.status(403).json({
      error: `فتح الوردية مسموح فقط بين ${branch.shiftOpenTime} و ${branch.shiftCloseTime}`,
      shiftOpenTime: branch.shiftOpenTime,
      shiftCloseTime: branch.shiftCloseTime,
    });
  }

  const opening = await prisma.shiftOpening.create({
    data: {
      branchId,
      supervisorId: req.auth!.employeeId,
      shiftDate: new Date(parsed.data.shiftDate),
      towelsReceived: parsed.data.towelsReceived,
      chemicalsJson: parsed.data.chemicalsJson,
      otherItemsJson: parsed.data.otherItemsJson,
    },
  });

  res.status(201).json(opening);
});

// GET /api/shift-openings/latest?branchId= -> feeds the closure wizard's
// "delivered vs remaining" comparison, pre-filling what was received today.
router.get("/latest", requireAuth, async (req, res) => {
  const branchId = Number(req.query.branchId ?? req.auth!.branchId);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);

  const opening = await prisma.shiftOpening.findFirst({
    where: { branchId, shiftDate: { gte: dayStart } },
    orderBy: { createdAt: "desc" },
  });
  res.json(opening);
});

router.get("/", requireAuth, async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const openings = await prisma.shiftOpening.findMany({
    where: branchId ? { branchId } : undefined,
    include: { supervisor: { select: { id: true, name: true } }, branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(openings);
});

export default router;
