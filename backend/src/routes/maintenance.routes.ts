import { Router } from "express";
import { z } from "zod";
import { INCIDENT_SEVERITY, INCIDENT_TYPE } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { persistUploads, uploadPhotos } from "../middleware/upload";
import { sendUrgentAlert } from "../utils/alerts";

const router = Router();

const fieldsSchema = z.object({
  type: z.enum(INCIDENT_TYPE),
  description: z.string().min(1),
  severity: z.enum(INCIDENT_SEVERITY).optional(),
  compensationPaid: z.coerce.number().nonnegative().optional(),
  proposedDeduction: z.coerce.number().nonnegative().optional(),
  repairCost: z.coerce.number().nonnegative().optional(),
  // ربط البلاغ بموقف وجهاز محددين؛ تركهما فارغين يعني "عطل عام"
  bayId: z.coerce.number().int().optional(),
  equipmentId: z.coerce.number().int().optional(),
  breakdownType: z.string().optional(),
});

// POST /api/maintenance (multipart photos[]) -> breakdown/incident report from the yard
router.post("/", requireAuth, uploadPhotos.array("photos", 6), async (req, res) => {
  const parsed = fieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const files = (req.files as Express.Multer.File[]) ?? [];
  const photoUrls = await persistUploads(files, "photos");

  const incident = await prisma.maintenanceIncident.create({
    data: {
      branchId: req.auth!.branchId,
      reportedById: req.auth!.employeeId,
      bayId: parsed.data.bayId,
      equipmentId: parsed.data.equipmentId,
      breakdownType: parsed.data.breakdownType,
      type: parsed.data.type,
      description: parsed.data.description,
      severity: parsed.data.severity,
      compensationPaid: parsed.data.compensationPaid ?? 0,
      proposedDeduction: parsed.data.proposedDeduction ?? 0,
      repairCost: parsed.data.repairCost ?? 0,
      photosJson: JSON.stringify(photoUrls),
      status: "pending_approval",
    },
  });

  if (parsed.data.type === "customer_car_damage" || parsed.data.severity === "critical_stop") {
    await sendUrgentAlert({
      title: parsed.data.severity === "critical_stop" ? "🛑 توقف كامل للعمل" : "🚗 تلف سيارة عميل",
      message: incident.description,
      incidentId: incident.id,
    });
  }

  res.status(201).json(incident);
});

router.get("/", requireAuth, async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const incidents = await prisma.maintenanceIncident.findMany({
    where: { ...(status ? { status } : {}), ...(branchId ? { branchId } : {}) },
    include: {
      branch: { select: { name: true } },
      bay: { select: { id: true, bayName: true } },
      equipment: { select: { id: true, name: true } },
      receivedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(incidents);
});

// Must be registered before /:id/* so Express doesn't treat "cost-report" as an id.
router.get("/cost-report", requireAuth, requireRole("manager"), async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const incidents = await prisma.maintenanceIncident.findMany({
    where: { ...(branchId ? { branchId } : {}), repairCost: { gt: 0 } },
    include: { bay: { select: { id: true, bayName: true } }, equipment: { select: { id: true, name: true } } },
  });

  const byBay = new Map<string, { bayId: number | null; bayName: string; totalCost: number; count: number }>();
  const byEquipment = new Map<string, { equipmentId: number | null; equipmentName: string; totalCost: number; count: number }>();

  for (const inc of incidents) {
    const bayKey = inc.bay ? String(inc.bay.id) : "general";
    const bayEntry = byBay.get(bayKey) ?? {
      bayId: inc.bay?.id ?? null,
      bayName: inc.bay?.bayName ?? "عطل عام",
      totalCost: 0,
      count: 0,
    };
    bayEntry.totalCost += inc.repairCost;
    bayEntry.count += 1;
    byBay.set(bayKey, bayEntry);

    if (inc.equipment) {
      const eqKey = String(inc.equipment.id);
      const eqEntry = byEquipment.get(eqKey) ?? {
        equipmentId: inc.equipment.id,
        equipmentName: inc.equipment.name,
        totalCost: 0,
        count: 0,
      };
      eqEntry.totalCost += inc.repairCost;
      eqEntry.count += 1;
      byEquipment.set(eqKey, eqEntry);
    }
  }

  res.json({
    byBay: Array.from(byBay.values()).sort((a, b) => b.totalCost - a.totalCost),
    byEquipment: Array.from(byEquipment.values()).sort((a, b) => b.totalCost - a.totalCost),
    pendingCostCount: await prisma.maintenanceIncident.count({
      where: { ...(branchId ? { branchId } : {}), costPending: true },
    }),
    totalCost: incidents.reduce((sum, inc) => sum + inc.repairCost, 0),
  });
});

// "صندوق القرارات المعلقة" - manual approval box on the executive dashboard.
router.post("/:id/approve", requireAuth, requireRole("manager"), async (req, res) => {
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: { status: "approved", resolvedAt: new Date() },
  });
  res.json(incident);
});

router.post("/:id/reject", requireAuth, requireRole("manager"), async (req, res) => {
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: { status: "rejected", resolvedAt: new Date() },
  });
  res.json(incident);
});

// دورة الصيانة الكاملة: طلب -> اعتماد -> استلام الفني -> جاري العمل -> انتهاء
// (مع إدخال التكلفة أو إبقاؤها معلقة).
router.post("/:id/receive", requireAuth, async (req, res) => {
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: { status: "received", receivedById: req.auth!.employeeId, receivedAt: new Date() },
  });
  res.json(incident);
});

router.post("/:id/start-work", requireAuth, async (req, res) => {
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: { status: "in_progress", startedAt: new Date() },
  });
  res.json(incident);
});

const completeSchema = z.object({ repairCost: z.coerce.number().nonnegative().optional() });

// إذا لم تُدخل التكلفة الآن، تبقى العملية "معلقة" حتى إدخالها لاحقاً عبر /cost.
router.post("/:id/complete", requireAuth, async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const hasCost = parsed.data.repairCost !== undefined;
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: {
      status: "completed",
      completedAt: new Date(),
      costPending: !hasCost,
      ...(hasCost ? { repairCost: parsed.data.repairCost } : {}),
    },
  });
  res.json(incident);
});

const costSchema = z.object({ repairCost: z.coerce.number().nonnegative() });

router.post("/:id/cost", requireAuth, requireRole("manager", "supervisor"), async (req, res) => {
  const parsed = costSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: { repairCost: parsed.data.repairCost, costPending: false },
  });
  res.json(incident);
});

export default router;
