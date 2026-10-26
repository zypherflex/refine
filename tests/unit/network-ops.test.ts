import { describe, expect, it } from "vitest";
import { dayOf, median, MIN_SELLERS, nationalMedian, PRICE_ITEMS, summarisePrices } from "@/lib/hub/prices";
import { nextDue } from "@/server/hub/supply";

const now = new Date("2026-10-26T12:00:00Z");
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("price board", () => {
  it("takes the median of an odd or even list", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("hides a state until enough sellers report, and uses each seller's latest price", () => {
    const reports = [
      { businessId: "a", state: "Lagos", priceNaira: 1200, day: d("2026-10-20") },
      { businessId: "a", state: "Lagos", priceNaira: 1300, day: d("2026-10-25") },
      { businessId: "b", state: "Lagos", priceNaira: 1250, day: d("2026-10-24") },
      { businessId: "c", state: "Lagos", priceNaira: 1400, day: d("2026-10-26") },
      { businessId: "a", state: "Kano", priceNaira: 1500, day: d("2026-10-26") },
      { businessId: "b", state: "Kano", priceNaira: 1550, day: d("2026-10-26") },
    ];
    const cells = Object.fromEntries(summarisePrices(reports, now).map((c) => [c.state, c]));
    expect(MIN_SELLERS).toBe(3);
    expect(cells.Lagos.sellers).toBe(3);
    expect(cells.Lagos.median).toBe(1300);
    expect(cells.Lagos.low).toBe(1250);
    expect(cells.Lagos.high).toBe(1400);
    expect(cells.Kano.median).toBeNull();
    expect(cells.Kano.low).toBeNull();
  });

  it("leaves out reports older than the window and compares with the week before", () => {
    const prev = ["a", "b", "c"].map((b, i) => ({ businessId: b, state: "Lagos", priceNaira: 1000 + i * 10, day: d("2026-10-15") }));
    const cur = ["a", "b", "c"].map((b, i) => ({ businessId: b, state: "Lagos", priceNaira: 1100 + i * 10, day: d("2026-10-24") }));
    const old = { businessId: "z", state: "Lagos", priceNaira: 9000, day: d("2026-09-01") };
    const [lagos] = summarisePrices([...prev, ...cur, old], now);
    expect(lagos.median).toBe(1110);
    expect(lagos.previous).toBe(1010);
    expect(nationalMedian([...prev, ...cur, old], now)).toEqual({ sellers: 3, median: 1110 });
  });

  it("normalises days to midnight UTC and keeps sane bounds for every item", () => {
    expect(dayOf(new Date("2026-10-26T23:59:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
    for (const p of PRICE_ITEMS) expect(p.min).toBeLessThan(p.max);
  });
});

describe("supply agreement schedule", () => {
  it("finds the next weekly, fortnightly and monthly delivery", () => {
    const start = d("2026-10-05");
    expect(nextDue({ frequency: "WEEKLY", startDate: start, endDate: null }, d("2026-10-20"))!.toISOString().slice(0, 10)).toBe("2026-10-26");
    expect(nextDue({ frequency: "FORTNIGHTLY", startDate: start, endDate: null }, d("2026-10-20"))!.toISOString().slice(0, 10)).toBe("2026-11-02");
    expect(nextDue({ frequency: "MONTHLY", startDate: start, endDate: null }, d("2026-10-20"))!.toISOString().slice(0, 10)).toBe("2026-11-05");
    expect(nextDue({ frequency: "WEEKLY", startDate: start, endDate: d("2026-10-15") }, d("2026-10-20"))).toBeNull();
  });
});
