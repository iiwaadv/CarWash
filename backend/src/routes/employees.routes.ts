import { Router } from "express";
import { z } from "zod";
import { EMPLOYEE_ROLE } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { hashPin } from "../utils/pin";
import { writeAudit } from "../utils/audit";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const employees = await prisma.employee.findMany({
    where: branchId ? { branchId } : undefined,
    select: {
      id: true,
      branchId: true,
      name: true,
      role: true,
      jobTitle: true,
      managedBranchIdsJson: true,
      permissionsJson: true,
      isActive: true,
      defaultBayId: true,
      branch: { select: { name: true } },
      defaultBay: { select: { id: true, bayName: true } },
    },
    orderBy: { id: "asc" },
  });
  res.json(employees);
});

const createSchema = z.object({
  branchId: z.number().int(),
  name: z.string().min(1),
  role: z.enum(EMPLOYEE_ROLE),
  jobTitle: z.string().optional(),
  managedBranchIdsJson: z.string().nullable().optional(),
  permissionsJson: z.string().nullable().optional(),
  pinCode: z.string().length(4),
  defaultBayId: z.number().int().nullable().optional(),
});

router.post("/", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { pinCode, ...rest } = parsed.data;
  const employee = await prisma.employee.create({
    data: { ...rest, pinCode: hashPin(pinCode) },
    include: { defaultBay: { select: { id: true, bayName: true } }, branch: { select: { name: true } } },
  });
  await writeAudit({
    actor: req.auth,
    action: "create",
    entityType: "employee",
    entityId: employee.id,
    after: { ...employee, pinCode: undefined },
  });
  res.status(201).json({ ...employee, pinCode: undefined });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(EMPLOYEE_ROLE).optional(),
  jobTitle: z.string().nullable().optional(),
  managedBranchIdsJson: z.string().nullable().optional(),
  permissionsJson: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  pinCode: z.string().length(4).optional(),
  defaultBayId: z.number().int().nullable().optional(),
  branchId: z.number().int().optional(),
});

router.patch("/:id", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { pinCode, ...rest } = parsed.data;
  const before = await prisma.employee.findUnique({ where: { id: Number(req.params.id) } });
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { ...rest, ...(pinCode ? { pinCode: hashPin(pinCode) } : {}) },
    include: { defaultBay: { select: { id: true, bayName: true } }, branch: { select: { name: true } } },
  });
  await writeAudit({
    actor: req.auth,
    action: "update",
    entityType: "employee",
    entityId: employee.id,
    before: before ? { ...before, pinCode: undefined } : null,
    after: { ...employee, pinCode: undefined },
  });
  res.json({ ...employee, pinCode: undefined });
});

router.post("/:id/deactivate", requireAuth, requireRole("manager"), async (req, res) => {
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { isActive: false },
  });
  res.json({ ...employee, pinCode: undefined });
});

router.post("/:id/activate", requireAuth, requireRole("manager"), async (req, res) => {
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { isActive: true },
  });
  res.json({ ...employee, pinCode: undefined });
});

export default router;
