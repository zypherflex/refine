import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { saveBusiness } from "@/server/hub/business";
import { advanceOrder, placeOrder, saveHomeDelivery } from "@/server/everyday/orders";
import { confirmDelivered } from "@/server/hub/jobs";
import { createDriverLink, driverDelivered, driverView, recordPing, stopSharing, tidyTrips, TripEndedError, tripView } from "@/server/tracking";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

const token = (path: string) => path.replace("/drive/", "");
const at = (s: number) => new Date(Date.UTC(2026, 9, 27, 12, 0, s));

async function acceptedOrder() {
  const owner = await user();
  const b = await saveBusiness(owner, { name: "Surulere Gas Point", roles: ["SELLER"], state: "Lagos" });
  await saveHomeDelivery(owner, { homeDelivery: true, deliveryStates: ["Lagos"], homePricePerKg: 1200 });
  await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "VERIFIED" } });
  const customer = await user();
  const o = await placeOrder(customer, { businessId: b.id, cylinderKg: 12.5, cylinders: 1, state: "Lagos", area: "Surulere", address: "12 Adeniran Ogunsanya St", phone: "08031234567" });
  return { owner, customer, o };
}

describe("driver tracking for gas orders", () => {
  it("only the seller makes a driver link, and only once the order is accepted", async () => {
    const { owner, customer, o } = await acceptedOrder();
    await expect(createDriverLink(owner, { kind: "GAS_ORDER", id: o.id }, { driverName: "Musa" })).rejects.toThrow(/Accept the order/);
    await advanceOrder(owner, o.id, "accept", { priceNaira: 15_000 });
    await expect(createDriverLink(customer, { kind: "GAS_ORDER", id: o.id }, { driverName: "Musa" })).rejects.toThrow();
    const { path } = await createDriverLink(owner, { kind: "GAS_ORDER", id: o.id }, { driverName: "Musa", driverPhone: "08030000000" });
    expect(path).toMatch(/^\/drive\/[A-Za-z0-9_-]{32}$/);
    expect((await driverView(token(path))).order!.address).toContain("Adeniran");
    expect(await tripView(customer, { kind: "GAS_ORDER", id: o.id })).toMatchObject({ status: "WAITING", driverName: "Musa", last: null });
  });

  it("the first position puts the order on its way; positions build the trail and only watchers see it", async () => {
    const { owner, customer, o } = await acceptedOrder();
    await advanceOrder(owner, o.id, "accept", { priceNaira: 15_000 });
    const t = token((await createDriverLink(owner, { kind: "GAS_ORDER", id: o.id }, { driverName: "Musa" })).path);
    expect(await recordPing(t, { lat: 6.5, lon: 3.35, accuracy: 12, speed: 8 }, at(0))).toEqual({ stored: true });
    expect((await db.gasOrder.findUnique({ where: { id: o.id } }))!.status).toBe("OUT_FOR_DELIVERY");
    expect(await db.alert.count({ where: { userId: customer.id, title: "Your gas is on the way" } })).toBe(1);
    expect(await recordPing(t, { lat: 6.501, lon: 3.351 }, at(2))).toEqual({ stored: false, reason: "too_soon" });
    expect(await recordPing(t, { lat: 6.501, lon: 3.351, accuracy: 5000 }, at(20))).toEqual({ stored: false, reason: "inaccurate" });
    await recordPing(t, { lat: 6.502, lon: 3.352, accuracy: 10 }, at(20));
    await expect(recordPing(t, { lat: 95, lon: 3 })).rejects.toThrow(/not valid/);

    const view = await tripView(customer, { kind: "GAS_ORDER", id: o.id }, at(30));
    expect(view).toMatchObject({ status: "LIVE", live: true, last: { lat: 6.502, lon: 3.352 } });
    expect(view.trail).toHaveLength(2);
    expect((await tripView(owner, { kind: "GAS_ORDER", id: o.id }, at(30))).status).toBe("LIVE");
    expect((await tripView(customer, { kind: "GAS_ORDER", id: o.id }, at(300))).live).toBe(false); // last seen 5 min ago
    await expect(tripView(await user(), { kind: "GAS_ORDER", id: o.id })).rejects.toThrow(/Not found/);
  });

  it("a new link cancels the old one, stopping pauses, and delivery ends sharing", async () => {
    const { owner, customer, o } = await acceptedOrder();
    await advanceOrder(owner, o.id, "accept", { priceNaira: 15_000 });
    const first = token((await createDriverLink(owner, { kind: "GAS_ORDER", id: o.id }, { driverName: "Musa" })).path);
    const second = token((await createDriverLink(owner, { kind: "GAS_ORDER", id: o.id }, { driverName: "Ade" })).path);
    await expect(recordPing(first, { lat: 6.5, lon: 3.35 })).rejects.toThrow(/not valid/);
    await recordPing(second, { lat: 6.5, lon: 3.35 }, at(0));
    await stopSharing(second);
    expect((await tripView(customer, { kind: "GAS_ORDER", id: o.id })).status).toBe("WAITING");
    await driverDelivered(second);
    expect((await db.gasOrder.findUnique({ where: { id: o.id } }))!.status).toBe("DELIVERED");
    await expect(recordPing(second, { lat: 6.5, lon: 3.35 })).rejects.toBeInstanceOf(TripEndedError);
    expect((await tripView(customer, { kind: "GAS_ORDER", id: o.id })).status).toBe("ENDED");
  });

  it("deletes positions a week after the trip ends", async () => {
    const { owner, o } = await acceptedOrder();
    await advanceOrder(owner, o.id, "accept", { priceNaira: 15_000 });
    const t = token((await createDriverLink(owner, { kind: "GAS_ORDER", id: o.id }, { driverName: "Musa" })).path);
    await recordPing(t, { lat: 6.5, lon: 3.35 });
    await advanceOrder(owner, o.id, "deliver");
    expect(await tidyTrips()).toBe(0);
    expect(await tidyTrips(new Date(Date.now() + 8 * 86_400_000))).toBe(1);
    expect((await db.driverTrip.findFirst())!.lastLat).toBeNull();
  });
});

describe("driver tracking for delivery jobs", () => {
  it("the accepted carrier sends the link, the poster watches, and both confirming ends it", async () => {
    const posterUser = await user();
    const carrierUser = await user();
    const poster = await saveBusiness(posterUser, { name: "Kano Gas", roles: ["BUYER"], state: "Kano" });
    const carrier = await saveBusiness(carrierUser, { name: "Northern Haulage", roles: ["DELIVERY"], state: "Kano" });
    const job = await db.deliveryJob.create({ data: { posterId: poster.id, title: "20 t LPG", products: ["lpg"], quantity: 20, unit: "tonnes", fromState: "Lagos", toState: "Kano", pickupDate: new Date(), status: "AWARDED" } });
    const q = await db.deliveryQuote.create({ data: { jobId: job.id, carrierId: carrier.id, priceNaira: 2_000_000, status: "ACCEPTED" } });
    await db.deliveryJob.update({ where: { id: job.id }, data: { acceptedQuoteId: q.id } });

    await expect(createDriverLink(posterUser, { kind: "DELIVERY_JOB", id: job.id }, { driverName: "Sani" })).rejects.toThrow();
    const t = token((await createDriverLink(carrierUser, { kind: "DELIVERY_JOB", id: job.id }, { driverName: "Sani" })).path);
    await recordPing(t, { lat: 6.6, lon: 3.35, speed: 0 }, at(0));
    const view = await tripView(posterUser, { kind: "DELIVERY_JOB", id: job.id }, at(10));
    // No geocoder in tests, so the drop-off falls back to Kano's state capital.
    expect(view.dest?.label).toMatch(/Kano state capital/);
    expect(view.distanceKm).toBeGreaterThan(700);
    expect(view.etaMin).toBeGreaterThan(60 * 15);
    await expect(driverDelivered(t)).rejects.toThrow(/confirmed by both/);

    await confirmDelivered(posterUser, job.id);
    await confirmDelivered(carrierUser, job.id);
    await expect(recordPing(t, { lat: 7, lon: 5 })).rejects.toBeInstanceOf(TripEndedError);
  });
});
