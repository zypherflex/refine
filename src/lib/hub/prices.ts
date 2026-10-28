/**
 * The price board: prices sellers state for their own recent sales, published only as medians across at least
 * MIN_SELLERS sellers in a state. Individual prices are never shown, and only past prices are collected, so the board
 * describes the market without becoming a channel for sellers to coordinate.
 */

export const PRICE_ITEMS = [
  { id: "lpg_bulk_kg", label: "Bulk LPG", group: "LPG", unit: "per kg", min: 300, max: 10_000 },
  { id: "lpg_retail_kg", label: "LPG refill", group: "LPG", unit: "per kg", min: 300, max: 10_000 },
  { id: "lpg_cyl_12_5", label: "12.5 kg cylinder refill", group: "LPG", unit: "per refill", min: 4_000, max: 125_000 },
  { id: "cng_scm", label: "CNG", group: "CNG", unit: "per scm", min: 50, max: 5_000 },
  { id: "ago_depot_litre", label: "Diesel (AGO) at depot", group: "Diesel", unit: "per litre", min: 300, max: 10_000 },
  { id: "ago_retail_litre", label: "Diesel (AGO) at pump", group: "Diesel", unit: "per litre", min: 300, max: 10_000 },
  { id: "pms_depot_litre", label: "Petrol (PMS) at depot", group: "Petrol", unit: "per litre", min: 200, max: 10_000 },
  { id: "pms_retail_litre", label: "Petrol (PMS) at pump", group: "Petrol", unit: "per litre", min: 200, max: 10_000 },
  { id: "dpk_retail_litre", label: "Kerosene (DPK)", group: "Kerosene", unit: "per litre", min: 200, max: 10_000 },
] as const;
export type PriceItemId = (typeof PRICE_ITEMS)[number]["id"];
export const priceItem = (id: string) => PRICE_ITEMS.find((p) => p.id === id);

/** Fewest distinct sellers needed before a state's median is shown. */
export const MIN_SELLERS = 3;
/** Reports older than this are left out of the current median. */
export const WINDOW_DAYS = 7;

/** Midnight UTC of the given date, so one report per seller per day. */
export function dayOf(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

type Report = { businessId: string; state: string; priceNaira: number; day: Date };
export type PriceCell = { state: string; sellers: number; median: number | null; low: number | null; high: number | null; previous: number | null; updated: Date | null };

/**
 * Per state: each seller's latest report in the current window, then the median across sellers, shown only with at
 * least MIN_SELLERS sellers. `previous` is the same median for the window before, for the week-on-week change.
 */
export function summarisePrices(reports: Report[], now = new Date()): PriceCell[] {
  const end = dayOf(now).getTime() + 86_400_000;
  const windowStart = end - WINDOW_DAYS * 86_400_000;
  const prevStart = windowStart - WINDOW_DAYS * 86_400_000;
  const latest = (from: number, to: number) => {
    const bySeller = new Map<string, Report>();
    for (const r of reports) {
      const t = r.day.getTime();
      if (t < from || t >= to) continue;
      const key = `${r.state}|${r.businessId}`;
      const cur = bySeller.get(key);
      if (!cur || cur.day < r.day) bySeller.set(key, r);
    }
    const byState = new Map<string, Report[]>();
    for (const r of bySeller.values()) byState.set(r.state, [...(byState.get(r.state) ?? []), r]);
    return byState;
  };
  const current = latest(windowStart, end);
  const prev = latest(prevStart, windowStart);
  const states = new Set([...current.keys(), ...prev.keys()]);
  return [...states]
    .map((state) => {
      const rows = current.get(state) ?? [];
      const prevRows = prev.get(state) ?? [];
      const enough = rows.length >= MIN_SELLERS;
      const prices = rows.map((r) => r.priceNaira);
      return {
        state,
        sellers: rows.length,
        median: enough ? median(prices) : null,
        low: enough ? Math.min(...prices) : null,
        high: enough ? Math.max(...prices) : null,
        previous: prevRows.length >= MIN_SELLERS ? median(prevRows.map((r) => r.priceNaira)) : null,
        updated: rows.length ? new Date(Math.max(...rows.map((r) => r.day.getTime()))) : null,
      };
    })
    .sort((a, b) => Number(b.median !== null) - Number(a.median !== null) || b.sellers - a.sellers || a.state.localeCompare(b.state));
}

/** National median across every seller's latest report, with the same minimum. */
export function nationalMedian(reports: Report[], now = new Date()) {
  const end = dayOf(now).getTime() + 86_400_000;
  const start = end - WINDOW_DAYS * 86_400_000;
  const bySeller = new Map<string, Report>();
  for (const r of reports) {
    const t = r.day.getTime();
    if (t < start || t >= end) continue;
    const cur = bySeller.get(r.businessId);
    if (!cur || cur.day < r.day) bySeller.set(r.businessId, r);
  }
  const prices = [...bySeller.values()].map((r) => r.priceNaira);
  return { sellers: prices.length, median: prices.length >= MIN_SELLERS ? median(prices) : null };
}

export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-GB")}`;
