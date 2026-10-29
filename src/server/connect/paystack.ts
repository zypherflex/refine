import crypto from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { callJson } from "./http";
import { settle } from "./settle";

export { BUSINESS_PLAN_DAYS, extendBusinessPlan } from "./settle";

/**
 * Paystack card payments for the Pro research plan, the trade hub Business plan and RefineryLens Data plans, in naira or,
 * for customers billed outside Nigeria, in US dollars (Paystack must have enabled USD and a USD payout account). The plan changes only after Paystack confirms the charge, either through
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


const auth = () => ({ Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" });

export type Purpose = "PLAN_PRO" | "BUSINESS_PLAN" | "DATA_PLAN";

/** USD needs Paystack to have approved international payments with a Zenith Bank USD account for payouts. */
export const paystackUsdEnabled = () => paystackConfigured() && process.env.PAYSTACK_USD_ENABLED === "true";

/** Starts a checkout and returns the Paystack page to send the customer to. */
export async function startProCheckout(actor: Actor & { email: string }) {
  return startCheckout(actor, "PLAN_PRO", proPriceKobo(), "NGN", {});
}

/** Business plan checkout for the actor's own business, which must be verified. */
export async function startBusinessCheckout(actor: Actor & { email: string }) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) throw new AppError("Set up your business profile first.");
  if (b.verification !== "VERIFIED") throw new AppError("The Business plan is for verified businesses. Request verification first.");
  return startCheckout(actor, "BUSINESS_PLAN", businessPriceKobo(), "NGN", { businessId: b.id });
}

export type CheckoutExtra = { businessId?: string; dataAccountId?: string; planId?: string; periodDays?: number };

export async function startCheckout(actor: Actor & { email: string }, purpose: Purpose, amountKobo: number, currency: "NGN" | "USD", extra: CheckoutExtra) {
  if (!paystackConfigured()) throw new AppError("Card payments are not configured.");
  if (currency === "USD" && !paystackUsdEnabled()) throw new AppError("US dollar payments are not set up yet.");
  const reference = `rl_${crypto.randomBytes(12).toString("hex")}`;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await db.payment.create({ data: { userId: actor.id, provider: "paystack", reference, purpose, amountKobo, currency, ...extra } });
  const res = await callJson<{ status: boolean; data: { authorization_url: string } }>("Paystack", `${API}/transaction/initialize`, {
    method: "POST",
    headers: auth(),
    body: JSON.stringify({ email: actor.email, amount: amountKobo, currency, reference, callback_url: `${base}/api/payments/paystack/callback`, metadata: { purpose, userId: actor.id } }),
  });
  if (!res.status || !res.data?.authorization_url) throw new AppError("Paystack did not start the payment. Try again.");
  return res.data.authorization_url;
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
