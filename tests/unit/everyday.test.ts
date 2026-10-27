import { describe, expect, it } from "vitest";
import { cngSavings, communityPrice, cylinderOutlook, isOutlier, MIN_REPORTERS } from "@/lib/everyday";

const now = new Date("2026-10-27T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("community prices", () => {
  it("uses each person's latest report and needs several people", () => {
    const rows = [
      { userId: "a", priceNaira: 900, createdAt: hoursAgo(30) },
      { userId: "a", priceNaira: 950, createdAt: hoursAgo(2) },
      { userId: "b", priceNaira: 1000, createdAt: hoursAgo(5) },
    ];
    expect(communityPrice(rows, now)).toMatchObject({ median: null, reporters: 2 });
    const c = communityPrice([...rows, { userId: "c", priceNaira: 990, createdAt: hoursAgo(1) }], now);
    expect(MIN_REPORTERS).toBe(3);
    expect(c).toMatchObject({ median: 990, low: 950, high: 1000, reporters: 3 });
    expect(c.updated).toEqual(hoursAgo(1));
  });

  it("drops reports older than three days", () => {
    const rows = ["a", "b", "c"].map((u) => ({ userId: u, priceNaira: 900, createdAt: hoursAgo(80) }));
    expect(communityPrice(rows, now).median).toBeNull();
  });

  it("refuses prices far from the state median, and accepts anything without one", () => {
    expect(isOutlier(9500, 950)).toBe(true);
    expect(isOutlier(400, 950)).toBe(true);
    expect(isOutlier(1100, 950)).toBe(false);
    expect(isOutlier(9500, null)).toBe(false);
  });
});

describe("cooking gas tracker", () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  it("uses the owner's estimate until refills give a measured figure", () => {
    const o = cylinderOutlook([d("2026-10-17")], 30, now);
    expect(o).toMatchObject({ lastsDays: 30, measured: false, daysLeft: 20, percentLeft: 67 });
  });
  it("measures how long a fill lasts from past refills, ignoring same-day duplicates", () => {
    const o = cylinderOutlook([d("2026-08-01"), d("2026-08-29"), d("2026-08-29"), d("2026-09-26"), d("2026-10-24")], 60, now);
    expect(o).toMatchObject({ lastsDays: 28, measured: true, daysLeft: 25 });
  });
  it("reports an empty cylinder when the date has passed", () => {
    const o = cylinderOutlook([d("2026-09-01")], 30, now);
    expect(o.daysLeft).toBeLessThan(0);
    expect(o.percentLeft).toBe(0);
  });
  it("has no estimate without a refill", () => {
    expect(cylinderOutlook([], 30, now)).toMatchObject({ daysLeft: null, lastFilled: null });
  });
});

describe("CNG savings", () => {
  it("compares a month on petrol and on CNG and works out the payback", () => {
    const s = cngSavings({ kmPerDay: 100, daysPerMonth: 25, kmPerLitre: 10, petrolPrice: 1000, cngPrice: 300, conversionCost: 700_000 });
    expect(s.litresPerMonth).toBe(250);
    expect(s.petrolPerMonth).toBe(250_000);
    expect(s.cngPerMonth).toBe(75_000);
    expect(s.savingPerMonth).toBe(175_000);
    expect(s.paybackMonths).toBe(4);
  });
  it("gives no payback when CNG costs more", () => {
    expect(cngSavings({ kmPerDay: 10, daysPerMonth: 20, kmPerLitre: 10, petrolPrice: 300, cngPrice: 400, conversionCost: 100 }).paybackMonths).toBeNull();
  });
});
