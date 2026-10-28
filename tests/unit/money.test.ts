import { afterEach, describe, expect, it } from "vitest";
import { commission, isPlus, plusPrice, serviceFee, usdCents } from "@/lib/money";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("how RefineryLens earns from gas orders", () => {
  it("charges a percentage service fee between a floor and a cap, and none on Plus", () => {
    expect(serviceFee(15_500, false)).toBe(465);
    expect(serviceFee(3_000, false)).toBe(200);
    expect(serviceFee(200_000, false)).toBe(2_500);
    expect(serviceFee(15_500, true)).toBe(0);
    process.env.SERVICE_FEE_PERCENT = "5";
    expect(serviceFee(15_500, false)).toBe(775);
  });

  it("takes a lower commission from sellers on the Business plan", () => {
    expect(commission(15_500, false)).toBe(388);
    expect(commission(15_500, true)).toBe(233);
  });

  it("rounds dollar amounts up so the seller is never short", () => {
    expect(usdCents(15_965, 1480)).toBe(1079);
    expect(usdCents(1480, 1480)).toBe(100);
  });

  it("knows who is on Plus", () => {
    expect(isPlus({ plan: "FREE" })).toBe(false);
    expect(isPlus({ plan: "PRO", planUntil: null })).toBe(true);
    expect(isPlus({ plan: "PRO", planUntil: new Date(Date.now() - 1000) })).toBe(false);
    expect(isPlus({ plan: "TEAM" })).toBe(true);
    expect(plusPrice()).toEqual({ ngnKobo: 150_000, usdCents: 300 });
  });
});
