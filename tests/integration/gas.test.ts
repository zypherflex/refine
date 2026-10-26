import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { saveBusiness } from "@/server/hub/business";
import { confirmSite, createSite, getSite, mySites, nearestSupply, networkData, updateSite } from "@/server/hub/gas";
import { createListing } from "@/server/hub/listings";
import { suspendBusiness } from "@/server/hub/moderation";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

async function trader(name: string, roles: ("SELLER" | "BUYER" | "DELIVERY" | "REFINERY")[], state = "Lagos") {
  const u = await user();
  const b = await saveBusiness(u, { name, roles, state });
  return { u, b };
}
const depot = { name: "Ikeja depot", kind: "DEPOT" as const, gases: ["lpg_bulk"], state: "Lagos", storageTonnes: 2500 };

describe("gas network sites", () => {
  it("lets each role list only its own kinds of site", async () => {
    const { u: seller } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: haulier } = await trader("Corridor Haulage", ["DELIVERY"], "Kaduna");
    const { u: buyer } = await trader("Kano Gas", ["BUYER"], "Kano");
    await createSite(seller, depot);
    await expect(createSite(seller, { ...depot, kind: "LOGISTICS_BASE", storageTonnes: null })).rejects.toThrow(/matching role/);
    await createSite(haulier, { name: "Kaduna yard", kind: "LOGISTICS_BASE", gases: ["lpg_bulk"], state: "Kaduna", delivers: true });
    await expect(createSite(haulier, { ...depot, name: "Haulier depot" })).rejects.toThrow(/matching role/);
    await expect(createSite(buyer, depot)).rejects.toThrow(/matching role/);
    await expect(createSite(await user(), depot)).rejects.toThrow(/business profile/);
  });

  it("validates states and keeps cylinder sizes only where cylinders are handled", async () => {
    const { u } = await trader("Ikeja Energy", ["SELLER"]);
    await expect(createSite(u, { ...depot, state: "Ghana" })).rejects.toThrow(/Nigerian state/);
    await expect(createSite(u, { ...depot, cylinderSizes: [7] })).rejects.toThrow(/cylinder size/);
    const bulk = await createSite(u, { ...depot, cylinderSizes: [12.5] });
    expect(bulk.cylinderSizes).toEqual([]);
    const plant = await createSite(u, { ...depot, name: "Refill plant", kind: "REFILL_PLANT", gases: ["lpg_bulk", "lpg_cylinder"], cylinderSizes: [50, 12.5, 6, 12.5] });
    expect(plant.cylinderSizes).toEqual([6, 12.5, 50]);
  });

  it("only the owner can change or confirm a site; saving confirms it", async () => {
    const { u } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: other } = await trader("Other Energy", ["SELLER"]);
    const s = await createSite(u, depot);
    await db.gasSite.update({ where: { id: s.id }, data: { lastConfirmedAt: new Date("2026-01-01") } });
    await expect(updateSite(other, s.id, depot)).rejects.toThrow(/not found/i);
    await expect(confirmSite(other, s.id)).rejects.toThrow(/not found/i);
    const updated = await updateSite(u, s.id, { ...depot, storageTonnes: 3000 });
    expect(updated.lastConfirmedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(await mySites(other)).toHaveLength(0);
  });

  it("builds the network from visible sites and gas listings, and finds the nearest supply", async () => {
    const { u: seller } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: north } = await trader("Kano Gas", ["BUYER", "SELLER"], "Kano");
    const { u: buyer } = await trader("Bauchi Gas", ["BUYER"], "Bauchi");
    const { u: hidden } = await trader("Dangote Gas Depot", ["SELLER"]);
    await createSite(seller, depot);
    await createSite(seller, { ...depot, name: "Ogun plant", kind: "REFILL_PLANT", state: "Ogun" });
    await createSite(north, { name: "Kano kiosk", kind: "CYLINDER_RETAIL", gases: ["lpg_cylinder"], state: "Kano" });
    await createSite(north, { name: "Closed kiosk", kind: "CYLINDER_RETAIL", gases: ["lpg_cylinder"], state: "Kano", status: "CLOSED" });
    await createSite(hidden, { ...depot, name: "Hidden depot" });
    await createListing(buyer, { kind: "REQUEST", title: "LPG to Bauchi", products: ["lpg"], state: "Bauchi" });

    const viewer = await user();
    const { sites, summary } = await networkData(viewer, null);
    expect(sites.map((s) => s.name).sort()).toEqual(["Ikeja depot", "Kano kiosk", "Ogun plant"]);
    const bauchi = summary.find((r) => r.state === "Bauchi")!;
    expect(bauchi.demand).toBe(1);
    expect(bauchi.gap).toBe(true);
    const near = nearestSupply(sites, "Bauchi");
    expect(near[0].site.name).toBe("Kano kiosk");
    expect(near.map((n) => n.km)).toEqual([...near.map((n) => n.km)].sort((a, b) => a - b));
    expect((await networkData(viewer, "cng")).sites).toHaveLength(0);
  });

  it("hides closed sites and suspended businesses from everyone but the owner", async () => {
    const admin = await user("ADMIN");
    const { u, b } = await trader("Ikeja Energy", ["SELLER"]);
    const s = await createSite(u, depot);
    const closed = await createSite(u, { ...depot, name: "Old depot", status: "CLOSED" });
    const viewer = await user();
    expect((await getSite(viewer, s.id)).id).toBe(s.id);
    await expect(getSite(viewer, closed.id)).rejects.toThrow(/not found/i);
    expect((await getSite(u, closed.id)).own).toBe(true);
    await suspendBusiness(admin, b.id, "Reports of unsafe cylinders");
    await expect(getSite(viewer, s.id)).rejects.toThrow(/not found/i);
    expect((await networkData(viewer, null)).sites).toHaveLength(0);
    await expect(updateSite(u, s.id, depot)).rejects.toThrow(/suspended/);
  });
});
