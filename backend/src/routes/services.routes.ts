import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

function parseIdList(raw: unknown): number[] | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isFinite(n));
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => Number.isFinite(n));
    } catch {
      return raw
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    }
  }
  return undefined;
}

router.get("/", requireAuth, async (_req, res) => {
  const services = await prisma.service.findMany({ orderBy: { id: "asc" } });
  res.json(services);
});

// GET /api/services/suggest?carType=large&branchId=1 -> automated upsell suggestion
router.get("/suggest", requireAuth, async (req, res) => {
  const carType = String(req.query.carType ?? "");
  const branchId = req.query.branchId ? Number(req.query.branchId) : req.auth!.branchId;
  const services = await prisma.service.findMany();

  const forBranch = services.filter((s) => {
    if (!s.targetBranchIdsJson) return true;
    try {
      const ids: number[] = JSON.parse(s.targetBranchIdsJson);
      return ids.length === 0 || ids.includes(branchId);
    } catch {
      return true;
    }
  });

  const match =
    forBranch.find((s) => s.suggestedTrigger === carType) ??
    forBranch.find((s) => !s.suggestedTrigger) ??
    forBranch[0] ??
    null;
  res.json(match);
});

const createSchema = z.object({
  serviceName: z.string().min(1),
  basePrice: z.number().nonnegative(),
  suggestedTrigger: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  linkedProductIds: z.array(z.number().int()).optional(),
  targetBranchIds: z.array(z.number().int()).optional(),
});

router.post("/", requireAuth, requireRole("manager"), async (req, res) => {
  const body = {
    ...req.body,
    linkedProductIds: parseIdList(req.body.linkedProductIds ?? req.body.linkedProductIdsJson),
    targetBranchIds: parseIdList(req.body.targetBranchIds ?? req.body.targetBranchIdsJson),
  };
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const service = await prisma.service.create({
    data: {
      serviceName: parsed.data.serviceName,
      basePrice: parsed.data.basePrice,
      suggestedTrigger: parsed.data.suggestedTrigger,
      quantity: parsed.data.quantity ?? 1,
      linkedProductIdsJson: parsed.data.linkedProductIds
        ? JSON.stringify(parsed.data.linkedProductIds)
        : null,
      targetBranchIdsJson: parsed.data.targetBranchIds
        ? JSON.stringify(parsed.data.targetBranchIds)
        : null,
    },
  });
  res.status(201).json(service);
});

const updateSchema = z.object({
  serviceName: z.string().min(1).optional(),
  basePrice: z.number().nonnegative().optional(),
  suggestedTrigger: z.string().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  linkedProductIds: z.array(z.number().int()).nullable().optional(),
  targetBranchIds: z.array(z.number().int()).nullable().optional(),
});

router.patch("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const body = {
    ...req.body,
    linkedProductIds:
      req.body.linkedProductIds === null
        ? null
        : parseIdList(req.body.linkedProductIds ?? req.body.linkedProductIdsJson),
    targetBranchIds:
      req.body.targetBranchIds === null
        ? null
        : parseIdList(req.body.targetBranchIds ?? req.body.targetBranchIdsJson),
  };
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const data: any = { ...parsed.data };
  delete data.linkedProductIds;
  delete data.targetBranchIds;
  if (parsed.data.linkedProductIds !== undefined) {
    data.linkedProductIdsJson =
      parsed.data.linkedProductIds === null ? null : JSON.stringify(parsed.data.linkedProductIds);
  }
  if (parsed.data.targetBranchIds !== undefined) {
    data.targetBranchIdsJson =
      parsed.data.targetBranchIds === null ? null : JSON.stringify(parsed.data.targetBranchIds);
  }

  const service = await prisma.service.update({
    where: { id: Number(req.params.id) },
    data,
  });
  res.json(service);
});

router.delete("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  await prisma.service.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

export default router;
