import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { persistUploads, uploadPhotos } from "../middleware/upload";

const router = Router();
const INTERVAL_HOURS = Number(process.env.CLEANLINESS_INTERVAL_HOURS ?? 4);
const LOCK_GRACE_MINUTES = Number(process.env.CLEANLINESS_LOCK_MINUTES ?? 15);

async function getOrCreateCurrentCheck(branchId: number, supervisorId: number) {
  const open = await prisma.cleanlinessCheck.findMany({
    where: { branchId, completedAt: null },
    orderBy: { dueAt: "asc" },
  });

  if (open.length === 0) {
    return prisma.cleanlinessCheck.create({
      data: {
        branchId,
        supervisorId,
        dueAt: new Date(Date.now() + INTERVAL_HOURS * 60 * 60 * 1000),
      },
    });
  }

  // إن وُجدت فحوصات مفتوحة مكررة، أغلِق الزائدة حتى لا يبقى التجميد عالقاً
  const [current, ...dupes] = open;
  if (dupes.length > 0) {
    await prisma.cleanlinessCheck.updateMany({
      where: { id: { in: dupes.map((d) => d.id) } },
      data: {
        completedAt: new Date(),
        photosJson: JSON.stringify({ note: "auto_closed_duplicate" }),
      },
    });
  }
  return current;
}

// GET /api/cleanliness/status -> mandatory hygiene round status + partial screen lock flag
router.get("/status", requireAuth, async (req, res) => {
  const branchId = req.auth!.branchId;
  const check = await getOrCreateCurrentCheck(branchId, req.auth!.employeeId);
  const now = new Date();
  const overdueMs = now.getTime() - check.dueAt.getTime();
  const isOverdue = overdueMs > 0;
  const isLocked = overdueMs > LOCK_GRACE_MINUTES * 60 * 1000;

  res.json({
    id: check.id,
    branchId: check.branchId,
    dueAt: check.dueAt,
    completedAt: check.completedAt,
    isOverdue,
    isLocked,
    now: now.toISOString(),
  });
});

// POST /api/cleanliness/:id/complete (multipart photos[]) -> unlocks the screen, schedules next round
router.post("/:id/complete", requireAuth, uploadPhotos.array("photos", 6), async (req, res) => {
  const id = Number(req.params.id);
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) {
    return res.status(400).json({ error: "صور الحمامات وغرف الانتظار والساحة مطلوبة" });
  }

  const existing = await prisma.cleanlinessCheck.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "Check not found" });
  if (existing.branchId !== req.auth!.branchId) {
    return res.status(403).json({ error: "لا يمكن إكمال جولة فرع آخر" });
  }

  const wasLocked = Date.now() - existing.dueAt.getTime() > LOCK_GRACE_MINUTES * 60 * 1000;
  const photoUrls = await persistUploads(files, "photos");

  // أكمل الفحص الحالي + أي فحوصات مفتوحة أخرى لنفس الفرع (تمنع عودة التجميد)
  await prisma.$transaction([
    prisma.cleanlinessCheck.update({
      where: { id },
      data: {
        completedAt: new Date(),
        wasLocked,
        photosJson: JSON.stringify(photoUrls),
        supervisorId: req.auth!.employeeId,
      },
    }),
    prisma.cleanlinessCheck.updateMany({
      where: {
        branchId: existing.branchId,
        completedAt: null,
        id: { not: id },
      },
      data: {
        completedAt: new Date(),
        photosJson: JSON.stringify({ note: "closed_with_sibling_complete" }),
      },
    }),
  ]);

  const next = await prisma.cleanlinessCheck.create({
    data: {
      branchId: existing.branchId,
      supervisorId: req.auth!.employeeId,
      dueAt: new Date(Date.now() + INTERVAL_HOURS * 60 * 60 * 1000),
    },
  });

  const now = new Date();
  res.status(201).json({
    id: next.id,
    branchId: next.branchId,
    dueAt: next.dueAt,
    completedAt: next.completedAt,
    isOverdue: false,
    isLocked: false,
    now: now.toISOString(),
  });
});

export default router;
