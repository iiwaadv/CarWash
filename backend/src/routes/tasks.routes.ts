import { Router } from "express";
import { z } from "zod";
import { TASK_PRIORITY } from "../constants/enums";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const employeeSelect = { select: { id: true, name: true, role: true } } as const;

// GET /api/tasks?branchId=&status= -> feeds both the tablet "Tasks & Alerts"
// screen and the manager dashboard's tasks tab.
router.get("/", requireAuth, async (req, res) => {
  // Managers can see every branch's tasks at once (executive dashboard);
  // everyone else is scoped to their own branch unless one is explicitly requested.
  const branchId = req.query.branchId
    ? Number(req.query.branchId)
    : req.auth!.role === "manager"
    ? undefined
    : req.auth!.branchId;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const tasks = await prisma.task.findMany({
    where: { ...(branchId ? { branchId } : {}), ...(status ? { status } : {}) },
    include: { assignedTo: employeeSelect, createdBy: employeeSelect, branch: { select: { name: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
  res.json(tasks);
});

const createSchema = z.object({
  branchId: z.coerce.number().int().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToId: z.coerce.number().int().optional(),
  priority: z.enum(TASK_PRIORITY).optional(),
  dueAt: z.string().optional(),
});

// POST /api/tasks -> managers/supervisors create tasks for their team.
router.post("/", requireAuth, requireRole("manager", "supervisor"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const branchId = req.auth!.role === "manager" && parsed.data.branchId ? parsed.data.branchId : req.auth!.branchId;

  const task = await prisma.task.create({
    data: {
      branchId,
      title: parsed.data.title,
      description: parsed.data.description,
      assignedToId: parsed.data.assignedToId,
      priority: parsed.data.priority ?? "normal",
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
      createdById: req.auth!.employeeId,
    },
    include: { assignedTo: employeeSelect, createdBy: employeeSelect },
  });
  res.status(201).json(task);
});

const editSchema = createSchema.partial();

router.patch("/:id", requireAuth, requireRole("manager", "supervisor"), async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const task = await prisma.task.update({
    where: { id: Number(req.params.id) },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      assignedToId: parsed.data.assignedToId,
      priority: parsed.data.priority,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : undefined,
    },
    include: { assignedTo: employeeSelect, createdBy: employeeSelect },
  });
  res.json(task);
});

// Lifecycle: new -> acknowledged -> in_progress -> done. Anyone authenticated
// at the branch can move a task forward (the crew member acting on it).
router.post("/:id/acknowledge", requireAuth, async (req, res) => {
  const task = await prisma.task.update({
    where: { id: Number(req.params.id) },
    data: { status: "acknowledged", acknowledgedAt: new Date() },
  });
  res.json(task);
});

router.post("/:id/start", requireAuth, async (req, res) => {
  const task = await prisma.task.update({
    where: { id: Number(req.params.id) },
    data: { status: "in_progress", startedAt: new Date() },
  });
  res.json(task);
});

router.post("/:id/complete", requireAuth, async (req, res) => {
  const task = await prisma.task.update({
    where: { id: Number(req.params.id) },
    data: { status: "done", completedAt: new Date() },
  });
  res.json(task);
});

router.delete("/:id", requireAuth, requireRole("manager", "supervisor"), async (req, res) => {
  await prisma.task.delete({ where: { id: Number(req.params.id) } });
  res.status(204).end();
});

export default router;
