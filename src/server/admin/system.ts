import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { audit } from "../audit";
import { PAGE_SIZE, requireAdmin } from "./guard";

export async function jobHealth(actor: Actor) {
  requireAdmin(actor);
  const [byStatus, failed, lastDone] = await Promise.all([
    db.job.groupBy({ by: ["status"], _count: true }),
    db.job.findMany({ where: { status: "FAILED" }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.job.findFirst({ where: { status: "DONE" }, orderBy: { finishedAt: "desc" }, select: { finishedAt: true } }),
  ]);
  return { byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count])) as Record<string, number>, failed, lastDone: lastDone?.finishedAt ?? null };
}

/** Puts failed background jobs back in the queue for the worker to try again. */
export async function retryFailedJobs(actor: Actor, id?: string) {
  requireAdmin(actor);
  const { count } = await db.job.updateMany({ where: { status: "FAILED", ...(id ? { id } : {}) }, data: { status: "QUEUED", attempts: 0, error: "", runAt: new Date(), lockedAt: null } });
  await audit(actor.id, "admin.jobs.retry", "Job", id ?? "all", { count });
  return count;
}

export type AuditFilter = { action?: string; actor?: string; entity?: string; entityId?: string; from?: string; to?: string; page: number };

export async function searchAudit(actor: Actor, f: AuditFilter) {
  requireAdmin(actor);
  const where: Prisma.AuditLogWhereInput = {};
  if (f.action?.trim()) where.action = { startsWith: f.action.trim() };
  if (f.actor?.trim()) where.actor = { is: { email: { contains: f.actor.trim(), mode: "insensitive" } } };
  if (f.entity?.trim()) where.entityType = f.entity.trim();
  if (f.entityId?.trim()) where.entityId = f.entityId.trim();
  const from = f.from ? new Date(`${f.from}T00:00:00Z`) : null;
  const to = f.to ? new Date(`${f.to}T23:59:59Z`) : null;
  if ((from && !isNaN(from.getTime())) || (to && !isNaN(to.getTime()))) where.createdAt = { ...(from && !isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !isNaN(to.getTime()) ? { lte: to } : {}) };
  const [total, rows, entities] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { actor: { select: { id: true, name: true, email: true } } } }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);
  return { total, rows, entities: entities.map((e) => e.entityType) };
}
