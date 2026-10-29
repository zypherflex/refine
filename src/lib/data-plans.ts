/**
 * RefineryLens Data plans. Customers billed outside Nigeria pay in US dollars; customers billed in Nigeria pay the naira
 * price, because transactions between Nigerian parties must be priced and settled in naira (CBN Foreign Exchange
 * Manual). Prices can be changed with environment variables without a release.
 */

export type DataPlanId = "trial" | "starter" | "professional" | "enterprise";

export type DataPlan = {
  id: DataPlanId;
  name: string;
  who: string;
  usdMonthly: number | null;
  ngnMonthly: number | null;
  requestsPerDay: number;
  historyDays: number | null;
  keys: number;
  redistribution: boolean;
  features: string[];
};

const env = (k: string, d: number) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export function dataPlans(): DataPlan[] {
  return [
    {
      id: "trial", name: "Trial", who: "Try the API for 14 days", usdMonthly: null, ngnMonthly: null, requestsPerDay: 200, historyDays: 30, keys: 1, redistribution: false,
      features: ["All 37 states and 6 products", "Last 30 days of history", "200 requests a day"],
    },
    {
      id: "starter", name: "Starter", who: "Analysts, researchers and small teams", usdMonthly: env("DATA_STARTER_USD", 49), ngnMonthly: env("DATA_STARTER_NGN", 75_000), requestsPerDay: 2_000, historyDays: 365, keys: 2, redistribution: false,
      features: ["Public (pump) and seller (wholesale) series", "Daily state medians, ranges and reporter counts", "12 months of history", "2,000 requests a day", "CSV download"],
    },
    {
      id: "professional", name: "Professional", who: "Traders, banks, insurers and consultancies", usdMonthly: env("DATA_PROFESSIONAL_USD", 299), ngnMonthly: env("DATA_PROFESSIONAL_NGN", 450_000), requestsPerDay: 20_000, historyDays: null, keys: 5, redistribution: false,
      features: ["Everything in Starter", "Full history since launch", "20,000 requests a day", "5 API keys for separate systems"],
    },
    {
      id: "enterprise", name: "Enterprise", who: "Redistribution, development finance and carbon projects", usdMonthly: env("DATA_ENTERPRISE_USD", 1_500), ngnMonthly: null, requestsPerDay: 200_000, historyDays: null, keys: 20, redistribution: true,
      features: ["Everything in Professional", "Licence to show the data in your own products", "Custom series and monitoring data for clean-cooking projects", "Invoiced annually; agreed with our team"],
    },
  ];
}

export const dataPlan = (id: string) => dataPlans().find((p) => p.id === id);
export const TRIAL_DAYS = 14;
/** A year paid up front costs ten months. */
export const ANNUAL_MONTHS_CHARGED = 10;

export type Currency = "USD" | "NGN";
export const currencyFor = (billingCountry: string): Currency => (billingCountry.toUpperCase() === "NG" ? "NGN" : "USD");

/** Price in the minor unit (cents or kobo) for a self-serve plan and period, or null when the plan is not sold online. */
export function planPrice(plan: DataPlan, currency: Currency, period: "month" | "year"): number | null {
  if (plan.id === "trial" || plan.id === "enterprise") return null;
  const monthly = currency === "USD" ? plan.usdMonthly : plan.ngnMonthly;
  if (monthly === null) return null;
  return Math.round(monthly * (period === "year" ? ANNUAL_MONTHS_CHARGED : 1) * 100);
}

export function fmtMoney(minor: number, currency: string) {
  const v = minor / 100;
  return currency === "USD" ? `$${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}` : `₦${Math.round(v).toLocaleString("en-GB")}`;
}

/** Countries for the billing picker: Nigeria first, then the markets most likely to buy Nigerian energy data. */
export const BILLING_COUNTRIES: [string, string][] = [
  ["NG", "Nigeria"], ["US", "United States"], ["GB", "United Kingdom"], ["CH", "Switzerland"], ["NL", "Netherlands"], ["AE", "United Arab Emirates"],
  ["SG", "Singapore"], ["ZA", "South Africa"], ["GH", "Ghana"], ["KE", "Kenya"], ["FR", "France"], ["DE", "Germany"], ["CA", "Canada"], ["CN", "China"], ["IN", "India"], ["XX", "Another country"],
];
