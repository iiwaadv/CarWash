import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../middleware/auth";
import { hashPin, verifyPin } from "../utils/pin";

const router = Router();

const loginSchema = z.object({
  branchId: z.number().int(),
  pinCode: z.string().length(4),
});

// POST /api/auth/login  { branchId, pinCode } -> two-second PIN login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "branchId and 4-digit pinCode are required" });
  }
  const { branchId, pinCode } = parsed.data;

  const employees = await prisma.employee.findMany({
    where: { branchId, isActive: true },
  });

  const employee = employees.find((e) => verifyPin(pinCode, e.pinCode));
  if (!employee) {
    return res.status(401).json({ error: "رمز الدخول غير صحيح" });
  }

  const token = signToken({
    employeeId: employee.id,
    branchId: employee.branchId,
    role: employee.role as any,
    name: employee.name,
  });

  res.json({
    token,
    employee: {
      id: employee.id,
      name: employee.name,
      role: employee.role,
      branchId: employee.branchId,
    },
  });
});

// POST /api/auth/manager-login  { pinCode } -> for the executive/web dashboard (any branch)
router.post("/manager-login", async (req, res) => {
  const { pinCode } = req.body ?? {};
  if (typeof pinCode !== "string" || pinCode.length !== 4) {
    return res.status(400).json({ error: "pinCode مطلوب (4 أرقام)" });
  }

  const managers = await prisma.employee.findMany({
    where: { role: "manager", isActive: true },
  });
  const manager = managers.find((e) => verifyPin(pinCode, e.pinCode));
  if (!manager) {
    return res.status(401).json({ error: "رمز الدخول غير صحيح" });
  }

  const token = signToken({
    employeeId: manager.id,
    branchId: manager.branchId,
    role: manager.role as any,
    name: manager.name,
  });
  res.json({ token, employee: manager });
});

// Helper endpoint used by seed/employee management to hash a new PIN.
export function hashPinValue(pin: string) {
  return hashPin(pin);
}

export default router;
