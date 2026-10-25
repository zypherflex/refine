import { describe, expect, it } from "vitest";
import { capacityUtilization, cashConversion, comparability, freeCashFlow, growth, netDebt, operatingMargin, type MetricInput } from "@/lib/calculations";

const m = (o: Partial<MetricInput>): MetricInput => ({
  key: "revenue", label: "Revenue", value: 100, unit: "NGN", currency: "NGN", scale: "billions", scope: "GROUP", periodType: "FY", periodLabel: "FY2025",
  periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"), ...o,
});

describe("growth", () => {
  it("calculates period-on-period growth with formula and inputs", () => {
    const r = growth(m({ value: 6135.4 }), m({ value: 4820, periodLabel: "FY2024", periodStart: new Date("2024-01-01"), periodEnd: new Date("2024-12-31") }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBeCloseTo(27.29, 1);
      expect(r.formula).toContain("prior");
      expect(r.inputs).toHaveLength(2);
    }
  });
  it("refuses to compare a half-year with a full year", () => {
    const r = growth(m({ periodType: "H1", periodLabel: "H1 2026", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-06-30") }), m({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/period/i);
  });
  it("refuses periods of different length even when labelled the same type", () => {
    const r = growth(m({ periodStart: new Date("2025-04-01"), periodEnd: new Date("2025-12-31") }), m({ periodLabel: "FY2024", periodStart: new Date("2024-01-01"), periodEnd: new Date("2024-12-31") }));
    expect(r.ok).toBe(false);
  });
  it("refuses to combine group and refinery figures", () => {
    const r = growth(m({ scope: "REFINERY" }), m({ periodLabel: "FY2024" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Group-level and refinery-level/);
  });
  it("refuses different currencies", () => {
    expect(growth(m({ currency: "USD" }), m({ periodLabel: "FY2024" })).ok).toBe(false);
  });
  it("refuses when a figure is not disclosed", () => {
    expect(growth(m({ value: null }), m({})).ok).toBe(false);
  });
  it("handles a negative prior figure using its absolute value and says so", () => {
    const r = growth(m({ value: 210.4 }), m({ value: -145.6, periodLabel: "FY2024" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBeCloseTo(244.5, 1);
      expect(r.note).toMatch(/negative/);
    }
  });
  it("refuses a zero base", () => {
    expect(growth(m({}), m({ value: 0, periodLabel: "FY2024" })).ok).toBe(false);
  });
  it("normalises scale before comparing", () => {
    const r = growth(m({ value: 1.1, scale: "billions" }), m({ value: 1000, scale: "millions", periodLabel: "FY2024" }));
    expect(r.ok && r.value).toBeCloseTo(10, 5);
  });
});

describe("ratios and differences", () => {
  it("operating margin requires the same period", () => {
    expect(operatingMargin(m({ key: "operating_profit", value: 688.9 }), m({ value: 6135.4, periodLabel: "FY2024" })).ok).toBe(false);
    const r = operatingMargin(m({ key: "operating_profit", label: "Operating profit", value: 688.9 }), m({ value: 6135.4 }));
    expect(r.ok && r.value).toBeCloseTo(11.23, 2);
  });
  it("free cash flow and net debt keep the scale of the inputs", () => {
    const f = freeCashFlow(m({ label: "OCF", value: 455.7 }), m({ label: "Capex", value: 340.5 }));
    expect(f.ok && f.value).toBeCloseTo(115.2, 5);
    expect(f.ok && f.unit).toBe("NGN bn");
    const d = netDebt(m({ value: 4120 }), m({ value: 395.2 }));
    expect(d.ok && d.value).toBeCloseTo(3724.8, 5);
  });
  it("cash conversion is not meaningful for a loss", () => {
    expect(cashConversion(m({ value: 298.1 }), m({ value: -145.6 })).ok).toBe(false);
  });
});

describe("capacity utilization", () => {
  const cap = m({ key: "nameplate_capacity", label: "Capacity", value: 450000, unit: "barrels per day", currency: null, scale: "units", scope: "REFINERY", periodType: "POINT" });
  it("divides throughput by capacity", () => {
    const r = capacityUtilization(m({ key: "throughput", value: 405000, unit: "barrels per day", currency: null, scale: "units", scope: "REFINERY", periodType: "H1" }), cap);
    expect(r.ok && r.value).toBeCloseTo(90, 5);
  });
  it("refuses mismatched units or scopes", () => {
    expect(capacityUtilization(m({ value: 1, unit: "tonnes", currency: null, scale: "units", scope: "REFINERY" }), cap).ok).toBe(false);
    expect(capacityUtilization(m({ value: 1, unit: "barrels per day", currency: null, scale: "units", scope: "NATIONAL_SECTOR" }), cap).ok).toBe(false);
  });
});

describe("comparability", () => {
  it("accepts like-for-like figures", () => {
    expect(comparability(m({}), m({ periodLabel: "FY2024", periodStart: new Date("2024-01-01"), periodEnd: new Date("2024-12-31") }))).toBeNull();
  });
});
