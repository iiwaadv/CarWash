import { Router } from "express";
import { z } from "zod";
import { CAR_TYPE, JOB_STATUS, zFormBoolean } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { publicUrl, uploadPhotos } from "../middleware/upload";

const router = Router();

// GET /api/job-orders?branchId=1 -> feeds the 3-column live yard board
router.get("/", requireAuth, async (req, res) => {
  const branchId = Number(req.query.branchId ?? req.auth!.branchId);
  const jobs = await prisma.jobOrder.findMany({
    where: { branchId },
    include: {
      bay: true,
      qualityLogs: true,
      upsellingLogs: { include: { service: true } },
      customerFeedback: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(jobs);
});

router.get("/:id", requireAuth, async (req, res) => {
  const job = await prisma.jobOrder.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      bay: true,
      qualityLogs: { include: { inspector: true } },
      upsellingLogs: { include: { service: true } },
      customerFeedback: true,
    },
  });
  if (!job) return res.status(404).json({ error: "Job order not found" });
  res.json(job);
});

const createFieldsSchema = z.object({
  plateNumber: z.string().min(1),
  customerPhone: z.string().optional(),
  carType: z.enum(CAR_TYPE).optional(),
  bayId: z.coerce.number().int().optional(),
  isHighlyDirty: zFormBoolean.optional(),
  scratchesNotes: z.string().optional(),
  clientUuid: z.string().optional(),
});

// POST /api/job-orders  (multipart/form-data, field "photos" x4, mandatory pre-wash camera capture)
router.post("/", requireAuth, uploadPhotos.array("photos", 4), async (req, res) => {
  const parsed = createFieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const files = (req.files as Express.Multer.File[]) ?? [];

  if (files.length < 4) {
    return res.status(400).json({
      error: "بروتوكول الفحص قبل الغسيل يتطلب 4 صور إجبارية من جميع الزوايا",
    });
  }

  // Idempotent create: if the tablet retries a queued sync, don't duplicate.
  if (parsed.data.clientUuid) {
    const existing = await prisma.jobOrder.findFirst({
      where: { clientUuid: parsed.data.clientUuid },
    });
    if (existing) return res.status(200).json(existing);
  }

  const job = await prisma.jobOrder.create({
    data: {
      branchId: req.auth!.branchId,
      bayId: parsed.data.bayId,
      plateNumber: parsed.data.plateNumber,
      customerPhone: parsed.data.customerPhone,
      carType: parsed.data.carType,
      isHighlyDirty: parsed.data.isHighlyDirty ?? false,
      clientUuid: parsed.data.clientUuid,
      status: "queued",
    },
  });

  const photosJson = files.map((f, i) => ({
    url: publicUrl("photos", f.filename),
    angle: i + 1,
    takenAt: new Date().toISOString(),
    watermark: `COE • ${parsed.data.plateNumber} • ${new Date().toLocaleString("ar-SA")}`,
  }));

  await prisma.qualityLog.create({
    data: {
      jobId: job.id,
      stage: "pre_wash_photos",
      photosJson: JSON.stringify(photosJson),
      scratchesNotes: parsed.data.scratchesNotes,
      inspectorId: req.auth!.employeeId,
    },
  });

  const full = await prisma.jobOrder.findUnique({
    where: { id: job.id },
    include: { qualityLogs: true },
  });
  res.status(201).json(full);
});

const updateSchema = z.object({
  status: z.enum(JOB_STATUS).optional(),
  bayId: z.number().int().nullable().optional(),
  posInvoiceNo: z.string().optional(),
});

router.patch("/:id", requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const data: any = { ...parsed.data };
  if (parsed.data.status === "delivered") data.deliveredAt = new Date();

  const job = await prisma.jobOrder.update({
    where: { id: Number(req.params.id) },
    data,
  });
  res.json(job);
});

export default router;
