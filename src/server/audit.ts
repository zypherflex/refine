import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient = db,
) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
}
