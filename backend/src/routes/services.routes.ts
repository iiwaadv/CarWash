import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const services = await prisma.service.findMany({ orderBy: { id: "asc" } });
  res.json(services);
});

// GET /api/services/suggest?carType=large -> automated upsell suggestion
router.get("/suggest", requireAuth, async (req, res) => {
  const carType = String(req.query.carType ?? "");
  const services = await prisma.service.findMany();
  const match =
    services.find((s) => s.suggestedTrigger === carType) ??
    services.find((s) => !s.suggestedTrigger) ??
    services[0] ??
    null;
  res.json(match);
});

const createSchema = z.object({
  serviceName: z.string().min(1),
  basePrice: z.number().nonnegative(),
  suggestedTrigger: z.string().optional(),
});

router.post("/", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const service = await prisma.service.create({ data: parsed.data });
  res.status(201).json(service);
});

const updateSchema = z.object({
  serviceName: z.string().min(1).optional(),
  basePrice: z.number().nonnegative().optional(),
  suggestedTrigger: z.string().nullable().optional(),
});

router.patch("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const service = await prisma.service.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
  });
  res.json(service);
});

router.delete("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  await prisma.service.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

export default router;
