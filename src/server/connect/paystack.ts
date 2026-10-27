import crypto from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { audit } from "../audit";
import { callJson } from "./http";

/**
 * Paystack card payments for the Pro research plan and the trade hub Business plan. The plan changes only after Paystack confirms the charge, either through
 * the verify call when the customer returns or through the signed webhook, whichever comes first.
 * Docs: https://paystack.com/docs/api/transaction/ and https://paystack.com/docs/payments/webhooks/
 */

const API = "https://api.paystack.co";

export function paystackConfigured() {
  return (process.env.PAYMENT_PROVIDER ?? "").toLowerCase() === "paystack" && Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/** Pro plan price in kobo, from PRO_PLAN_PRICE_NGN (default ₦25,000 a month). */
export function proPriceKobo() {
  const ngn = Number(process.env.PRO_PLAN_PRICE_NGN ?? 25_000);
  return Math.round((Number.isFinite(ngn) && ngn > 0 ? ngn : 25_000) * 100);
}

/** Business plan price in kobo for 30 days, from BUSINESS_PLAN_PRICE_NGN (default ₦15,000). */
export function businessPriceKobo() {
  const ngn = Number(process.env.BUSINESS_PLAN_PRICE_NGN ?? 15_000);
  return Math.round((Number.isFinite(ngn) && ngn > 0 ? ngn : 15_000) * 100);
}

export const BUSINESS_PLAN_DAYS = 30;

const auth = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" });

type Purpose = "PLAN_PRO" | "BUSINESS_PLAN";

/** Starts a checkout and returns the Paystack page to send the customer to. */
export async function startProCheckout(actor: Actor & { email: string }) {
  return startCheckout(actor, "PLAN_PRO", proPriceKobo(), null);
}

/** Business plan checkout for the actor's own business, which must be verified. */
export async function startBusinessCheckout(actor: Actor & { email: string }) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) throw new AppError("Set up your business profile first.");
  if (b.verification !== "VERIFIED") throw new AppError("The Business plan is for verified businesses. Request verification first.");
  return startCheckout(actor, "BUSINESS_PLAN", businessPriceKobo(), b.id);
}

async function startCheckout(actor: Actor & { email: string }, purpose: Purpose, amountKobo: number, businessId: string | null) {
  if (!paystackConfigured()) throw new AppError("Card payments are not configured.");
  const reference = `rl_${crypto.randomBytes(12).toString("hex")}`;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await db.payment.create({ data: { userId: actor.id, provider: "paystack", reference, purpose, amountKobo, businessId } });
  const res = await callJson<{ status: boolean; data: { authorization_url: string } }>("Paystack", `${API}/transaction/initialize`, {
    method: "POST",
    headers: auth(),
    body: JSON.stringify({ email: actor.email, amount: amountKobo, currency: "NGN", reference, callback_url: `${base}/api/payments/paystack/callback`, metadata: { purpose, userId: actor.id } }),
  });
  if (!res.status || !res.data?.authorization_url) throw new AppError("Paystack did not start the payment. Try again.");
  return res.data.authorization_url;
}

/**
 * Marks a payment successful and applies what it paid for, once. Called after verifying with Paystack; checks the
 * amount and currency against what was asked for, so a tampered amount never upgrades a plan.
 */
async function settle(reference: string, paid: { status: string; amount: number; currency: string }) {
  const p = await db.payment.findUnique({ where: { reference } });
  if (!p) return { ok: false as const, reason: "unknown reference" };
  if (p.status === "SUCCESS") return { ok: true as const, already: true, purpose: p.purpose };
  if (paid.status !== "success" || paid.amount !== p.amountKobo || paid.currency !== "NGN") {
    if (paid.status === "failed" || paid.status === "abandoned") await db.payment.update({ where: { id: p.id }, data: { status: "FAILED" } });
    return { ok: false as const, reason: `status ${paid.status}`, purpose: p.purpose };
  }
  const updated = await db.payment.updateMany({ where: { id: p.id, status: { not: "SUCCESS" } }, data: { status: "SUCCESS", paidAt: new Date() } });
  if (updated.count && p.purpose === "PLAN_PRO") {
    await db.user.update({ where: { id: p.userId }, data: { plan: "PRO" } });
    await audit(p.userId, "payment.plan_pro", "Payment", p.id, { reference });
  }
  if (updated.count && p.purpose === "BUSINESS_PLAN" && p.businessId) {
    await extendBusinessPlan(p.businessId, BUSINESS_PLAN_DAYS);
    await audit(p.userId, "payment.business_plan", "Payment", p.id, { reference, businessId: p.businessId });
  }
  return { ok: true as const, already: false, purpose: p.purpose };
}

/** Asks Paystack for the transaction's real status. Never trust the redirect alone. */
export async function verifyAndSettle(reference: string) {
  if (!paystackConfigured()) throw new AppError("Card payments are not configured.");
  if (!/^rl_[a-f0-9]{24}$/.test(reference)) return { ok: false as const, reason: "bad reference" };
  const res = await callJson<{ status: boolean; data: { status: string; amount: number; currency: string; reference: string } }>("Paystack", `${API}/transaction/verify/${encodeURIComponent(reference)}`, { headers: auth() });
  return settle(reference, res.data);
}

/** Paystack signs webhook bodies with HMAC-SHA512 of the raw body using the secret key, in x-paystack-signature. */
export function validWebhookSignature(rawBody: string, signature: string | null) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !signature) return false;
  const expected = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Handles a verified webhook. For charge.success it re-verifies with the API before settling. */
export async function handleWebhook(event: { event?: string; data?: { reference?: string } }) {
  if (event.event !== "charge.success" || !event.data?.reference) return { handled: false };
  const r = await verifyAndSettle(event.data.reference);
  return { handled: true, ...r };
}

/** Adds days to a business's plan, from today or from the current end date if still running. */
export async function extendBusinessPlan(businessId: string, days: number) {
  const b = await db.hubBusiness.findUniqueOrThrow({ where: { id: businessId } });
  const from = b.planUntil && b.planUntil > new Date() ? b.planUntil : new Date();
  return db.hubBusiness.update({ where: { id: businessId }, data: { planUntil: new Date(from.getTime() + days * 86_400_000) } });
}
