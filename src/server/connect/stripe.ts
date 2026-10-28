import crypto from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { callJson } from "./http";
import { settle } from "./settle";
import type { CheckoutExtra, Purpose } from "./paystack";

/**
 * Stripe Checkout for US-dollar payments, for when RefineryLens bills foreign customers through a US entity (for
 * example one formed with Stripe Atlas), since Stripe does not onboard Nigerian companies directly. One-off payments
 * for a month or a year; access changes only after Stripe confirms the payment.
 * Docs: https://docs.stripe.com/api/checkout/sessions and https://docs.stripe.com/webhooks#verify-manually
 */

const API = "https://api.stripe.com/v1";
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
const headers = () => ({ Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" });

type Session = { id: string; url?: string; client_reference_id: string | null; payment_status: string; amount_total: number | null; currency: string | null; status: string };

export async function startStripeCheckout(actor: Actor & { email: string }, purpose: Purpose, amountCents: number, productName: string, extra: CheckoutExtra) {
  if (!stripeConfigured()) throw new AppError("US dollar card payments are not set up yet.");
  const reference = `rl_${crypto.randomBytes(12).toString("hex")}`;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await db.payment.create({ data: { userId: actor.id, provider: "stripe", reference, purpose, amountKobo: amountCents, currency: "USD", ...extra } });
  const body = new URLSearchParams({
    mode: "payment",
    client_reference_id: reference,
    customer_email: actor.email,
    success_url: `${base}/api/payments/stripe/return?ref=${reference}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/account/data?payment=cancelled`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amountCents),
    "line_items[0][price_data][product_data][name]": productName,
    "metadata[reference]": reference,
  });
  const s = await callJson<Session>("Stripe", `${API}/checkout/sessions`, { method: "POST", headers: headers(), body: body.toString() });
  if (!s.url) throw new AppError("Stripe did not start the payment. Try again.");
  return s.url;
}

const asPaid = (s: Session) => ({ status: s.payment_status === "paid" ? "success" : s.status === "expired" ? "abandoned" : s.payment_status, amount: s.amount_total ?? -1, currency: s.currency ?? "" });

/** On return from Stripe: fetch the session from Stripe itself, never trusting the address the browser came back on. */
export async function verifyStripeReturn(reference: string, sessionId: string) {
  if (!stripeConfigured()) throw new AppError("US dollar card payments are not set up yet.");
  if (!/^rl_[a-f0-9]{24}$/.test(reference) || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { ok: false as const, reason: "bad reference" };
  const s = await callJson<Session>("Stripe", `${API}/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: headers() });
  if (s.client_reference_id !== reference) return { ok: false as const, reason: "session does not match" };
  return settle(reference, asPaid(s));
}

/** Stripe-Signature is "t=<unix>,v1=<hex>": an HMAC-SHA256 of "<t>.<raw body>" with the endpoint secret. */
export function validStripeSignature(rawBody: string, header: string | null, now = Date.now(), toleranceSec = 300) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
}

/** Handles a verified webhook event. Checkout completion settles the payment; expiry marks it abandoned. */
export async function handleStripeEvent(event: { type?: string; data?: { object?: Session } }) {
  const s = event.data?.object;
  if (!s?.client_reference_id || !["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type ?? "")) return { handled: false };
  const paid = event.type === "checkout.session.async_payment_failed" ? { ...asPaid(s), status: "failed" } : asPaid(s);
  return { handled: true, ...(await settle(s.client_reference_id, paid)) };
}
