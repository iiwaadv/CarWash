import { Router } from "express";
import { z } from "zod";
import { INCIDENT_SEVERITY, INCIDENT_TYPE } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { publicUrl, uploadPhotos } from "../middleware/upload";
import { sendUrgentAlert } from "../utils/alerts";

const router = Router();

const fieldsSchema = z.object({
  type: z.enum(INCIDENT_TYPE),
  description: z.string().min(1),
  severity: z.enum(INCIDENT_SEVERITY).optional(),
  compensationPaid: z.coerce.number().nonnegative().optional(),
  proposedDeduction: z.coerce.number().nonnegative().optional(),
  repairCost: z.coerce.number().nonnegative().optional(),
});

// POST /api/maintenance (multipart photos[]) -> breakdown/incident report from the yard
router.post("/", requireAuth, uploadPhotos.array("photos", 6), async (req, res) => {
  const parsed = fieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const files = (req.files as Express.Multer.File[]) ?? [];

  const incident = await prisma.maintenanceIncident.create({
    data: {
      branchId: req.auth!.branchId,
      reportedById: req.auth!.employeeId,
      type: parsed.data.type,
      description: parsed.data.description,
      severity: parsed.data.severity,
      compensationPaid: parsed.data.compensationPaid ?? 0,
      proposedDeduction: parsed.data.proposedDeduction ?? 0,
      repairCost: parsed.data.repairCost ?? 0,
      photosJson: JSON.stringify(files.map((f) => publicUrl("photos", f.filename))),
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
    include: { branch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(incidents);
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

export default router;
