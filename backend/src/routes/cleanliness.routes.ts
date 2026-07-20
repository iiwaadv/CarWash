import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { publicUrl, uploadPhotos } from "../middleware/upload";

const router = Router();
const INTERVAL_HOURS = Number(process.env.CLEANLINESS_INTERVAL_HOURS ?? 4);
const LOCK_GRACE_MINUTES = Number(process.env.CLEANLINESS_LOCK_MINUTES ?? 15);

async function getOrCreateCurrentCheck(branchId: number, supervisorId: number) {
  let check = await prisma.cleanlinessCheck.findFirst({
    where: { branchId, completedAt: null },
    orderBy: { dueAt: "asc" },
  });
  if (!check) {
    const dueAt = new Date(Date.now() + INTERVAL_HOURS * 60 * 60 * 1000);
    check = await prisma.cleanlinessCheck.create({ data: { branchId, supervisorId, dueAt } });
  }
  return check;
}

// GET /api/cleanliness/status -> mandatory hygiene round status + partial screen lock flag
router.get("/status", requireAuth, async (req, res) => {
  const branchId = req.auth!.branchId;
  const check = await getOrCreateCurrentCheck(branchId, req.auth!.employeeId);
  const now = new Date();
  const overdueMs = now.getTime() - check.dueAt.getTime();
  const isOverdue = overdueMs > 0;
  const isLocked = overdueMs > LOCK_GRACE_MINUTES * 60 * 1000;

  res.json({ ...check, isOverdue, isLocked, now: now.toISOString() });
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

  const wasLocked = Date.now() - existing.dueAt.getTime() > LOCK_GRACE_MINUTES * 60 * 1000;

  await prisma.cleanlinessCheck.update({
    where: { id },
    data: {
      completedAt: new Date(),
      wasLocked,
      photosJson: JSON.stringify(files.map((f) => publicUrl("photos", f.filename))),
    },
  });

  const next = await prisma.cleanlinessCheck.create({
    data: {
      branchId: existing.branchId,
      supervisorId: req.auth!.employeeId,
      dueAt: new Date(Date.now() + INTERVAL_HOURS * 60 * 60 * 1000),
    },
  });

  res.status(201).json(next);
});

export default router;
