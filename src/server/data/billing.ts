import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { currencyFor, dataPlan, planPrice } from "@/lib/data-plans";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { businessPriceKobo, paystackConfigured, paystackUsdEnabled, startCheckout } from "../connect/paystack";
import { startStripeCheckout, stripeConfigured } from "../connect/stripe";

/** Which provider takes a currency: naira through Paystack; dollars through Stripe or Paystack USD, as configured. */
export function usdProvider(): "stripe" | "paystack" | null {
  const pref = (process.env.USD_PAYMENT_PROVIDER ?? "").toLowerCase();
  if (pref === "stripe" && stripeConfigured()) return "stripe";
  if (pref === "paystack" && paystackUsdEnabled()) return "paystack";
  if (stripeConfigured()) return "stripe";
  if (paystackUsdEnabled()) return "paystack";
  return null;
}

export const checkoutAvailable = (currency: "USD" | "NGN") => (currency === "NGN" ? paystackConfigured() : usdProvider() !== null);

/** Starts payment for a self-serve data plan, in the currency the account's billing country requires. */
export async function startDataCheckout(actor: Actor & { email: string }, planId: string, period: "month" | "year") {
  const a = await db.dataAccount.findUnique({ where: { userId: actor.id } });
  if (!a) throw new NotFoundError("Open a data account first.");
  const plan = dataPlan(planId);
  const currency = currencyFor(a.billingCountry);
  const amount = plan ? planPrice(plan, currency, period) : null;
  if (!plan || amount === null) throw new AppError("That plan is not sold online. Contact us for Enterprise terms.");
  const extra = { dataAccountId: a.id, planId: plan.id, periodDays: period === "year" ? 365 : 30 };
  const label = `RefineryLens Data ${plan.name} (${period === "year" ? "12 months" : "1 month"})`;
  if (currency === "NGN") return startCheckout(actor, "DATA_PLAN", amount, "NGN", extra);
  const provider = usdProvider();
  if (provider === "stripe") return startStripeCheckout(actor, "DATA_PLAN", amount, label, extra);
  if (provider === "paystack") return startCheckout(actor, "DATA_PLAN", amount, "USD", extra);
  throw new AppError("US dollar payments are not set up yet. Email us for an invoice in USD.");
}

/**
 * The Business plan's price for a business: naira for one based in Nigeria; US dollars for an international supplier
 * (a US exporter or equipment maker listing on the hub to reach Nigerian buyers). BUSINESS_PLAN_PRICE_USD, default $99.
 */
export function businessPlanPrice(state: string): { currency: "USD" | "NGN"; minor: number } {
  if ((NIGERIAN_STATES as readonly string[]).includes(state)) return { currency: "NGN", minor: businessPriceKobo() };
  const usd = Number(process.env.BUSINESS_PLAN_PRICE_USD ?? 99);
  return { currency: "USD", minor: Math.round((Number.isFinite(usd) && usd > 0 ? usd : 99) * 100) };
}

export async function startBusinessPlanCheckout(actor: Actor & { email: string }) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) throw new AppError("Set up your business profile first.");
  if (b.verification !== "VERIFIED") throw new AppError("The Business plan is for verified businesses. Request verification first.");
  const price = businessPlanPrice(b.state);
  const extra = { businessId: b.id };
  if (price.currency === "NGN") return startCheckout(actor, "BUSINESS_PLAN", price.minor, "NGN", extra);
  const provider = usdProvider();
  if (provider === "stripe") return startStripeCheckout(actor, "BUSINESS_PLAN", price.minor, "RefineryLens international supplier plan (30 days)", extra);
  if (provider === "paystack") return startCheckout(actor, "BUSINESS_PLAN", price.minor, "USD", extra);
  throw new AppError("US dollar payments are not set up yet. Email us for an invoice in USD.");
}
