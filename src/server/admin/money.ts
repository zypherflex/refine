import type { PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { PAGE_SIZE, requireAdmin } from "./guard";

export type PaymentFilter = { status?: string; purpose?: string; q?: string; page: number };

export async function listPayments(actor: Actor, f: PaymentFilter, now = new Date()) {
  requireAdmin(actor);
  const where: Prisma.PaymentWhereInput = {};
  if (f.status) where.status = f.status as PaymentStatus;
  if (f.purpose) where.purpose = f.purpose;
  if (f.q?.trim()) where.OR = [{ reference: { contains: f.q.trim() } }, { user: { email: { contains: f.q.trim(), mode: "insensitive" } } }];
  const yearAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const [total, rows, paid, purposes, expiring] = await Promise.all([
    db.payment.count({ where }),
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { id: true, name: true, email: true } } } }),
    db.payment.findMany({ where: { status: "SUCCESS", paidAt: { gte: yearAgo } }, select: { paidAt: true, amountKobo: true, purpose: true } }),
    db.payment.findMany({ distinct: ["purpose"], select: { purpose: true } }),
    db.hubBusiness.findMany({ where: { planUntil: { gt: now, lt: new Date(now.getTime() + 14 * 86_400_000) } }, select: { id: true, name: true, planUntil: true, owner: { select: { email: true } } }, orderBy: { planUntil: "asc" } }),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(yearAgo.getUTCFullYear(), yearAgo.getUTCMonth() + i, 1));
    return { key: d.toISOString().slice(0, 7), naira: 0, count: 0 };
  });
  for (const p of paid) {
    const m = months.find((x) => x.key === p.paidAt!.toISOString().slice(0, 7));
    if (m) { m.naira += p.amountKobo / 100; m.count++; }
  }
  return { total, rows, months, purposes: purposes.map((p) => p.purpose), expiring };
}
