import { Router } from "express";
import { z } from "zod";
import { zFormBoolean } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { publicUrl, uploadAudio } from "../middleware/upload";
import { sendUrgentAlert } from "../utils/alerts";

const router = Router();

const fieldsSchema = z.object({
  jobId: z.coerce.number().int(),
  isCustomerFurious: zFormBoolean.optional(),
});

// POST /api/feedback (multipart, field "audio") -> 15s voice rating at hand-off
router.post("/", requireAuth, uploadAudio.single("audio"), async (req, res) => {
  const parsed = fieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  // Audio is normally mandatory, except the emergency "angry customer" SOS
  // button which must never be blocked just because no recording exists yet.
  if (!req.file && !parsed.data.isCustomerFurious) {
    return res.status(400).json({ error: "ملف صوتي مطلوب" });
  }

  const feedback = await prisma.customerFeedback.create({
    data: {
      jobId: parsed.data.jobId,
      voiceRecUrl: req.file ? publicUrl("audio", req.file.filename) : null,
      isCustomerFurious: parsed.data.isCustomerFurious ?? false,
    },
    include: { job: true },
  });

  // [👎 عميل غاضب] -> instant push/SMS-style alert to the general manager's phone.
  if (feedback.isCustomerFurious) {
    await sendUrgentAlert({
      title: "⚠️ عميل غاضب",
      message: `لوحة ${feedback.job.plateNumber} - فرع #${feedback.job.branchId} - يحتاج تدخل فوري`,
      jobId: feedback.jobId,
    });
  }

  res.status(201).json(feedback);
});

router.get("/", requireAuth, async (req, res) => {
  const furiousOnly = req.query.furious === "true";
  const feedback = await prisma.customerFeedback.findMany({
    where: furiousOnly ? { isCustomerFurious: true } : undefined,
    include: { job: { include: { bay: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json(feedback);
});

router.post("/:id/acknowledge", requireAuth, async (req, res) => {
  const feedback = await prisma.customerFeedback.update({
    where: { id: Number(req.params.id) },
    data: { alertAcknowledged: true },
  });
  res.json(feedback);
});

export default router;
