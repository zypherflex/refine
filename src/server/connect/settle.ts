import { db } from "@/lib/db";
import { audit } from "../audit";
import { applyPaidPeriod } from "../data/accounts";

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
    await db.user.update({ where: { id: p.userId }, data: { plan: "PRO" } });
    await audit(p.userId, "payment.plan_pro", "Payment", p.id, { reference });
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
