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
    // Gas orders paid online are mostly the seller's money; their fees and commission are counted in gasEarnings.
    db.payment.findMany({ where: { status: "SUCCESS", paidAt: { gte: yearAgo }, purpose: { not: "GAS_ORDER" } }, select: { paidAt: true, amountKobo: true, purpose: true, currency: true } }),
    db.payment.findMany({ distinct: ["purpose"], select: { purpose: true } }),
    db.hubBusiness.findMany({ where: { planUntil: { gt: now, lt: new Date(now.getTime() + 14 * 86_400_000) } }, select: { id: true, name: true, planUntil: true, owner: { select: { email: true } } }, orderBy: { planUntil: "asc" } }),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(yearAgo.getUTCFullYear(), yearAgo.getUTCMonth() + i, 1));
    return { key: d.toISOString().slice(0, 7), naira: 0, usd: 0, count: 0 };
  });
  // Naira and dollars are kept apart: converting at one day's rate would misstate both.
  for (const p of paid) {
    const m = months.find((x) => x.key === p.paidAt!.toISOString().slice(0, 7));
    if (!m) continue;
    if (p.currency === "USD") m.usd += p.amountKobo / 100;
    else m.naira += p.amountKobo / 100;
    m.count++;
  }
  return { total, rows, months, purposes: purposes.map((p) => p.purpose), expiring };
}

/** What RefineryLens kept from gas orders in the last 12 months, and what it holds for sellers right now. */
export async function gasEarnings(actor: Actor, now = new Date()) {
  requireAdmin(actor);
  const since = new Date(now.getTime() - 365 * 86_400_000);
  const [fees, commission, owed] = await Promise.all([
    db.gasOrder.aggregate({ where: { paidOnlineAt: { gte: since } }, _sum: { serviceFeeNaira: true }, _count: true }),
    db.gasOrder.aggregate({ where: { commissionSettledAt: { gte: since } }, _sum: { commissionNaira: true }, _count: true }),
    db.gasOrder.aggregate({ where: { status: "DELIVERED", paidOnlineAt: null, commissionSettledAt: null, commissionNaira: { not: null } }, _sum: { commissionNaira: true }, _count: true }),
  ]);
  return {
    serviceFees: fees._sum.serviceFeeNaira ?? 0, paidOnline: fees._count,
    commission: commission._sum.commissionNaira ?? 0, commissionOrders: commission._count,
    commissionOwed: owed._sum.commissionNaira ?? 0, commissionOwedOrders: owed._count,
  };
}
