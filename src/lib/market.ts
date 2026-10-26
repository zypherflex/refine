/** Calculations on open-data market series. Pure functions so the formulas are tested and shown exactly as used. */

export type DatedValue = { period: string; value: number };

export const GALLONS_PER_BARREL = 42;

export const CRACK_321_FORMULA = "(2 × gasoline + 1 × diesel − 3 × Brent) ÷ 3, with product prices converted from USD/gal to USD/bbl (× 42)";

/**
 * Indicative 3-2-1 crack spread: the gross value of turning three barrels of crude into two of gasoline and one of
 * diesel. Only dates where all three prices exist are used. It is a benchmark for the Atlantic basin, not any refiner's
 * realised margin, which also depends on its yields, crude discounts, freight and operating costs.
 */
export function crack321(brent: DatedValue[], gasolineGal: DatedValue[], dieselGal: DatedValue[]): DatedValue[] {
  const g = new Map(gasolineGal.map((p) => [p.period, p.value]));
  const d = new Map(dieselGal.map((p) => [p.period, p.value]));
  const out: DatedValue[] = [];
  for (const b of brent) {
    const gv = g.get(b.period);
    const dv = d.get(b.period);
    if (gv === undefined || dv === undefined) continue;
    const value = (2 * gv * GALLONS_PER_BARREL + dv * GALLONS_PER_BARREL - 3 * b.value) / 3;
    out.push({ period: b.period, value: Math.round(value * 100) / 100 });
  }
  return out.sort((a, b) => a.period.localeCompare(b.period));
}

/** Change from the previous observation, as an absolute difference and a percentage. */
export function latestChange(points: DatedValue[]): { latest: DatedValue; previous: DatedValue | null; diff: number | null; pct: number | null } | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.period.localeCompare(b.period));
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  if (!previous) return { latest, previous, diff: null, pct: null };
  const diff = latest.value - previous.value;
  return { latest, previous, diff, pct: previous.value !== 0 ? (diff / Math.abs(previous.value)) * 100 : null };
}
