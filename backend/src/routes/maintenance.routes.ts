import { Router, Request, Response } from "express";
import { z } from "zod";
import { INCIDENT_SEVERITY, INCIDENT_TYPE } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { persistUploads, uploadPhotos } from "../middleware/upload";
import { sendUrgentAlert } from "../utils/alerts";
import { writeAudit } from "../utils/audit";

const router = Router();
const managerRoles = ["manager", "branch_manager"] as const;

const fieldsSchema = z.object({
  type: z.enum(INCIDENT_TYPE),
  description: z.string().min(1),
  severity: z.enum(INCIDENT_SEVERITY).optional(),
  compensationPaid: z.coerce.number().nonnegative().optional(),
  proposedDeduction: z.coerce.number().nonnegative().optional(),
  repairCost: z.coerce.number().nonnegative().optional(),
  bayId: z.coerce.number().int().optional(),
  equipmentId: z.coerce.number().int().optional(),
  breakdownType: z.string().optional(),
});

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

  await writeAudit({
    actor: req.auth,
    action: "create",
    entityType: "maintenance",
    entityId: incident.id,
    after: incident,
  });

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
      decidedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(incidents);
});

router.get("/cost-report", requireAuth, requireRole(...managerRoles), async (req, res) => {
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

const decisionSchema = z.object({
  reason: z.string().min(1).optional(),
});

async function applyDecision(
  req: Request,
  res: Response,
  status: "approved" | "rejected" | "needs_amendment" | "returned_for_review",
  requireReason: boolean
) {
  const parsed = decisionSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  if (requireReason && !parsed.data.reason?.trim()) {
    return res.status(400).json({ error: "reason is required" });
  }
  const id = Number(req.params.id);
  const before = await prisma.maintenanceIncident.findUnique({ where: { id } });
  const incident = await prisma.maintenanceIncident.update({
    where: { id },
    data: {
      status,
      decisionReason: parsed.data.reason ?? null,
      decisionAt: new Date(),
      decidedById: req.auth!.employeeId,
      resolvedAt: status === "approved" || status === "rejected" ? new Date() : null,
    },
  });
  await writeAudit({
    actor: req.auth,
    action: status,
    entityType: "maintenance",
    entityId: id,
    before,
    after: incident,
  });
  res.json(incident);
}

router.post("/:id/approve", requireAuth, requireRole(...managerRoles), (req, res) =>
  applyDecision(req, res, "approved", false)
);
router.post("/:id/reject", requireAuth, requireRole(...managerRoles), (req, res) =>
  applyDecision(req, res, "rejected", true)
);
router.post("/:id/amend", requireAuth, requireRole(...managerRoles), (req, res) =>
  applyDecision(req, res, "needs_amendment", true)
);
router.post("/:id/return", requireAuth, requireRole(...managerRoles), (req, res) =>
  applyDecision(req, res, "returned_for_review", true)
);

const partsSchema = z.object({
  sparePartName: z.string().optional(),
  sparePartSku: z.string().optional(),
  sparePartSupplier: z.string().optional(),
  sparePartCost: z.coerce.number().nonnegative().optional(),
  laborCost: z.coerce.number().nonnegative().optional(),
  warrantyMonths: z.coerce.number().int().nonnegative().optional(),
  warrantyPhotoUrl: z.string().optional(),
  invoiceUrl: z.string().optional(),
  workNotes: z.string().optional(),
  repairCost: z.coerce.number().nonnegative().optional(),
});

router.patch("/:id/parts", requireAuth, requireRole(...managerRoles, "supervisor"), async (req, res) => {
  const parsed = partsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
  });
  res.json(incident);
});

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

const completeSchema = z.object({
  repairCost: z.coerce.number().nonnegative().optional(),
  sparePartName: z.string().optional(),
  sparePartSku: z.string().optional(),
  sparePartSupplier: z.string().optional(),
  sparePartCost: z.coerce.number().nonnegative().optional(),
  laborCost: z.coerce.number().nonnegative().optional(),
  warrantyMonths: z.coerce.number().int().nonnegative().optional(),
  workNotes: z.string().optional(),
});

router.post("/:id/complete", requireAuth, async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const hasCost = parsed.data.repairCost !== undefined;
  const { repairCost, ...parts } = parsed.data;
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: {
      status: "completed",
      completedAt: new Date(),
      costPending: !hasCost,
      ...(hasCost ? { repairCost } : {}),
      ...parts,
    },
  });
  res.json(incident);
});

const costSchema = z.object({ repairCost: z.coerce.number().nonnegative() });

router.post("/:id/cost", requireAuth, requireRole(...managerRoles, "supervisor"), async (req, res) => {
  const parsed = costSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const incident = await prisma.maintenanceIncident.update({
    where: { id: Number(req.params.id) },
    data: { repairCost: parsed.data.repairCost, costPending: false },
  });
  res.json(incident);
});

export default router;
