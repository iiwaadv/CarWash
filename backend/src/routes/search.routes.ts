import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/search?q=
 * بحث عام فوق الأساس الحالي: طلبات (لوحة/جوال/فاتورة)، موظفون، فروع، أجهزة، بلاغات.
 */
router.get("/", requireAuth, requireRole("manager"), async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 1) {
    return res.json({
      query: q,
      jobs: [],
      employees: [],
      branches: [],
      equipment: [],
      incidents: [],
    });
  }

  const contains = { contains: q, mode: "insensitive" as const };

  const [jobs, employees, branches, equipment, incidents] = await Promise.all([
    prisma.jobOrder.findMany({
      where: {
        OR: [
          { plateNumber: contains },
          { customerPhone: contains },
          { posInvoiceNo: contains },
        ],
      },
      include: {
        branch: { select: { id: true, name: true } },
        bay: { select: { id: true, bayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.employee.findMany({
      where: { name: contains, isActive: true },
      include: { branch: { select: { id: true, name: true } } },
      take: 20,
    }),
    prisma.branch.findMany({
      where: { name: contains, isActive: true },
      take: 10,
    }),
    prisma.bayEquipment.findMany({
      where: { name: contains, isActive: true },
      include: {
        bay: {
          select: {
            bayName: true,
            branch: { select: { id: true, name: true } },
          },
        },
      },
      take: 20,
    }),
    prisma.maintenanceIncident.findMany({
      where: {
        OR: [{ description: contains }, { breakdownType: contains }],
      },
      include: {
        branch: { select: { id: true, name: true } },
        bay: { select: { bayName: true } },
        equipment: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  res.json({ query: q, jobs, employees, branches, equipment, incidents });
});

export default router;
