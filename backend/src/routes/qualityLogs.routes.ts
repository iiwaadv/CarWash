import { Router } from "express";
import { z } from "zod";
import { CHECKLIST_AREAS } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();

const checklistItemSchema = z.object({
  status: z.enum(["pending", "ok", "issue", "corrected"]),
});

const createSchema = z.object({
  jobId: z.number().int(),
  checklistResults: z.record(z.enum(CHECKLIST_AREAS), checklistItemSchema),
  scratchesNotes: z.string().optional(),
});

// POST /api/quality-logs -> post-wash 4-area checklist (double-tap turns an item "corrected")
router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const touchUpNeeded = Object.values(parsed.data.checklistResults).some(
    (item) => item.status === "issue" || item.status === "corrected"
  );

  const log = await prisma.qualityLog.create({
    data: {
      jobId: parsed.data.jobId,
      stage: "post_wash_checklist",
      checklistResults: JSON.stringify(parsed.data.checklistResults),
      scratchesNotes: parsed.data.scratchesNotes,
      touchUpNeeded,
      inspectorId: req.auth!.employeeId,
    },
  });

  await prisma.jobOrder.update({
    where: { id: parsed.data.jobId },
    data: { status: "quality_check" },
  });

  res.status(201).json(log);
});

// PATCH /api/quality-logs/:id/touch-up -> double-tap "corrected with towel on the spot"
// This avoids sending the car back to the bay and returning it to the queue.
router.patch("/:id/touch-up", requireAuth, async (req, res) => {
  const area = String(req.body?.area ?? "");
  if (!CHECKLIST_AREAS.includes(area as any)) {
    return res.status(400).json({ error: "area غير صحيح" });
  }

  const log = await prisma.qualityLog.findUnique({ where: { id: Number(req.params.id) } });
  if (!log) return res.status(404).json({ error: "Quality log not found" });

  const checklist = log.checklistResults ? JSON.parse(log.checklistResults) : {};
  checklist[area] = { status: "corrected" };

  const updated = await prisma.qualityLog.update({
    where: { id: log.id },
    data: {
      checklistResults: JSON.stringify(checklist),
      touchUpNeeded: true,
      touchUpAt: new Date(),
    },
  });

  res.json(updated);
});

router.get("/", requireAuth, async (req, res) => {
  const jobId = req.query.jobId ? Number(req.query.jobId) : undefined;
  const logs = await prisma.qualityLog.findMany({
    where: jobId ? { jobId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  res.json(logs);
});

export default router;
