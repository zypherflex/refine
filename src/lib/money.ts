/**
 * How RefineryLens earns from everyday gas orders, as pure functions so the rules are easy to test and to show.
 *
 * - Service fee: added when a customer pays online instead of cash on delivery (in naira, or in US dollars from
 *   abroad). RefineryLens Plus members pay none.
 * - Commission: a share of every delivered order, lower for sellers on the Business plan. Kept from the payout for
 *   orders paid online; settled by the seller for cash orders.
 */

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const feeRules = () => ({
  serviceFeePercent: num(process.env.SERVICE_FEE_PERCENT, 3),
  serviceFeeMin: num(process.env.SERVICE_FEE_MIN_NGN, 200),
  serviceFeeMax: num(process.env.SERVICE_FEE_MAX_NGN, 2_500),
  commissionPercent: num(process.env.COMMISSION_PERCENT, 2.5),
  commissionPercentBusiness: num(process.env.COMMISSION_PERCENT_BUSINESS, 1.5),
});

/** The fee on an online payment, in whole naira: a percentage, kept between a floor and a cap. */
export function serviceFee(priceNaira: number, plus: boolean, rules = feeRules()) {
  if (plus || priceNaira <= 0) return 0;
  const pct = Math.round((priceNaira * rules.serviceFeePercent) / 100);
  return Math.min(rules.serviceFeeMax, Math.max(rules.serviceFeeMin, pct));
}

/** RefineryLens's commission on a delivered order, in whole naira. */
export function commission(priceNaira: number, businessPlan: boolean, rules = feeRules()) {
  const pct = businessPlan ? rules.commissionPercentBusiness : rules.commissionPercent;
  return Math.round((priceNaira * pct) / 100);
}

/** A naira amount in US cents at a naira-per-dollar rate, rounded up so the seller is never short. */
export const usdCents = (naira: number, ngnPerUsd: number) => Math.ceil((naira / ngnPerUsd) * 100);

/** RefineryLens Plus, for households in Nigeria (naira) and Nigerians abroad (US dollars), per 30 days. */
export const PLUS_DAYS = 30;
export const plusPrice = () => ({ ngnKobo: Math.round(num(process.env.PLUS_PRICE_NGN, 1_500) * 100), usdCents: Math.round(num(process.env.PLUS_PRICE_USD, 3) * 100) });

export function isPlus(u: { plan: string; planUntil?: Date | null }, now = new Date()) {
  if (u.plan === "TEAM") return true;
  if (u.plan !== "PRO") return false;
  return !u.planUntil || u.planUntil > now;
}
