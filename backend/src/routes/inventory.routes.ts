import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

const MOVEMENT_TYPES = ["warehouse_in", "deliver_to_branch", "consume", "adjust"] as const;

router.get("/items", requireAuth, async (_req, res) => {
  const items = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    include: {
      balances: { include: { branch: { select: { id: true, name: true } } } },
    },
    orderBy: { id: "asc" },
  });
  res.json(items);
});

const itemSchema = z.object({
  name: z.string().min(1),
  unit: z.string().min(1).optional(),
  warehouseQty: z.number().nonnegative().optional(),
  minQty: z.number().nonnegative().optional(),
  supplier: z.string().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  category: z.string().optional(),
  sku: z.string().optional(),
});

router.post("/items", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const item = await prisma.inventoryItem.create({
    data: {
      name: parsed.data.name,
      unit: parsed.data.unit ?? "liter",
      warehouseQty: parsed.data.warehouseQty ?? 0,
      minQty: parsed.data.minQty ?? 0,
      supplier: parsed.data.supplier,
      purchasePrice: parsed.data.purchasePrice,
      category: parsed.data.category,
      sku: parsed.data.sku,
    },
    include: { balances: true },
  });
  res.status(201).json(item);
});

router.patch("/items/:id", requireAuth, requireRole("manager", "branch_manager"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
    minQty: z.number().nonnegative().optional(),
    supplier: z.string().nullable().optional(),
    purchasePrice: z.number().nonnegative().nullable().optional(),
    category: z.string().nullable().optional(),
    sku: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const item = await prisma.inventoryItem.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
    include: { balances: { include: { branch: { select: { id: true, name: true } } } } },
  });
  res.json(item);
});

router.get("/movements", requireAuth, async (req, res) => {
  const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      ...(itemId ? { itemId } : {}),
      ...(branchId ? { branchId } : {}),
    },
    include: {
      item: { select: { name: true, unit: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(movements);
});

const movementSchema = z.object({
  itemId: z.number().int(),
  type: z.enum(MOVEMENT_TYPES),
  quantity: z.number().positive(),
  branchId: z.number().int().optional(),
  recipientName: z.string().optional(),
  notes: z.string().optional(),
});

router.post("/movements", requireAuth, requireRole("manager"), async (req, res) => {
  const parsed = movementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { itemId, type, quantity, branchId, recipientName, notes } = parsed.data;
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || !item.isActive) return res.status(404).json({ error: "Item not found" });

  if ((type === "deliver_to_branch" || type === "consume") && !branchId) {
    return res.status(400).json({ error: "branchId required for this movement type" });
  }

  const result = await prisma.$transaction(async (tx) => {
    if (type === "warehouse_in") {
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { warehouseQty: { increment: quantity } },
      });
    } else if (type === "deliver_to_branch") {
      if (item.warehouseQty < quantity) {
        throw Object.assign(new Error("الكمية غير كافية في المستودع"), { status: 400 });
      }
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { warehouseQty: { decrement: quantity } },
      });
      await tx.branchInventoryBalance.upsert({
        where: { itemId_branchId: { itemId, branchId: branchId! } },
        create: { itemId, branchId: branchId!, quantity },
        update: { quantity: { increment: quantity } },
      });
    } else if (type === "consume") {
      const balance = await tx.branchInventoryBalance.findUnique({
        where: { itemId_branchId: { itemId, branchId: branchId! } },
      });
      if (!balance || balance.quantity < quantity) {
        throw Object.assign(new Error("الكمية غير كافية في رصيد الفرع"), { status: 400 });
      }
      await tx.branchInventoryBalance.update({
        where: { itemId_branchId: { itemId, branchId: branchId! } },
        data: { quantity: { decrement: quantity } },
      });
    } else if (type === "adjust") {
      // تعديل رصيد الفرع مباشرة (موجب أو سالب عبر quantity + notes)
      if (branchId) {
        await tx.branchInventoryBalance.upsert({
          where: { itemId_branchId: { itemId, branchId } },
          create: { itemId, branchId, quantity },
          update: { quantity },
        });
      } else {
        await tx.inventoryItem.update({
          where: { id: itemId },
          data: { warehouseQty: quantity },
        });
      }
    }

    return tx.inventoryMovement.create({
      data: {
        itemId,
        branchId: branchId ?? null,
        type,
        quantity,
        recipientName,
        notes,
        createdById: req.auth!.employeeId,
      },
      include: {
        item: { select: { name: true, unit: true } },
        branch: { select: { name: true } },
      },
    });
  });

  res.status(201).json(result);
});

export default router;
