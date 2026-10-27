import { describe, expect, it } from "vitest";
import { allowedKinds, counterpartKinds, isProtectedName, isPubliclyVisible, productsForSegment, PRODUCTS } from "@/lib/hub/catalog";
import { SEGMENTS } from "@/lib/opportunities/catalog";

describe("trade hub rules", () => {
  it("treats well-known refiner names as protected however they are written", () => {
    expect(isProtectedName("Dangote Petroleum")).toBe(true);
    expect(isProtectedName("D.A.N.G.O.T.E Supplies")).toBe(true);
    expect(isProtectedName("NNPC Retail Partner")).toBe(true);
    expect(isProtectedName("Ikeja Energy Supplies")).toBe(false);
  });

  it("hides suspended businesses and unverified ones using a protected name", () => {
    expect(isPubliclyVisible({ name: "Ikeja Energy", verification: "UNVERIFIED" })).toBe(true);
    expect(isPubliclyVisible({ name: "Ikeja Energy", verification: "SUSPENDED" })).toBe(false);
    expect(isPubliclyVisible({ name: "Dangote Gas", verification: "PENDING_REVIEW" })).toBe(false);
    expect(isPubliclyVisible({ name: "Dangote Gas", verification: "VERIFIED" })).toBe(true);
  });

  it("lets each role post only its own kinds of listing", () => {
    expect(allowedKinds(["SELLER"])).toEqual(["OFFER"]);
    expect(allowedKinds(["BUYER"])).toEqual(["REQUEST"]);
    expect(allowedKinds(["DELIVERY"])).toEqual(["DELIVERY"]);
    expect(allowedKinds(["REFINERY"])).toEqual(["OFFER", "REQUEST"]);
  });

  it("matches each listing with the other side of the deal", () => {
    expect(counterpartKinds("OFFER")).toEqual(["REQUEST", "DELIVERY"]);
    expect(counterpartKinds("REQUEST")).toEqual(["OFFER", "DELIVERY"]);
    expect(counterpartKinds("DELIVERY")).toEqual(["OFFER", "REQUEST"]);
  });

  it("maps every opportunity area to at least one known product", () => {
    const ids = new Set<string>(PRODUCTS.map((p) => p.id));
    for (const s of SEGMENTS) {
      const products = productsForSegment(s.id);
      expect(products.length, s.id).toBeGreaterThan(0);
      for (const p of products) expect(ids.has(p)).toBe(true);
    }
  });
});

describe("Business plan rules", () => {
  it("features only verified businesses with a running plan, and lifts the listing limit", async () => {
    const { isFeatured, listingLimit } = await import("@/lib/hub/catalog");
    const soon = new Date(Date.now() + 86_400_000);
    const past = new Date(Date.now() - 86_400_000);
    expect(isFeatured({ verification: "VERIFIED", planUntil: soon })).toBe(true);
    expect(isFeatured({ verification: "UNVERIFIED", planUntil: soon })).toBe(false);
    expect(isFeatured({ verification: "VERIFIED", planUntil: past })).toBe(false);
    expect(listingLimit({ planUntil: soon })).toBe(200);
    expect(listingLimit({ planUntil: null })).toBe(50);
  });
});
