import type { GasOrderStatus, OutletKind } from "@prisma/client";
import { median, priceItem } from "./hub/prices";

/**
 * Everyday RefineryLens: what a household, driver or keke rider needs before buying fuel or gas. Prices come from
 * members of the public who report what they paid at a named station or shop, and are shown as medians across several
 * people so one wrong or mischievous report cannot move them.
 */

/** Products people buy at a pump or counter, by id from PRICE_ITEMS. */
export const EVERYDAY_ITEMS = ["pms_retail_litre", "ago_retail_litre", "dpk_retail_litre", "lpg_retail_kg", "lpg_cyl_12_5", "cng_scm"] as const;
export type EverydayItem = (typeof EVERYDAY_ITEMS)[number];
export const everydayItems = () => EVERYDAY_ITEMS.map((id) => priceItem(id)!);

/** Short names for the everyday pages, in the words people use at the pump. */
export const EVERYDAY_LABEL: Record<EverydayItem, string> = {
  pms_retail_litre: "Petrol",
  ago_retail_litre: "Diesel",
  dpk_retail_litre: "Kerosene",
  lpg_retail_kg: "Cooking gas (per kg)",
  lpg_cyl_12_5: "12.5 kg gas refill",
  cng_scm: "CNG",
};

export const OUTLET_KINDS: { id: OutletKind; label: string; sells: EverydayItem[] }[] = [
  { id: "FILLING_STATION", label: "Filling station", sells: ["pms_retail_litre", "ago_retail_litre", "dpk_retail_litre", "lpg_retail_kg", "lpg_cyl_12_5"] },
  { id: "GAS_RETAILER", label: "Gas shop or refill plant", sells: ["lpg_retail_kg", "lpg_cyl_12_5"] },
  { id: "CNG_STATION", label: "CNG station", sells: ["cng_scm", "pms_retail_litre"] },
];
export const outletKindLabel = (k: string) => OUTLET_KINDS.find((o) => o.id === k)?.label ?? k;
export const itemsSoldAt = (k: OutletKind) => OUTLET_KINDS.find((o) => o.id === k)?.sells ?? [];

export const QUEUES = [
  { id: "NONE", label: "No queue" },
  { id: "SHORT", label: "Short queue (under 15 min)" },
  { id: "LONG", label: "Long queue" },
] as const;
export const queueLabel = (q: string | null) => QUEUES.find((x) => x.id === q)?.label ?? "";

export const PROBLEMS = [
  { id: "SHORT_MEASURE", label: "Short measure (pump or scale gave less)" },
  { id: "OVERCHARGED", label: "Charged more than the displayed price" },
  { id: "BAD_PRODUCT", label: "Bad or adulterated product" },
  { id: "REFUSED_SALE", label: "Refused to sell while having product" },
  { id: "OTHER", label: "Something else" },
] as const;
export const problemLabel = (p: string | null) => PROBLEMS.find((x) => x.id === p)?.label ?? "Problem";

/** Fewest different people whose reports make a public median. */
export const MIN_REPORTERS = 3;
/** Pump prices move quickly, so the "today" figure uses only the last three days. */
export const FRESH_HOURS = 72;
/** A queue or "selling now" report is shown for this long. */
export const AVAILABILITY_HOURS = 12;
/** Reports a person can make per day, across all outlets. */
export const DAILY_REPORT_LIMIT = 30;

type PriceRow = { userId: string | null; priceNaira: number; createdAt: Date };
export type CommunityPrice = { median: number | null; low: number | null; high: number | null; reporters: number; updated: Date | null };

/** Each person's latest price in the window, then the median across people; null below MIN_REPORTERS. */
export function communityPrice(rows: PriceRow[], now = new Date(), hours = FRESH_HOURS): CommunityPrice {
  const since = now.getTime() - hours * 3_600_000;
  const byPerson = new Map<string, PriceRow>();
  rows.forEach((r, i) => {
    if (r.createdAt.getTime() < since || r.createdAt > now) return;
    const key = r.userId ?? `anon-${i}`;
    const cur = byPerson.get(key);
    if (!cur || cur.createdAt < r.createdAt) byPerson.set(key, r);
  });
  const latest = [...byPerson.values()];
  const prices = latest.map((r) => r.priceNaira);
  const enough = prices.length >= MIN_REPORTERS;
  return {
    median: enough ? median(prices) : null,
    low: enough ? Math.min(...prices) : null,
    high: enough ? Math.max(...prices) : null,
    reporters: prices.length,
    updated: latest.length ? new Date(Math.max(...latest.map((r) => r.createdAt.getTime()))) : null,
  };
}

/**
 * A reported price far from what others in the state report is more likely a typo (₦9,500 for ₦950) or mischief than
 * a real price, so it is refused with a message asking the person to check it.
 */
export function isOutlier(price: number, stateMedian: number | null) {
  if (stateMedian === null) return false;
  return price < stateMedian * 0.5 || price > stateMedian * 2;
}

// ---------------------------------------------------------------------------------------------------------------
// Cooking gas tracker

/** Household cylinder sizes, in kg. */
export const HOME_CYLINDER_SIZES = [3, 5, 6, 12.5, 25] as const;
/** Days before the expected empty date that the "running low" reminder is sent. */
export const REMIND_DAYS_BEFORE = 3;

export type CylinderOutlook = {
  lastFilled: Date | null;
  /** Days a fill lasts: measured from past refills when there are at least two, otherwise the owner's estimate. */
  lastsDays: number;
  measured: boolean;
  emptyBy: Date | null;
  daysLeft: number | null;
  /** Rough share left, 0–100, assuming steady use. */
  percentLeft: number | null;
};

export function cylinderOutlook(refillDates: Date[], usualDays: number, now = new Date()): CylinderOutlook {
  const dates = [...refillDates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const d = (dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000;
    // Ignore same-day duplicates and gaps that mean the cylinder was not in use.
    if (d >= 3 && d <= 180) gaps.push(d);
  }
  const measured = gaps.length > 0;
  const lastsDays = Math.max(1, Math.round(measured ? median(gaps.slice(-4))! : usualDays));
  const lastFilled = dates.at(-1) ?? null;
  if (!lastFilled) return { lastFilled, lastsDays, measured, emptyBy: null, daysLeft: null, percentLeft: null };
  const emptyBy = new Date(lastFilled.getTime() + lastsDays * 86_400_000);
  const daysLeft = Math.ceil((emptyBy.getTime() - now.getTime()) / 86_400_000);
  const percentLeft = Math.max(0, Math.min(100, Math.round((daysLeft / lastsDays) * 100)));
  return { lastFilled, lastsDays, measured, emptyBy, daysLeft, percentLeft };
}

// ---------------------------------------------------------------------------------------------------------------
// CNG savings calculator

/**
 * One standard cubic metre of natural gas holds about as much usable energy as one litre of petrol (roughly 34 MJ
 * each), so a converted vehicle travels about as far on 1 scm as on 1 litre. Real figures vary with the engine and
 * the conversion kit, which is why the calculator shows its assumptions.
 */
export const KM_PER_SCM_VS_LITRE = 1;

export type SavingsInput = { kmPerDay: number; daysPerMonth: number; kmPerLitre: number; petrolPrice: number; cngPrice: number; conversionCost?: number | null };
export type Savings = { litresPerMonth: number; petrolPerMonth: number; cngPerMonth: number; savingPerMonth: number; paybackMonths: number | null };

export function cngSavings(i: SavingsInput): Savings {
  const km = i.kmPerDay * i.daysPerMonth;
  const litres = km / i.kmPerLitre;
  const scm = km / (i.kmPerLitre * KM_PER_SCM_VS_LITRE);
  const petrolPerMonth = litres * i.petrolPrice;
  const cngPerMonth = scm * i.cngPrice;
  const savingPerMonth = petrolPerMonth - cngPerMonth;
  const paybackMonths = i.conversionCost && savingPerMonth > 0 ? i.conversionCost / savingPerMonth : null;
  return { litresPerMonth: litres, petrolPerMonth, cngPerMonth, savingPerMonth, paybackMonths };
}

/** Typical distance per litre of petrol, for the calculator's vehicle picker. Owners can type their own. */
export const VEHICLES = [
  { id: "car", label: "Car", kmPerLitre: 10, kmPerDay: 40 },
  { id: "bus", label: "Bus (Danfo / Korope)", kmPerLitre: 6, kmPerDay: 120 },
  { id: "keke", label: "Tricycle (Keke)", kmPerLitre: 25, kmPerDay: 80 },
  { id: "suv", label: "SUV or pickup", kmPerLitre: 7, kmPerDay: 50 },
] as const;

// ---------------------------------------------------------------------------------------------------------------
// Home gas orders

export const ORDER_STATUS: Record<GasOrderStatus, { label: string; tone: string }> = {
  PLACED: { label: "Waiting for seller", tone: "bg-amber-100 text-amber-800" },
  ACCEPTED: { label: "Accepted", tone: "bg-navy-100 text-navy-800" },
  OUT_FOR_DELIVERY: { label: "On the way", tone: "bg-navy-100 text-navy-800" },
  DELIVERED: { label: "Delivered", tone: "bg-brand-100 text-brand-800" },
  DECLINED: { label: "Declined", tone: "bg-ink-100 text-ink-700" },
  CANCELLED: { label: "Cancelled", tone: "bg-ink-100 text-ink-700" },
};

// ---------------------------------------------------------------------------------------------------------------
// Flagging station reports and places

/** Different people whose open flags hide a report until an administrator reviews it. */
export const AUTO_HIDE_FLAGS = 3;

export const REPORT_FLAG_REASONS = [
  { id: "WRONG", label: "Wrong or made up" },
  { id: "ABUSIVE", label: "Abusive, or names a private person" },
  { id: "SPAM", label: "Spam or advertising" },
] as const;

export const OUTLET_FLAG_REASONS = [
  { id: "CLOSED", label: "Closed for good" },
  { id: "DUPLICATE", label: "Listed twice" },
  { id: "NOT_REAL", label: "Does not exist" },
  { id: "WRONG_DETAILS", label: "Wrong name, area or address" },
] as const;

export const flagReasonLabel = (id: string) => [...REPORT_FLAG_REASONS, ...OUTLET_FLAG_REASONS].find((r) => r.id === id)?.label ?? id;
