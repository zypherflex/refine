import { describe, expect, it } from "vitest";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { allowedSiteKinds, isStale, STATE_CAPITALS, STATE_GRID, stateDistanceKm, summariseNetwork } from "@/lib/hub/gas";

describe("gas network map", () => {
  it("places every state and the FCT on its own tile, and knows every capital", () => {
    expect(Object.keys(STATE_GRID).sort()).toEqual([...NIGERIAN_STATES].sort());
    expect(Object.keys(STATE_CAPITALS).sort()).toEqual([...NIGERIAN_STATES].sort());
    const cells = Object.values(STATE_GRID).map(([c, r]) => `${c},${r}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it("measures approximate distances between state capitals", () => {
    expect(stateDistanceKm("Lagos", "Lagos")).toBe(0);
    const lagosKano = stateDistanceKm("Lagos", "Kano")!;
    expect(lagosKano).toBeGreaterThan(800);
    expect(lagosKano).toBeLessThan(900);
    expect(stateDistanceKm("Lagos", "Ogun")!).toBeLessThan(stateDistanceKm("Lagos", "Kano")!);
    expect(stateDistanceKm("Lagos", "Ghana")).toBeNull();
  });

  it("lets sellers list supply sites and delivery partners only truck bases", () => {
    expect(allowedSiteKinds(["DELIVERY"])).toEqual(["LOGISTICS_BASE"]);
    expect(allowedSiteKinds(["SELLER"])).not.toContain("LOGISTICS_BASE");
    expect(allowedSiteKinds(["BUYER"])).toEqual([]);
  });

  it("flags details not confirmed for more than 90 days", () => {
    const now = new Date("2026-10-26T00:00:00Z");
    expect(isStale(new Date("2026-08-01T00:00:00Z"), now)).toBe(false);
    expect(isStale(new Date("2026-07-01T00:00:00Z"), now)).toBe(true);
  });

  it("counts supply where it is, delivery where it serves, demand where it is wanted, and finds gaps", () => {
    const sites = [
      { kind: "DEPOT" as const, status: "OPERATING", state: "Lagos", gases: ["lpg_bulk"], delivers: true },
      { kind: "CNG_STATION" as const, status: "OPERATING", state: "FCT Abuja", gases: ["cng"], delivers: false },
      { kind: "REFILL_PLANT" as const, status: "PLANNED", state: "Kano", gases: ["lpg_bulk"], delivers: false },
      { kind: "LOGISTICS_BASE" as const, status: "OPERATING", state: "Kaduna", gases: ["lpg_bulk"], delivers: true },
    ];
    const listings = [
      { kind: "DELIVERY" as const, state: "Kaduna", areas: ["Kano", "Kaduna"], products: ["lpg"] },
      { kind: "REQUEST" as const, state: "Kano", areas: [], products: ["lpg"] },
      { kind: "REQUEST" as const, state: "Bauchi", areas: [], products: ["lpg"] },
      { kind: "REQUEST" as const, state: "Ogun", areas: [], products: ["cng"] },
    ];
    const all = Object.fromEntries(summariseNetwork(sites, listings, null).map((r) => [r.state, r]));
    expect(all.Lagos.supply).toBe(1);
    expect(all.Kano.supply).toBe(0); // planned sites do not count
    expect(all.Kaduna.delivery).toBe(2); // the truck base and the listing
    expect(all.Kano.delivery).toBe(1);
    expect(all.Kano.gap).toBe(false);
    expect(all.Bauchi.gap).toBe(true);
    const cng = Object.fromEntries(summariseNetwork(sites, listings, "cng").map((r) => [r.state, r]));
    expect(cng.Lagos.supply).toBe(0);
    expect(cng["FCT Abuja"].supply).toBe(1);
    expect(cng.Ogun.gap).toBe(true);
    expect(cng.Bauchi.demand).toBe(0);
  });
});
