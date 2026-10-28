import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { isPlus, plusPrice, serviceFee, usdCents } from "@/lib/money";
import { audit } from "../audit";
import { latestFx } from "../fx";
import { requireMyBusiness } from "../hub/business";
import { paystackConfigured, startCheckout } from "../connect/paystack";
import { startStripeCheckout } from "../connect/stripe";
import { usdProvider } from "../data/billing";

type Payer = Actor & { email: string };

async function payerIsPlus(userId: string) {
  return isPlus(await db.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, planUntil: true } }));
}

/** What paying online costs for an accepted order: the seller's price, the service fee, and the same in US dollars. */
export async function orderPaymentQuote(order: { userId: string; priceNaira: number | null }) {
  if (!order.priceNaira) return null;
  const fee = serviceFee(order.priceNaira, await payerIsPlus(order.userId));
  const total = order.priceNaira + fee;
  const fx = await latestFx();
  return { priceNaira: order.priceNaira, feeNaira: fee, totalNaira: total, usd: fx ? { cents: usdCents(total, fx.value), rate: fx.value, period: fx.period, demo: fx.demo } : null };
}

/**
 * Pay for an accepted gas order online, in naira (Paystack) or in US dollars (Stripe or Paystack USD) for someone
 * paying from abroad. Only the person who placed the order can pay, once, after the seller has confirmed the price.
 */
export async function startOrderPayment(actor: Payer, orderId: string, currency: "NGN" | "USD") {
  const o = await db.gasOrder.findUnique({ where: { id: orderId } });
  if (!o || o.userId !== actor.id) throw new NotFoundError("Order not found");
  if (o.paidOnlineAt) throw new AppError("This order is already paid.");
  if (!["ACCEPTED", "OUT_FOR_DELIVERY"].includes(o.status)) throw new AppError("You can pay online once the seller has accepted the order.");
  const q = await orderPaymentQuote(o);
  if (!q) throw new AppError("The seller has not confirmed the price yet.");
  const extra = { gasOrderId: o.id };
  const label = `Gas refill: ${o.cylinders} × ${o.cylinderKg} kg${o.recipientName ? ` for ${o.recipientName}` : ""}`;
  if (currency === "NGN") return startCheckout(actor, "GAS_ORDER", q.totalNaira * 100, "NGN", extra);
  if (!q.usd) throw new AppError("US dollar payment needs today's exchange rate, which is not loaded yet. Pay in naira or try later.");
  const provider = usdProvider();
  if (provider === "stripe") return startStripeCheckout(actor, "GAS_ORDER", q.usd.cents, label, extra, `/orders/${o.id}?payment=cancelled`);
  if (provider === "paystack") return startCheckout(actor, "GAS_ORDER", q.usd.cents, "USD", extra);
  throw new AppError("US dollar payments are not set up yet. Pay in naira by card or transfer.");
}

/** RefineryLens Plus for 30 days: naira for people in Nigeria, US dollars for Nigerians abroad. */
export async function startPlusCheckout(actor: Payer, currency: "NGN" | "USD") {
  const price = plusPrice();
  if (currency === "NGN") return startCheckout(actor, "PLAN_PRO", price.ngnKobo, "NGN", {});
  const provider = usdProvider();
  if (provider === "stripe") return startStripeCheckout(actor, "PLAN_PRO", price.usdCents, "RefineryLens Plus (30 days)", {}, "/settings?payment=cancelled");
  if (provider === "paystack") return startCheckout(actor, "PLAN_PRO", price.usdCents, "USD", {});
  throw new AppError("US dollar payments are not set up yet. Pay in naira instead.");
}

/** A seller's money with RefineryLens: commission owed on cash orders, and payouts due for orders paid online. */
export async function sellerLedger(actor: Actor) {
  const b = await requireMyBusiness(actor);
  const delivered = await db.gasOrder.findMany({
    where: { businessId: b.id, status: "DELIVERED", commissionNaira: { not: null } },
    orderBy: { deliveredAt: "desc" },
    take: 200,
    select: { id: true, cylinders: true, cylinderKg: true, area: true, priceNaira: true, commissionNaira: true, commissionSettledAt: true, paidOnlineAt: true, payoutAt: true, deliveredAt: true },
  });
  const owed = delivered.filter((o) => !o.paidOnlineAt && !o.commissionSettledAt);
  const payouts = delivered.filter((o) => o.paidOnlineAt && !o.payoutAt);
  return {
    business: b,
    owed,
    owedNaira: owed.reduce((s, o) => s + (o.commissionNaira ?? 0), 0),
    payouts,
    payoutNaira: payouts.reduce((s, o) => s + (o.priceNaira ?? 0) - (o.commissionNaira ?? 0), 0),
    history: delivered.filter((o) => o.commissionSettledAt || o.payoutAt).slice(0, 20),
  };
}

/** The seller pays the commission owed on cash orders, in naira. */
export async function startSellerFeesPayment(actor: Payer) {
  if (!paystackConfigured()) throw new AppError("Card payments are not configured.");
  const l = await sellerLedger(actor);
  if (l.owedNaira <= 0) throw new AppError("You owe nothing at the moment.");
  return startCheckout(actor, "SELLER_FEES", Math.round(l.owedNaira) * 100, "NGN", { businessId: l.business.id });
}

/** Orders paid online and delivered, whose sellers RefineryLens still has to pay. For the admin payments page. */
export async function payoutsDue() {
  const rows = await db.gasOrder.findMany({
    where: { status: "DELIVERED", paidOnlineAt: { not: null }, payoutAt: null },
    orderBy: { deliveredAt: "asc" },
    include: { business: { select: { id: true, name: true } } },
    take: 200,
  });
  return rows.map((o) => ({ ...o, payoutNaira: (o.priceNaira ?? 0) - (o.commissionNaira ?? 0) }));
}

/** An administrator records that the seller was paid for an online order, commission kept. */
export async function markPaidOut(admin: Actor, orderId: string) {
  if (admin.role !== "ADMIN") throw new ForbiddenError();
  const o = await db.gasOrder.findUnique({ where: { id: orderId } });
  if (!o || !o.paidOnlineAt || o.status !== "DELIVERED") throw new AppError("Only delivered orders paid online are paid out.");
  if (o.payoutAt) return o;
  const now = new Date();
  const updated = await db.gasOrder.update({ where: { id: orderId }, data: { payoutAt: now, commissionSettledAt: now } });
  await audit(admin.id, "gas_order.payout", "GasOrder", orderId, { naira: (o.priceNaira ?? 0) - (o.commissionNaira ?? 0) });
  return updated;
}
