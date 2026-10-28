import { db } from "@/lib/db";
import { audit } from "../audit";
import { applyPaidPeriod } from "../data/accounts";
import { createAlert } from "../services/alerts";
import { isPlus, PLUS_DAYS, serviceFee } from "@/lib/money";

export const BUSINESS_PLAN_DAYS = 30;

/** Adds days to a business's plan, from today or from the current end date if still running. */
export async function extendBusinessPlan(businessId: string, days: number) {
  const b = await db.hubBusiness.findUniqueOrThrow({ where: { id: businessId } });
  const from = b.planUntil && b.planUntil > new Date() ? b.planUntil : new Date();
  return db.hubBusiness.update({ where: { id: businessId }, data: { planUntil: new Date(from.getTime() + days * 86_400_000) } });
}

/**
 * Marks a payment successful and applies what it paid for, once, whichever provider confirmed it. The amount and
 * currency must match what was asked for, so a tampered amount never changes a plan.
 */
export async function settle(reference: string, paid: { status: "success" | "failed" | "abandoned" | string; amount: number; currency: string }) {
  const p = await db.payment.findUnique({ where: { reference } });
  if (!p) return { ok: false as const, reason: "unknown reference" };
  if (p.status === "SUCCESS") return { ok: true as const, already: true, purpose: p.purpose };
  if (paid.status !== "success" || paid.amount !== p.amountKobo || paid.currency.toUpperCase() !== p.currency) {
    if (paid.status === "failed" || paid.status === "abandoned") await db.payment.update({ where: { id: p.id }, data: { status: "FAILED" } });
    return { ok: false as const, reason: `status ${paid.status}`, purpose: p.purpose };
  }
  const updated = await db.payment.updateMany({ where: { id: p.id, status: { not: "SUCCESS" } }, data: { status: "SUCCESS", paidAt: new Date() } });
  if (!updated.count) return { ok: true as const, already: true, purpose: p.purpose };
  if (p.purpose === "PLAN_PRO") {
    // RefineryLens Plus: 30 days from today, or from the current end date if still running.
    const u = await db.user.findUniqueOrThrow({ where: { id: p.userId }, select: { plan: true, planUntil: true } });
    const from = u.plan === "PRO" && u.planUntil && u.planUntil > new Date() ? u.planUntil : new Date();
    await db.user.update({ where: { id: p.userId }, data: { plan: u.plan === "TEAM" ? "TEAM" : "PRO", planUntil: new Date(from.getTime() + PLUS_DAYS * 86_400_000) } });
    await audit(p.userId, "payment.plan_plus", "Payment", p.id, { reference, currency: p.currency });
  }
  if (p.purpose === "GAS_ORDER" && p.gasOrderId) {
    const o = await db.gasOrder.findUnique({ where: { id: p.gasOrderId }, include: { business: { select: { ownerId: true, name: true } } } });
    if (o && !o.paidOnlineAt && o.priceNaira) {
      const payer = await db.user.findUniqueOrThrow({ where: { id: o.userId }, select: { plan: true, planUntil: true } });
      await db.gasOrder.update({ where: { id: o.id }, data: { paidOnlineAt: new Date(), serviceFeeNaira: serviceFee(o.priceNaira, isPlus(payer)) } });
      await createAlert({ userId: o.business.ownerId, kind: "GAS_ORDER", title: "Gas order paid online: do not collect cash", body: `${o.cylinders} × ${o.cylinderKg} kg to ${o.area}. RefineryLens pays you after delivery.`, link: "/hub/orders", dedupeKey: `order:paid:${o.id}` });
      await createAlert({ userId: o.userId, kind: "GAS_ORDER", title: "Payment received", body: `${o.business.name} has been told the order is paid. Nothing to pay on delivery.`, link: `/orders/${o.id}`, dedupeKey: `order:paid-customer:${o.id}` });
    }
    await audit(p.userId, "payment.gas_order", "Payment", p.id, { reference, orderId: p.gasOrderId, currency: p.currency });
  }
  if (p.purpose === "SELLER_FEES" && p.businessId) {
    // Settles the cash orders the fee was worked out from: delivered before the payment started.
    const r = await db.gasOrder.updateMany({ where: { businessId: p.businessId, status: "DELIVERED", paidOnlineAt: null, commissionSettledAt: null, commissionNaira: { not: null }, deliveredAt: { lte: p.createdAt } }, data: { commissionSettledAt: new Date() } });
    await audit(p.userId, "payment.seller_fees", "Payment", p.id, { reference, orders: r.count });
  }
  if (p.purpose === "BUSINESS_PLAN" && p.businessId) {
    await extendBusinessPlan(p.businessId, BUSINESS_PLAN_DAYS);
    await audit(p.userId, "payment.business_plan", "Payment", p.id, { reference, businessId: p.businessId });
  }
  if (p.purpose === "DATA_PLAN" && p.dataAccountId && p.planId && p.periodDays) {
    await applyPaidPeriod(p.dataAccountId, p.planId, p.periodDays);
    await audit(p.userId, "payment.data_plan", "Payment", p.id, { reference, plan: p.planId, days: p.periodDays, currency: p.currency });
  }
  return { ok: true as const, already: false, purpose: p.purpose };
}
