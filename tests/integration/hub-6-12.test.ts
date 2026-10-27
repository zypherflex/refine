import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { requestVerification, reviewBusiness, saveBusiness } from "@/server/hub/business";
import { reportPrice } from "@/server/hub/prices";
import { createApiKey, historyCsv, priceHistory, revokeApiKey, setPriceDataAccess, userForApiKey } from "@/server/hub/priceindex";
import { createPartner, lenderDecide, lenderQueue, requestFinance, setPartnerStaff, sharedRecord, withdrawFinance } from "@/server/hub/finance";
import { checkCylinder, recordCylinders, registerCylinders } from "@/server/hub/cylinders";
import { GET as historyRoute } from "@/app/api/v1/prices/history/route";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

const DAY = 86_400_000;

async function biz(roles: string[], state = "LA", name = `Biz ${Math.random().toString(36).slice(2, 7)}`) {
  const u = await user();
  const b = await saveBusiness(u, { name, roles: roles as never, products: ["LPG"], state, phone: "+234 800 000 0000", cacNumber: "RC 123" });
  return { u, b };
}

async function verified(roles: string[], state = "LA") {
  const x = await biz(roles, state);
  await requestVerification(x.u);
  await reviewBusiness(await user("EDITOR"), { businessId: x.b.id, decision: "VERIFY" });
  return x;
}

describe("price index", () => {
  it("publishes weekly medians only from three sellers, each counted once a week", async () => {
    const now = new Date("2026-10-27T12:00:00Z");
    const sellers = await Promise.all([biz(["SELLER"]), biz(["SELLER"]), biz(["SELLER"])]);
    // This week: three sellers. One seller reports twice; only the latest counts.
    await reportPrice(sellers[0].u, { product: "LPG", state: "LA", priceNgn: 1000, chargedOn: new Date(now.getTime() - 3 * DAY), confirmCharged: true }, now);
    await reportPrice(sellers[0].u, { product: "LPG", state: "LA", priceNgn: 1300, chargedOn: new Date(now.getTime() - 1 * DAY), confirmCharged: true }, now);
    await reportPrice(sellers[1].u, { product: "LPG", state: "LA", priceNgn: 1400, chargedOn: new Date(now.getTime() - 2 * DAY), confirmCharged: true }, now);
    await reportPrice(sellers[2].u, { product: "LPG", state: "LA", priceNgn: 1500, chargedOn: new Date(now.getTime() - 2 * DAY), confirmCharged: true }, now);
    // Last week: only two sellers.
    await reportPrice(sellers[1].u, { product: "LPG", state: "LA", priceNgn: 1350, chargedOn: new Date(now.getTime() - 9 * DAY), confirmCharged: true }, now);
    await reportPrice(sellers[2].u, { product: "LPG", state: "LA", priceNgn: 1450, chargedOn: new Date(now.getTime() - 10 * DAY), confirmCharged: true }, now);

    const pts = await priceHistory({ product: "LPG", state: "LA", weeks: 2 }, now);
    expect(pts).toEqual([{ weekEnding: "2026-10-20", median: null, sellers: 2 }, { weekEnding: "2026-10-27", median: 1400, sellers: 3 }]);
    expect((await priceHistory({ product: "LPG", state: "NG", weeks: 1 }, now))[0]!.median).toBe(1400);
    expect((await priceHistory({ product: "LPG", state: "KN", weeks: 1 }, now))[0]!.sellers).toBe(0);
    expect(historyCsv("LPG", "LA", pts)).toBe("week_ending,product,state,median_ngn,sellers\n2026-10-20,LPG,LA,,2\n2026-10-27,LPG,LA,1400,3\n");
    await expect(priceHistory({ product: "CRUDE", state: "LA" })).rejects.toThrow(/Unknown product/);
  });

  it("issues API keys only to subscribers, and stops them when revoked or when access ends", async () => {
    const admin = await user("ADMIN");
    const u = await user();
    await expect(createApiKey(u, "Credit")).rejects.toThrow(/subscription/);
    await expect(setPriceDataAccess(await user("EDITOR"), { email: u.email, months: 12 })).rejects.toThrow(/permission/i);
    await setPriceDataAccess(admin, { email: u.email, months: 12 });
    const { id, key } = await createApiKey(u, "Credit");
    expect(key).toMatch(/^rl_live_/);
    expect((await db.apiKey.findUniqueOrThrow({ where: { id } })).hash).not.toContain(key);
    expect((await userForApiKey(key))?.id).toBe(u.id);

    const ok = await historyRoute(new Request("http://x/api/v1/prices/history?product=LPG&state=LA&weeks=4", { headers: { authorization: `Bearer ${key}` } }));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.points).toHaveLength(4);
    expect(body.methodology).toMatch(/never published/);
    expect((await historyRoute(new Request("http://x/api/v1/prices/history?product=LPG", { headers: { authorization: "Bearer rl_live_nope" } }))).status).toBe(401);
    expect((await historyRoute(new Request("http://x/api/v1/prices/history?product=GOLD", { headers: { authorization: `Bearer ${key}` } }))).status).toBe(400);

    await revokeApiKey(u, id);
    expect(await userForApiKey(key)).toBeNull();
    const { key: k2 } = await createApiKey(u, "Ops");
    await setPriceDataAccess(admin, { email: u.email, months: 0 });
    expect(await userForApiKey(k2)).toBeNull();
    expect(await db.apiKey.count({ where: { userId: u.id, revokedAt: null } })).toBe(0);
  });
});

describe("inventory finance pilot", () => {
  async function withRecord() {
    const seller = await verified(["SELLER"]);
    const buyer = await biz(["BUYER"]);
    const a = await db.supplyAgreement.create({ data: { buyerId: buyer.b.id, sellerId: seller.b.id, proposedById: buyer.b.id, product: "LPG", quantity: 1000, unit: "kg", frequency: "WEEKLY", deliverTo: "x", startsOn: new Date(Date.now() - 60 * DAY), status: "ACTIVE" } });
    for (let i = 1; i <= 5; i++) await db.supplyDelivery.create({ data: { agreementId: a.id, deliveredOn: new Date(Date.now() - i * 7 * DAY), quantity: 1000, sellerConfirmedAt: new Date(), buyerConfirmedAt: new Date() } });
    return seller;
  }

  it("shares a record only with consent, only with the chosen lender, until withdrawn", async () => {
    const admin = await user("ADMIN");
    const partner = await createPartner(admin, { name: "Test Lender", states: ["LA"] });
    const other = await createPartner(admin, { name: "Other Lender" });
    const staff = await user();
    const otherStaff = await user();
    await setPartnerStaff(admin, partner.id, staff.email, true);
    await setPartnerStaff(admin, other.id, otherStaff.email, true);

    const newcomer = await verified(["SELLER"]);
    const ask = { partnerId: partner.id, amountNgn: 2_000_000, purpose: "STOCK", product: "LPG", consent: true as const };
    await expect(requestFinance(newcomer.u, ask)).rejects.toThrow(/at least 5 trades/);

    const seller = await withRecord();
    await expect(requestFinance(seller.u, { ...ask, consent: false as never })).rejects.toThrow(/consent/);
    const req = await requestFinance(seller.u, ask);
    await expect(requestFinance(seller.u, ask)).rejects.toThrow(/open request/);

    const { record } = await sharedRecord(staff, req.id);
    expect(record.months.reduce((s, m) => s + m.supplyDeliveries, 0)).toBe(5);
    expect(record.counterparties).toBe(1);
    expect(record.reliability.score).toBe(100);
    await expect(sharedRecord(otherStaff, req.id)).rejects.toThrow(/not shared/);
    await expect(sharedRecord(await user(), req.id)).rejects.toThrow(/lender partners/);
    expect((await lenderQueue(otherStaff)).requests).toHaveLength(0);

    await expect(lenderDecide(staff, { requestId: req.id, status: "DECLINED" })).rejects.toThrow(/say why/i);
    await lenderDecide(staff, { requestId: req.id, status: "OFFERED", note: "Call us on 0800." });
    const alert = await db.alert.findFirstOrThrow({ where: { userId: seller.u.id, kind: "FINANCE" } });
    expect(alert.title).toMatch(/Test Lender would like to make an offer/);
    expect(alert.body).toMatch(/does not lend or hold money/);

    await withdrawFinance(seller.u, req.id);
    await expect(sharedRecord(staff, req.id)).rejects.toThrow(/not shared/);
  });

  it("respects the lender's states and keeps business owners out of lender seats", async () => {
    const admin = await user("ADMIN");
    const partner = await createPartner(admin, { name: "Kano Lender", states: ["KN"] });
    const seller = await withRecord();
    await expect(requestFinance(seller.u, { partnerId: partner.id, amountNgn: 100_000, purpose: "STOCK", product: "LPG", consent: true })).rejects.toThrow(/does not lend in your state/);
    await expect(setPartnerStaff(admin, partner.id, seller.u.email, true)).rejects.toThrow(/owns a trade hub business/);
    await expect(createPartner(await user("EDITOR"), { name: "Nope Bank" })).rejects.toThrow(/permission/i);
  });
});

describe("cylinder tracking", () => {
  it("registers batches, moves cylinders, and refuses to fill overdue or condemned ones", async () => {
    const now = new Date("2026-10-27T10:00:00Z");
    const owner = await biz(["SELLER"]);
    const kiosk = await biz(["BUYER"]);
    await expect(registerCylinders(kiosk.u, { prefix: "KK", from: 1, count: 2, sizeKg: 12.5, lastTestOn: new Date("2025-01-01") }, now)).rejects.toThrow(/Only sellers/);
    const r = await registerCylinders(owner.u, { prefix: "ikg", from: 1, count: 3, sizeKg: 12.5, lastTestOn: new Date("2025-01-01") }, now);
    expect(r).toEqual({ first: "IKG-000001", last: "IKG-000003", count: 3 });
    await expect(registerCylinders(owner.u, { prefix: "IKG", from: 3, count: 2, sizeKg: 12.5, lastTestOn: new Date("2025-01-01") }, now)).rejects.toThrow(/Already registered: IKG-000003/);
    await registerCylinders(owner.u, { prefix: "OLD", from: 1, count: 1, sizeKg: 12.5, lastTestOn: new Date("2021-01-01") }, now);

    await recordCylinders(owner.u, { serials: "ikg-000001, IKG-000002", action: "FILL" }, now);
    await expect(recordCylinders(owner.u, { serials: "IKG-000001 OLD-000001", action: "FILL" }, now)).rejects.toThrow(/OLD-000001 is past its retest date/);
    expect((await db.cylinder.findUniqueOrThrow({ where: { serial: "IKG-000001" } })).lastFilledAt).toEqual(now); // all or nothing
    await expect(recordCylinders(owner.u, { serials: "NOPE-1", action: "FILL" }, now)).rejects.toThrow(/Not registered/);

    await recordCylinders(owner.u, { serials: "IKG-000001 IKG-000002", action: "DISPATCH", toBusinessId: kiosk.b.id }, now);
    await expect(recordCylinders(owner.u, { serials: "IKG-000001", action: "FILL" }, now)).rejects.toThrow(/not with you/);
    await expect(recordCylinders(kiosk.u, { serials: "IKG-000001", action: "FILL" }, now)).rejects.toThrow(/only be filled by a seller/);
    await expect(recordCylinders(kiosk.u, { serials: "IKG-000001", action: "CONDEMN" }, now)).rejects.toThrow(/not yours/);
    await recordCylinders(kiosk.u, { serials: "IKG-000001", action: "RETURN" }, now);

    await recordCylinders(owner.u, { serials: "OLD-000001", action: "TEST", testedOn: new Date("2026-10-20") }, now);
    expect((await checkCylinder("old-000001", now))!.nextTestDue.toISOString().slice(0, 10)).toBe("2031-10-20");
    await recordCylinders(owner.u, { serials: "IKG-000001", action: "CONDEMN", note: "Dented valve guard" }, now);
    await expect(recordCylinders(owner.u, { serials: "IKG-000001", action: "FILL" }, now)).rejects.toThrow(/condemned/);

    const pub = await checkCylinder("IKG-000001", now);
    expect(pub).toMatchObject({ status: "CONDEMNED", sizeKg: 12.5, owner: { verification: "UNVERIFIED" } });
    expect(Object.keys(pub!)).not.toContain("holderId");
    expect(await checkCylinder("ZZZ", now)).toBeNull();
    expect(await db.cylinderEvent.count({ where: { cylinder: { serial: "IKG-000001" } } })).toBe(5); // registered, filled, dispatched, returned, condemned
  });
});
