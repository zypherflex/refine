import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { deliveryRecord, getBusiness, listDirectory, reportBusiness, requestVerification, reviewBusiness, saveBusiness } from "@/server/hub/business";
import { createListing, listListings, sendEnquiry } from "@/server/hub/market";
import { priceBoard, reportPrice } from "@/server/hub/prices";
import { addSite, gasNetwork } from "@/server/hub/gas";
import { acceptQuote, confirmDelivery, getJob, postJob, quoteJob } from "@/server/hub/jobs";
import { confirmSupplyDelivery, getAgreement, proposeAgreement, recordDelivery, respondAgreement } from "@/server/hub/supply";
import { registerInterest } from "@/server/hub/plans";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function biz(roles: string[], name = `Biz ${Math.random().toString(36).slice(2, 7)}`, state = "LA") {
  const u = await user();
  const b = await saveBusiness(u, { name, roles: roles as never, products: ["LPG"], state, phone: "+234 800 000 0000", cacNumber: "RC 123" });
  return { u, b };
}

describe("verification and fraud guardrails", () => {
  it("only editors verify; changing identity removes the badge; suspension hides the business", async () => {
    const { u, b } = await biz(["SELLER"], "Ikeja Gas");
    const editor = await user("EDITOR");
    await requestVerification(u);
    await expect(reviewBusiness(await user("ANALYST"), { businessId: b.id, decision: "VERIFY" })).rejects.toThrow(/permission/i);
    await reviewBusiness(editor, { businessId: b.id, decision: "VERIFY" });
    expect((await getBusiness(u, b.id)).verification).toBe("VERIFIED");

    await saveBusiness(u, { name: "Ikeja Gas Ltd", roles: ["SELLER"], state: "LA", phone: "+234 1", cacNumber: "RC 123" });
    expect((await getBusiness(u, b.id)).verification).toBe("UNVERIFIED");

    await createListing(u, { kind: "OFFER", product: "LPG", quantity: 1000, unit: "kg", state: "LA" });
    await expect(reviewBusiness(editor, { businessId: b.id, decision: "SUSPEND" })).rejects.toThrow(/say why/i);
    await reviewBusiness(editor, { businessId: b.id, decision: "SUSPEND", note: "Advance payment fraud" });
    const stranger = await user();
    await expect(getBusiness(stranger, b.id)).rejects.toThrow(/not found/i);
    expect(await listDirectory()).toHaveLength(0);
    expect(await listListings()).toHaveLength(0);
    await expect(createListing(u, { kind: "OFFER", product: "LPG", quantity: 1, unit: "kg", state: "LA" })).rejects.toThrow(/suspended/i);
  });

  it("needs a CAC number to ask for verification, and blocks reviewing your own business", async () => {
    const u = await user("EDITOR");
    const b = await saveBusiness(u, { name: "No Papers", roles: ["BUYER"], state: "KN", phone: "+234 1" });
    await expect(requestVerification(u)).rejects.toThrow(/CAC/);
    await expect(reviewBusiness(u, { businessId: b.id, decision: "VERIFY" })).rejects.toThrow(/own business/i);
  });

  it("allows one open report per reporter and not on yourself", async () => {
    const { u, b } = await biz(["SELLER"]);
    const r = await user();
    await reportBusiness(r, { businessId: b.id, reason: "ADVANCE_PAYMENT", details: "Took money" });
    await expect(reportBusiness(r, { businessId: b.id, reason: "OTHER" })).rejects.toThrow(/already/i);
    await expect(reportBusiness(u, { businessId: b.id, reason: "OTHER" })).rejects.toThrow(/own/i);
  });

  it("lists verified businesses first and promoted listings first", async () => {
    const a = await biz(["SELLER"], "Alpha");
    const z = await biz(["SELLER"], "Zulu");
    await db.hubBusiness.update({ where: { id: z.b.id }, data: { verification: "VERIFIED" } });
    expect((await listDirectory()).map((b) => b.name)).toEqual(["Zulu", "Alpha"]);
    const l = await createListing(a.u, { kind: "OFFER", product: "LPG", quantity: 5, unit: "kg", state: "LA" });
    await createListing(z.u, { kind: "OFFER", product: "LPG", quantity: 5, unit: "kg", state: "LA" });
    await db.hubListing.update({ where: { id: l.id }, data: { promoted: true } });
    expect((await listListings())[0]!.id).toBe(l.id);
  });

  it("does not let a business message itself", async () => {
    const { u, b } = await biz(["SELLER"]);
    await expect(sendEnquiry(u, { toId: b.id, message: "hello there" })).rejects.toThrow(/own/i);
    const other = await biz(["BUYER"]);
    await sendEnquiry(other.u, { toId: b.id, message: "Need 2 t weekly" });
    expect(await db.hubEnquiry.count({ where: { toId: b.id } })).toBe(1);
  });
});

describe("price board", () => {
  it("publishes a median only from three or more sellers and never individual prices", async () => {
    const sellers = await Promise.all([biz(["SELLER"]), biz(["SELLER"]), biz(["SELLER"])]);
    await reportPrice(sellers[0].u, { product: "LPG", state: "LA", priceNgn: 1300, chargedOn: daysAgo(1), confirmCharged: true });
    await reportPrice(sellers[1].u, { product: "LPG", state: "LA", priceNgn: 1400, chargedOn: daysAgo(2), confirmCharged: true });
    let cell = (await priceBoard()).find((c) => c.product === "LPG" && c.state === "LA")!;
    expect(cell.sellers).toBe(2);
    expect(cell.median).toBeNull();
    await reportPrice(sellers[2].u, { product: "LPG", state: "LA", priceNgn: 1350, chargedOn: daysAgo(1), confirmCharged: true });
    // A seller's older report is superseded by their latest one.
    await reportPrice(sellers[0].u, { product: "LPG", state: "LA", priceNgn: 5000, chargedOn: daysAgo(5), confirmCharged: true });
    cell = (await priceBoard()).find((c) => c.product === "LPG" && c.state === "LA")!;
    expect(cell).toMatchObject({ sellers: 3, median: 1350 });
    expect(Object.keys(cell)).not.toContain("prices");
  });

  it("refuses future, stale, implausible and unconfirmed prices, and non-sellers", async () => {
    const { u } = await biz(["SELLER"]);
    await expect(reportPrice(u, { product: "LPG", state: "LA", priceNgn: 1300, chargedOn: new Date(Date.now() + 2 * DAY), confirmCharged: true })).rejects.toThrow(/future/i);
    await expect(reportPrice(u, { product: "LPG", state: "LA", priceNgn: 1300, chargedOn: daysAgo(45), confirmCharged: true })).rejects.toThrow(/last 30 days/);
    await expect(reportPrice(u, { product: "LPG", state: "LA", priceNgn: 13000, chargedOn: daysAgo(1), confirmCharged: true })).rejects.toThrow(/expected range/);
    await expect(reportPrice(u, { product: "LPG", state: "LA", priceNgn: 1300, chargedOn: daysAgo(1), confirmCharged: false as true })).rejects.toThrow(/actually charged/);
    const buyer = await biz(["BUYER"]);
    await expect(reportPrice(buyer.u, { product: "LPG", state: "LA", priceNgn: 1300, chargedOn: daysAgo(1), confirmCharged: true })).rejects.toThrow(/Only sellers/);
  });

  it("drops reports older than the window", async () => {
    const sellers = await Promise.all([biz(["SELLER"]), biz(["SELLER"]), biz(["SELLER"])]);
    for (const s of sellers) await reportPrice(s.u, { product: "DIESEL", state: "LA", priceNgn: 2000, chargedOn: daysAgo(20), confirmCharged: true });
    expect((await priceBoard()).find((c) => c.product === "DIESEL")).toBeUndefined();
  });
});

describe("gas network", () => {
  it("shows gaps, flags stale sites and drops expired ones", async () => {
    const seller = await biz(["SELLER"]);
    const buyer = await biz(["BUYER"], "Mill", "KD");
    await addSite(seller.u, { kind: "SUPPLY", gas: "LPG", name: "Plant", state: "LA" });
    await addSite(buyer.u, { kind: "DEMAND", gas: "LPG", name: "Boilers", state: "KD" });
    const old = await addSite(seller.u, { kind: "SUPPLY", gas: "LPG", name: "Old skid", state: "OG" });
    await db.gasSite.update({ where: { id: old.id }, data: { lastConfirmedAt: daysAgo(200) } });
    await expect(addSite(buyer.u, { kind: "DELIVERY", gas: "LPG", name: "Route", state: "KD" })).rejects.toThrow(/hauliers and sellers/);
    const { cells, sites } = await gasNetwork("LPG");
    expect(cells.find((c) => c.state === "KD")!.status).toBe("GAP");
    expect(cells.find((c) => c.state === "LA")!.status).toBe("SERVED");
    expect(cells.find((c) => c.state === "OG")!.status).toBe("NO_DATA");
    expect(sites).toHaveLength(2);
  });
});

describe("delivery jobs", () => {
  it("collects quotes, accepts one, and counts only deliveries confirmed by both sides", async () => {
    const poster = await biz(["BUYER"]);
    const h1 = await biz(["HAULIER"]);
    const h2 = await biz(["HAULIER"]);
    const seller = await biz(["SELLER"]);
    const job = await postJob(poster.u, { product: "LPG", quantity: 20000, unit: "kg", fromState: "LA", fromPlace: "Ikeja", toState: "LA", toPlace: "Lekki", readyBy: new Date(Date.now() + DAY) });
    await expect(quoteJob(seller.u, { jobId: job.id, priceNgn: 1, days: 1 })).rejects.toThrow(/Only hauliers/);
    const q1 = await quoteJob(h1.u, { jobId: job.id, priceNgn: 450000, days: 1 });
    await quoteJob(h2.u, { jobId: job.id, priceNgn: 520000, days: 2 });

    // Hauliers see only their own quote; the poster sees both.
    expect((await getJob(h2.u, job.id)).quotes).toHaveLength(1);
    expect((await getJob(poster.u, job.id)).quotes).toHaveLength(2);
    await expect(acceptQuote(h1.u, q1.id)).rejects.toThrow(/not found/i);

    await acceptQuote(poster.u, q1.id);
    await expect(acceptQuote(poster.u, q1.id)).rejects.toThrow(/already/);
    expect((await db.deliveryQuote.findMany({ where: { jobId: job.id } })).map((q) => q.status).sort()).toEqual(["ACCEPTED", "DECLINED"]);
    await expect(confirmDelivery(h2.u, job.id)).rejects.toThrow(/two sides/);

    await confirmDelivery(poster.u, job.id);
    expect((await deliveryRecord(h1.b.id)).jobs).toBe(0);
    const done = await confirmDelivery(h1.u, job.id);
    expect(done.status).toBe("DELIVERED");
    expect((await deliveryRecord(h1.b.id)).jobs).toBe(1);
    expect((await deliveryRecord(poster.b.id)).jobs).toBe(1);
  });

  it("refuses past ready dates", async () => {
    const poster = await biz(["BUYER"]);
    await expect(postJob(poster.u, { product: "LPG", quantity: 1, unit: "kg", fromState: "LA", fromPlace: "A place", toState: "OG", toPlace: "B place", readyBy: daysAgo(3) })).rejects.toThrow(/past/);
  });
});

describe("recurring supply", () => {
  it("needs the other side to accept, and counts deliveries confirmed by both", async () => {
    const buyer = await biz(["BUYER"]);
    const seller = await biz(["SELLER"]);
    const outsider = await biz(["BUYER"]);
    const a = await proposeAgreement(buyer.u, { counterpartyId: seller.b.id, myRole: "BUYER", product: "LPG", quantity: 5000, unit: "kg", frequency: "WEEKLY", startsOn: daysAgo(10) });
    await expect(respondAgreement(buyer.u, a.id, true)).rejects.toThrow(/other business/);
    await expect(getAgreement(outsider.u, a.id)).rejects.toThrow(/not found/i);
    await expect(recordDelivery(seller.u, { agreementId: a.id, deliveredOn: daysAgo(1), quantity: 5000 })).rejects.toThrow(/active/);
    await respondAgreement(seller.u, a.id, true);

    const d = await recordDelivery(seller.u, { agreementId: a.id, deliveredOn: daysAgo(3), quantity: 5000 });
    await expect(recordDelivery(seller.u, { agreementId: a.id, deliveredOn: daysAgo(30), quantity: 5000 })).rejects.toThrow(/before the agreement/);
    await expect(confirmSupplyDelivery(seller.u, d.id)).rejects.toThrow(/already confirmed/);
    expect((await deliveryRecord(buyer.b.id)).supply).toBe(0);
    await confirmSupplyDelivery(buyer.u, d.id);
    expect(await deliveryRecord(buyer.b.id)).toMatchObject({ supply: 1, pending: 0 });
    expect((await deliveryRecord(seller.b.id)).supply).toBe(1);
  });
});

describe("plans", () => {
  it("records interest once per line without taking payment", async () => {
    const u = await user();
    await registerInterest(u, { line: "price-intelligence", message: "Bank credit team" });
    await registerInterest(u, { line: "price-intelligence", message: "Updated" });
    expect(await db.planInterest.count()).toBe(1);
    await expect(registerInterest(u, { line: "escrow" as never })).rejects.toThrow(/licensed partner/);
    await expect(registerInterest(u, { line: "not-a-line" as never })).rejects.toThrow();
  });
});
