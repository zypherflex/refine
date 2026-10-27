/**
 * Trust, fraud and competition-law guardrails for the trade hub, kept in one place so they are easy to review.
 * See the strategy's section 09: medians across many sellers only, past prices only, nothing unverified looks official.
 */

/** A price board median is shown only when at least this many different sellers reported in the window. */
export const MIN_SELLERS_FOR_MEDIAN = 3;
/** Prices are past, seller-stated prices: charged within this many days before today, never in the future. */
export const PRICE_WINDOW_DAYS = 14;
export const MAX_PRICE_AGE_DAYS = 30;
/** Gas sites must be reconfirmed. After STALE they are flagged; after EXPIRED they drop off the map and counts. */
export const SITE_STALE_DAYS = 60;
export const SITE_EXPIRED_DAYS = 180;
export const LISTING_DAYS = 30;

const DAY = 86_400_000;
export const daysAgo = (d: Date, now = new Date()) => Math.floor((now.getTime() - d.getTime()) / DAY);
export const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Plausible per-unit price ranges in naira, to catch typos (₦13,000 for ₦1,300) before they move a median. */
export const PRICE_BOUNDS: Record<string, [number, number]> = {
  LPG: [300, 6000],
  DIESEL: [300, 8000],
  PETROL: [200, 6000],
  KEROSENE: [300, 8000],
  CNG: [100, 3000],
};

/**
 * Names of well-known refiners and majors. An unverified business whose name includes one of these is shown as
 * "Name hidden until verified", so nobody can borrow a famous name to take advance payments.
 */
const PROTECTED_NAMES = /\b(dangote|nnpc|indorama|nlng|shell|totalenergies|total energies|chevron|exxon|exxonmobil|mobil|eni|agip|seplat|renaissance|aiteo|oando|conoil|ardova|mrs oil|nipco|bua)\b/;

export function isProtectedName(name: string): boolean {
  return PROTECTED_NAMES.test(name.toLowerCase().replace(/[^a-z0-9]+/g, " "));
}

export function displayName(b: { name: string; verification: string }): string {
  if (b.verification !== "VERIFIED" && isProtectedName(b.name)) return "Name hidden until verified";
  return b.name;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

export const ADVANCE_PAYMENT_WARNING =
  "Never pay in advance to a business you have not checked. RefineryLens does not hold money, sell fuel or guarantee any trade. Meet, inspect product and documents, and pay against delivery where you can.";

export const PRICE_BOARD_RULES =
  "Medians of prices sellers say they actually charged on a past date, across at least three different sellers. No single seller's price is shown, and planned or future prices are never accepted. Do not use this board, or messages on RefineryLens, to agree prices with competitors.";
