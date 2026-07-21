import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/shifts?branchId=&from=&to=  -> سجل دائم لفتح وإغلاق الورديات
router.get("/", requireAuth, requireRole("manager"), async (req, res) => {
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

export default router;
