import { prisma } from "../lib/prisma";
import type { AuthPayload } from "../middleware/auth";

export async function writeAudit(opts: {
  actor?: AuthPayload | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: opts.actor?.employeeId ?? null,
        actorName: opts.actor?.name ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId != null ? String(opts.entityId) : null,
        beforeJson: opts.before != null ? JSON.stringify(opts.before) : null,
        afterJson: opts.after != null ? JSON.stringify(opts.after) : null,
      },
    });
  } catch (err) {
    console.error("audit write failed", err);
  }
}
