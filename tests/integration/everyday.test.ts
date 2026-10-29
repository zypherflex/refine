import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addOutlet, getOutlet, listOutlets, reportOutlet, todayPrices } from "@/server/everyday/outlets";
import { advanceOrder, cancelOrder, deliverySellers, getOrder, placeOrder, rateOrder, saveHomeDelivery } from "@/server/everyday/orders";
import { addCylinder, logRefill, myCylinders, sendRefillReminders } from "@/server/everyday/cylinders";
import { saveBusiness } from "@/server/hub/business";
import { deleteAccount } from "@/server/services/account";
import type { Actor } from "@/lib/permissions";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

const station = (u: Actor) => addOutlet(u, { name: "MRS Ojuelegba", brand: "MRS", kind: "FILLING_STATION", state: "Lagos", area: "Surulere" });

describe("stations and public reports", () => {
  it("refuses duplicates and products a place does not sell", async () => {
    const u = await user();
    const o = await station(u);
    await expect(station(u)).rejects.toThrow(/already listed/);
    await expect(reportOutlet(u, o.id, { kind: "PRICE", item: "cng_scm", priceNaira: 300 })).rejects.toThrow(/not sold/);
  });

  it("shows a state median only once three people report, and refuses far-off prices after that", async () => {
    const people = [await user(), await user(), await user(), await user()];
    const o = await station(people[0]);
    await reportOutlet(people[0], o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 940 });
    await reportOutlet(people[1], o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 950 });
    let today = await todayPrices("Lagos");
    expect(today.rows.find((r) => r.item === "pms_retail_litre")!.people).toMatchObject({ median: null, reporters: 2 });
    await reportOutlet(people[2], o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 960 });
    today = await todayPrices("Lagos");
    expect(today.rows.find((r) => r.item === "pms_retail_litre")!.people.median).toBe(950);
    await expect(reportOutlet(people[3], o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 9500 })).rejects.toThrow(/far from/);
    await expect(reportOutlet(people[0], o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 945 })).rejects.toThrow(/6 hours/);
    await expect(reportOutlet(people[3], o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 50 })).rejects.toThrow(/looks wrong/);
  });

  it("lists queues and problems on the station page", async () => {
    const u = await user();
    const o = await station(u);
    await reportOutlet(u, o.id, { kind: "AVAILABILITY", item: "pms_retail_litre", available: true, queue: "LONG" });
    await reportOutlet(u, o.id, { kind: "PROBLEM", problem: "SHORT_MEASURE", note: "Paid 10 litres, got 8.5" });
    const [card] = await listOutlets({ state: "Lagos" });
    expect(card.availability[0]).toMatchObject({ available: true, queue: "LONG" });
    expect(card.problems30d).toBe(1);
    const page = await getOutlet(o.id);
    expect(page.problems).toEqual([["SHORT_MEASURE", 1]]);
    await db.outlet.update({ where: { id: o.id }, data: { hidden: true } });
    expect(await listOutlets({ state: "Lagos" })).toHaveLength(0);
    await expect(getOutlet(o.id)).rejects.toThrow(/not found/);
  });
});

async function verifiedSeller() {
  const owner = await user();
  const b = await saveBusiness(owner, { name: "Surulere Gas Point", roles: ["SELLER"], state: "Lagos" });
  await saveHomeDelivery(owner, { homeDelivery: true, deliveryStates: ["Lagos"], homePricePerKg: 1200, deliveryFeeNaira: 500 });
  return { owner, b };
}

const order = (businessId: string) => ({ businessId, cylinderKg: 12.5, cylinders: 1, state: "Lagos", area: "Surulere", address: "12 Adeniran Ogunsanya St, by the mall", phone: "0803 123 4567" });

describe("home gas orders", () => {
  it("only verified sellers that deliver to the state receive orders", async () => {
    const { b } = await verifiedSeller();
    const buyer = await user();
    expect(await deliverySellers("Lagos")).toHaveLength(0);
    await expect(placeOrder(buyer, order(b.id))).rejects.toThrow(/does not deliver/);
    await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "VERIFIED" } });
    expect(await deliverySellers("Lagos")).toHaveLength(1);
    expect(await deliverySellers("Kano")).toHaveLength(0);
    await expect(placeOrder(buyer, { ...order(b.id), state: "Kano" })).rejects.toThrow(/does not deliver/);
  });

  it("runs from order to delivery with alerts, a confirmed price and a rating", async () => {
    const { owner, b } = await verifiedSeller();
    await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "VERIFIED" } });
    const buyer = await user();
    const stranger = await user();
    const o = await placeOrder(buyer, order(b.id));
    expect(o.estimateNaira).toBe(15_500);
    expect(o.phone).toBe("+2348031234567");
    expect(await db.alert.count({ where: { userId: owner.id, kind: "GAS_ORDER" } })).toBe(1);
    await expect(getOrder(stranger, o.id)).rejects.toThrow(/not found/);
    await expect(advanceOrder(buyer, o.id, "accept")).rejects.toThrow();
    await expect(rateOrder(buyer, o.id, 5)).rejects.toThrow(/delivered/);

    await advanceOrder(owner, o.id, "accept", { priceNaira: 16_000 });
    await expect(advanceOrder(owner, o.id, "accept")).rejects.toThrow(/moved on/);
    await advanceOrder(owner, o.id, "dispatch");
    await expect(cancelOrder(buyer, o.id)).rejects.toThrow(/no longer be cancelled/);
    await advanceOrder(owner, o.id, "deliver");
    await rateOrder(buyer, o.id, 5);

    const done = await getOrder(buyer, o.id);
    expect(done).toMatchObject({ status: "DELIVERED", priceNaira: 16_000, rating: 5 });
    expect(await db.alert.count({ where: { userId: buyer.id, kind: "GAS_ORDER" } })).toBe(3);
    expect((await deliverySellers("Lagos"))[0]).toMatchObject({ delivered: 1, rating: 5 });
  });

  it("lets the customer cancel before dispatch and limits open orders", async () => {
    const { owner, b } = await verifiedSeller();
    await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "VERIFIED" } });
    const buyer = await user();
    const first = await placeOrder(buyer, order(b.id));
    await cancelOrder(buyer, first.id);
    expect((await getOrder(owner, first.id)).status).toBe("CANCELLED");
    for (let i = 0; i < 3; i++) await placeOrder(buyer, order(b.id));
    await expect(placeOrder(buyer, order(b.id))).rejects.toThrow(/3 orders/);
    await expect(placeOrder(owner, order(b.id))).rejects.toThrow(/own business/);
  });
});

describe("cooking gas tracker", () => {
  it("estimates the empty date and reminds once per refill", async () => {
    const u = await user();
    const c = await addCylinder(u, { sizeKg: 12.5, usualDays: 30, lastFilledAt: new Date(Date.now() - 28 * 86_400_000) });
    const [mine] = await myCylinders(u);
    expect(mine.outlook.daysLeft).toBe(2);
    expect(await sendRefillReminders()).toBe(1);
    expect(await sendRefillReminders()).toBe(0);
    expect(await db.alert.count({ where: { userId: u.id, kind: "REFILL_DUE" } })).toBe(1);
    await logRefill(u, c.id, { filledAt: new Date() });
    const [after] = await myCylinders(u);
    expect(after.outlook).toMatchObject({ measured: true, lastsDays: 28 });
    expect(await sendRefillReminders()).toBe(0);
    const other = await user();
    await expect(logRefill(other, c.id, { filledAt: new Date() })).rejects.toThrow(/not found/);
    await expect(addCylinder(u, { sizeKg: 12.5, usualDays: 30, lastFilledAt: new Date(Date.now() + 5 * 86_400_000) })).rejects.toThrow(/future/);
  });
});

describe("account deletion", () => {
  it("removes orders and cylinders but keeps station reports without the link to the person", async () => {
    const u = await user();
    await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash("correct horse", 4) } });
    const o = await station(u);
    await reportOutlet(u, o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 950 });
    await addCylinder(u, { sizeKg: 12.5, usualDays: 30, lastFilledAt: new Date() });
    await deleteAccount(u, "correct horse", "DELETE");
    expect(await db.gasCylinder.count()).toBe(0);
    expect(await db.outletReport.count({ where: { userId: null } })).toBe(1);
    expect(await db.outlet.count({ where: { addedById: null } })).toBe(1);
  });
});
