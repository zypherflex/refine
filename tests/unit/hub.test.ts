import { describe, expect, it } from "vitest";
import { allowedKinds, counterpartKinds, isProtectedName, isPubliclyVisible, PRODUCTS } from "@/lib/hub/catalog";

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

  it("lists each product once, with a label", () => {
    expect(new Set(PRODUCTS.map((p) => p.id)).size).toBe(PRODUCTS.length);
    for (const p of PRODUCTS) expect(p.label.length).toBeGreaterThan(0);
  });
});
