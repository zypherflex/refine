/**
 * Derived metrics. Every result carries its formula and inputs so the UI and the assistant can show
 * the working. Functions refuse to calculate when inputs are not comparable rather than guessing.
 */

export type MetricInput = {
  id?: string;
  key: string;
  label: string;
  value: number | null;
  unit: string;
  currency?: string | null;
  scale: string;
  scope: string;
  periodType: string;
  periodLabel: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  auditStatus?: string;
};

export type CalcResult =
  | { ok: true; value: number; unit: string; formula: string; inputs: { label: string; value: number; unit: string; ref?: string }[]; note?: string }
  | { ok: false; reason: string };

const SCALE: Record<string, number> = { units: 1, thousands: 1e3, millions: 1e6, billions: 1e9 };

export function toBase(m: MetricInput): number | null {
  if (m.value === null || m.value === undefined) return null;
  const f = SCALE[m.scale];
  if (f === undefined) return null;
  return m.value * f;
}

function periodDays(m: MetricInput): number | null {
  if (!m.periodStart || !m.periodEnd) return null;
  return Math.round((m.periodEnd.getTime() - m.periodStart.getTime()) / 86_400_000) + 1;
}

/** Checks whether two figures can be compared or combined. Returns a human-readable reason when not. */
export function comparability(a: MetricInput, b: MetricInput, opts: { samePeriod?: boolean } = {}): string | null {
  if (a.value === null || b.value === null) return "One of the figures is not disclosed.";
  if (a.scope !== b.scope)
    return `The figures cover different reporting scopes (${a.scope.toLowerCase()} vs ${b.scope.toLowerCase()}). Group-level and refinery-level figures cannot be combined without an explicit reconciliation.`;
  if ((a.currency ?? null) !== (b.currency ?? null)) return `The figures use different currencies (${a.currency ?? "none"} vs ${b.currency ?? "none"}).`;
  if (a.periodType !== b.periodType) return `The reporting periods are different lengths (${a.periodType} vs ${b.periodType}).`;
  const da = periodDays(a);
  const dbb = periodDays(b);
  if (da !== null && dbb !== null && Math.abs(da - dbb) > 7) return `The reporting periods differ in length (${da} vs ${dbb} days).`;
  if (opts.samePeriod && a.periodLabel !== b.periodLabel) return `The figures relate to different periods (${a.periodLabel} vs ${b.periodLabel}).`;
  return null;
}

function ref(m: MetricInput) {
  return { label: `${m.label} (${m.periodLabel})`, value: m.value as number, unit: unitLabel(m), ref: m.id };
}

export function unitLabel(m: Pick<MetricInput, "unit" | "currency" | "scale">): string {
  const s = m.scale === "billions" ? " bn" : m.scale === "millions" ? " m" : m.scale === "thousands" ? " k" : "";
  if (m.currency) return `${m.currency}${s}`;
  return `${m.unit}${s ? " (" + s.trim() + ")" : ""}`;
}

/** Period-on-period growth. Refuses incompatible periods, scopes or currencies. */
export function growth(current: MetricInput, prior: MetricInput): CalcResult {
  const reason = comparability(current, prior);
  if (reason) return { ok: false, reason };
  const c = toBase(current)!;
  const p = toBase(prior)!;
  if (p === 0) return { ok: false, reason: "The earlier figure is zero, so a percentage change is undefined." };
  const value = ((c - p) / Math.abs(p)) * 100;
  return {
    ok: true,
    value,
    unit: "%",
    formula: "(current − prior) ÷ |prior| × 100",
    inputs: [ref(current), ref(prior)],
    note: p < 0 ? "The earlier figure was negative; the change is measured against its absolute value." : undefined,
  };
}

/** A ratio between two figures for the same period and scope, e.g. operating margin. */
export function ratio(numerator: MetricInput, denominator: MetricInput, name: string, asPercent = true): CalcResult {
  const reason = comparability(numerator, denominator, { samePeriod: true });
  if (reason) return { ok: false, reason };
  const d = toBase(denominator)!;
  if (d === 0) return { ok: false, reason: `${denominator.label} is zero, so ${name} is undefined.` };
  const v = toBase(numerator)! / d;
  return {
    ok: true,
    value: asPercent ? v * 100 : v,
    unit: asPercent ? "%" : "x",
    formula: `${numerator.label} ÷ ${denominator.label}${asPercent ? " × 100" : ""}`,
    inputs: [ref(numerator), ref(denominator)],
  };
}

export function difference(a: MetricInput, b: MetricInput, name: string): CalcResult {
  const reason = comparability(a, b, { samePeriod: true });
  if (reason) return { ok: false, reason };
  const base = toBase(a)! - toBase(b)!;
  const f = SCALE[a.scale] ?? 1;
  return {
    ok: true,
    value: base / f,
    unit: unitLabel(a),
    formula: `${a.label} − ${b.label}`,
    inputs: [ref(a), ref(b)],
    note: name ? undefined : undefined,
  };
}

/**
 * Capacity utilization = average throughput ÷ nameplate capacity. Both must be in the same unit
 * (e.g. barrels per day) and describe the same plant scope.
 */
export function capacityUtilization(throughput: MetricInput, capacity: MetricInput): CalcResult {
  if (throughput.value === null || capacity.value === null) return { ok: false, reason: "Throughput or nameplate capacity is not disclosed." };
  if (throughput.unit !== capacity.unit) return { ok: false, reason: `Units differ (${throughput.unit} vs ${capacity.unit}).` };
  if (throughput.scope !== capacity.scope) return { ok: false, reason: "Throughput and capacity describe different scopes." };
  const c = toBase(capacity)!;
  if (c <= 0) return { ok: false, reason: "Nameplate capacity must be positive." };
  return {
    ok: true,
    value: (toBase(throughput)! / c) * 100,
    unit: "%",
    formula: "average throughput ÷ nameplate capacity × 100",
    inputs: [ref(throughput), { ...ref(capacity), label: `${capacity.label} (as stated ${capacity.periodLabel})` }],
  };
}

export const freeCashFlow = (ocf: MetricInput, capex: MetricInput) => {
  const r = difference(ocf, capex, "free cash flow");
  if (r.ok) r.formula = "operating cash flow − capital expenditure";
  return r;
};
export const netDebt = (debt: MetricInput, cash: MetricInput) => {
  const r = difference(debt, cash, "net debt");
  if (r.ok) r.formula = "total borrowings − cash and cash equivalents";
  return r;
};
export const operatingMargin = (op: MetricInput, rev: MetricInput) => ratio(op, rev, "operating margin");
export const cashConversion = (ocf: MetricInput, np: MetricInput) => {
  if (np.value !== null && np.value <= 0) return { ok: false as const, reason: "Net profit is zero or negative, so cash conversion is not meaningful." };
  return ratio(ocf, np, "cash conversion", false);
};
