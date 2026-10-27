import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { requestVerification, saveBusiness, setBusinessPlan, reviewBusiness } from "@/server/hub/business";
import { createListing } from "@/server/hub/market";
import { reportPrice } from "@/server/hub/prices";
import { confirmPhone, saveAlertSettings, sendMorningPriceAlerts, startPhoneConfirmation } from "@/server/hub/alerts";
import { sendText, setMessengerForTests, type TextMessage } from "@/server/messaging";
import { reliability } from "@/server/hub/reliability";
import { assignVisit, decideVisit, markPaid, myVisits, setFieldAgent, submitVisit } from "@/server/hub/field";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);
afterEach(() => setMessengerForTests(null));

const DAY = 86_400_000;

async function biz(roles: string[], state = "LA", name = `Biz ${Math.random().toString(36).slice(2, 7)}`) {
  const u = await user();
  const b = await saveBusiness(u, { name, roles: roles as never, products: ["LPG"], state, phone: "+234 800 000 0000", cacNumber: "RC 123" });
  return { u, b };
}

/** Three sellers so Lagos LPG has a published median. */
async function lagosBoard(now: Date) {
  for (const p of [1300, 1350, 1400]) {
    const { u } = await biz(["SELLER"]);
    await reportPrice(u, { product: "LPG", state: "LA", priceNgn: p, chargedOn: new Date(now.getTime() - DAY), confirmCharged: true }, now);
  }
}

function fakeMessenger() {
  const sent: TextMessage[] = [];
  setMessengerForTests({ async send(m) { sent.push(m); return { id: `SM${sent.length}` }; } });
  return sent;
}

describe("morning price alerts", () => {
  it("sends once a day after 7am Lagos time, in-app with medians", async () => {
    const at7 = new Date("2026-10-27T06:00:00Z"); // 07:00 WAT
    await lagosBoard(at7);
    const u = await user();
    await saveAlertSettings(u, { states: ["LA"], products: ["LPG"] });

    expect(await sendMorningPriceAlerts(new Date("2026-10-27T05:59:00Z"))).toEqual({ users: 0, texts: 0 });
    expect(await sendMorningPriceAlerts(at7)).toEqual({ users: 1, texts: 0 });
    expect(await sendMorningPriceAlerts(new Date(at7.getTime() + 3_600_000))).toEqual({ users: 0, texts: 0 });

    const alerts = await db.alert.findMany({ where: { userId: u.id } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.kind).toBe("PRICE_DIGEST");
    expect(alerts[0]!.body).toContain("₦1,350");
    expect(alerts[0]!.body).not.toContain("1,300");

    // Next Lagos day sends again.
    expect((await sendMorningPriceAlerts(new Date(at7.getTime() + DAY))).users).toBe(1);
  });

  it("refuses SMS until it is switched on, and texts only a confirmed number", async () => {
    const u = await user();
    await expect(saveAlertSettings(u, { states: ["LA"], channels: ["SMS"] })).rejects.toThrow(/not switched on/);

    const sent = fakeMessenger();
    const sub = await saveAlertSettings(u, { states: ["LA"], channels: ["SMS"] });
    expect(sub.channels.sort()).toEqual(["IN_APP", "SMS"]);
    const day1 = new Date("2026-10-27T07:00:00Z");
    expect((await sendMorningPriceAlerts(day1)).texts).toBe(0);

    await expect(startPhoneConfirmation(u, "not a phone")).rejects.toThrow(/mobile number/);
    const t0 = new Date("2026-10-27T08:00:00Z");
    await startPhoneConfirmation(u, "0803 123 4567", t0);
    await expect(startPhoneConfirmation(u, "0803 123 4567", new Date(t0.getTime() + 10_000))).rejects.toThrow(/wait a minute/i);
    expect(sent[0]!.to).toBe("+2348031234567");
    const code = sent[0]!.body.match(/\d{6}/)![0];
    await expect(confirmPhone(u, code === "000000" ? "111111" : "000000", t0)).rejects.toThrow(/not right/);
    await expect(confirmPhone(u, code, new Date(t0.getTime() + 16 * 60_000))).rejects.toThrow(/expired/);
    await confirmPhone(u, code, new Date(t0.getTime() + 60_000));

    expect((await sendMorningPriceAlerts(new Date(day1.getTime() + DAY))).texts).toBe(1);
    expect(sent.at(-1)!.channel).toBe("SMS");
    expect(await db.outboundMessage.count({ where: { userId: u.id, status: "SENT" } })).toBe(2);
  });
});

describe("Twilio adapter", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it("posts to the Messages API and records failures without throwing", async () => {
    const seen: { url: string; auth: string; body: string }[] = [];
    let fail = false;
    const server = createServer((req: IncomingMessage, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ url: req.url ?? "", auth: req.headers.authorization ?? "", body });
        res.writeHead(fail ? 400 : 201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(fail ? { message: "Invalid To" } : { sid: "SM123" }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      Object.assign(process.env, { MESSAGING_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "tok", TWILIO_SMS_FROM: "+15550001111", TWILIO_WHATSAPP_FROM: "+15550002222", TWILIO_API_BASE: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
      expect(await sendText(null, { channel: "WHATSAPP", to: "+2348031234567", body: "hi" })).toBe(true);
      expect(seen[0]!.url).toBe("/2010-04-01/Accounts/AC1/Messages.json");
      expect(seen[0]!.auth).toBe(`Basic ${Buffer.from("AC1:tok").toString("base64")}`);
      const form = new URLSearchParams(seen[0]!.body);
      expect(form.get("To")).toBe("whatsapp:+2348031234567");
      expect(form.get("From")).toBe("whatsapp:+15550002222");
      fail = true;
      expect(await sendText(null, { channel: "SMS", to: "+2348031234567", body: "hi" })).toBe(false);
      const rows = await db.outboundMessage.findMany({ orderBy: { createdAt: "asc" } });
      expect(rows.map((r) => r.status)).toEqual(["SENT", "FAILED"]);
      expect(rows[1]!.error).toMatch(/Invalid To/);
    } finally {
      server.close();
    }
  });

  it("sends nothing when messaging is not configured", async () => {
    delete process.env.MESSAGING_PROVIDER;
    expect(await sendText(null, { channel: "SMS", to: "+2348031234567", body: "hi" })).toBe(false);
    expect(await db.outboundMessage.count()).toBe(0);
  });
});

describe("Verified Business plan", () => {
  it("is set by administrators, for verified businesses only, and raises limits", async () => {
    const { u, b } = await biz(["SELLER"]);
    const admin = await user("ADMIN");
    await expect(setBusinessPlan(await user("EDITOR"), { businessId: b.id, plan: "VERIFIED_BUSINESS" })).rejects.toThrow(/permission/i);
    await expect(setBusinessPlan(admin, { businessId: b.id, plan: "VERIFIED_BUSINESS" })).rejects.toThrow(/verified businesses/);

    for (let i = 0; i < 20; i++) await createListing(u, { kind: "OFFER", product: "LPG", quantity: 1000, unit: "kg", state: "LA" });
    await expect(createListing(u, { kind: "OFFER", product: "LPG", quantity: 1000, unit: "kg", state: "LA" })).rejects.toThrow(/20 live listings/);

    await requestVerification(u);
    await reviewBusiness(await user("EDITOR"), { businessId: b.id, decision: "VERIFY" });
    const now = new Date();
    const p = await setBusinessPlan(admin, { businessId: b.id, plan: "VERIFIED_BUSINESS", months: 3 }, now);
    expect(p.planUntil!.getTime()).toBe(now.getTime() + 90 * DAY);
    await createListing(u, { kind: "OFFER", product: "LPG", quantity: 1000, unit: "kg", state: "LA" });
  });
});

describe("reliability", () => {
  it("needs five confirmed records and counts short deliveries", async () => {
    const seller = await biz(["SELLER"]);
    const buyer = await biz(["BUYER"]);
    const a = await db.supplyAgreement.create({ data: { buyerId: buyer.b.id, sellerId: seller.b.id, proposedById: buyer.b.id, product: "LPG", quantity: 1000, unit: "kg", frequency: "WEEKLY", deliverTo: "x", startsOn: new Date(Date.now() - 60 * DAY), status: "ACTIVE" } });
    const add = (q: number, both = true, ago = 10) => db.supplyDelivery.create({ data: { agreementId: a.id, deliveredOn: new Date(Date.now() - ago * DAY), quantity: q, sellerConfirmedAt: new Date(), buyerConfirmedAt: both ? new Date() : null, createdAt: new Date(Date.now() - ago * DAY) } });
    for (let i = 0; i < 4; i++) await add(1000);
    expect((await reliability(seller.b.id)).score).toBeNull();
    await add(500);
    await add(1000, false, 30); // overdue and only one side confirmed
    const r = await reliability(seller.b.id);
    expect(r.confirmed).toBe(5);
    expect(r.due).toBe(6);
    // confirmation 5/6 (weight 0.6), quantity 0.9 (weight 0.2), no timeliness data.
    expect(r.score).toBe(Math.round((100 * (0.6 * (5 / 6) + 0.2 * 0.9)) / 0.8));
  });
});

describe("field verification programme", () => {
  it("assigns, submits, accepts with payout and records payment", async () => {
    const editor = await user("EDITOR");
    const admin = await user("ADMIN");
    const agentUser = await user();
    const { u: owner, b } = await biz(["SELLER"], "OG");
    await expect(setFieldAgent(await user(), { email: agentUser.email, areas: ["LA"], enabled: true })).rejects.toThrow(/permission/i);
    await setFieldAgent(editor, { email: agentUser.email, areas: ["LA"], enabled: true });

    await expect(assignVisit(editor, b.id, agentUser.id)).rejects.toThrow(/waiting for verification/);
    await requestVerification(owner);
    await expect(assignVisit(editor, b.id, agentUser.id)).rejects.toThrow(/does not cover/);
    await setFieldAgent(editor, { email: agentUser.email, areas: ["LA", "OG"], enabled: true });
    const v = await assignVisit(editor, b.id, agentUser.id);
    await expect(assignVisit(editor, b.id, agentUser.id)).rejects.toThrow(/open visit/);

    const report = { visitId: v.id, visitedOn: new Date(), cacSeen: true, licenceSeen: true, premisesSeen: true, phoneAnswered: false, productSeen: true, notes: "Met the manager, saw the tanks." };
    await expect(submitVisit(await user(), report)).rejects.toThrow(/not found/i);
    await expect(submitVisit(agentUser, { ...report, visitedOn: new Date(Date.now() + 3 * DAY) })).rejects.toThrow(/after it happens/);
    await submitVisit(agentUser, report);
    await expect(decideVisit(editor, v.id, true)).rejects.toThrow(/reached the phone/);
    await decideVisit(editor, v.id, false, "Phone did not answer; call again.");
    expect((await db.hubBusiness.findUniqueOrThrow({ where: { id: b.id } })).verification).toBe("UNVERIFIED");

    await requestVerification(owner);
    const v2 = await assignVisit(editor, b.id, agentUser.id);
    await submitVisit(agentUser, { ...report, visitId: v2.id, phoneAnswered: true });
    await decideVisit(editor, v2.id, true);
    expect((await db.hubBusiness.findUniqueOrThrow({ where: { id: b.id } })).verification).toBe("VERIFIED");

    await expect(markPaid(editor, v2.id)).rejects.toThrow(/permission/i);
    let mine = await myVisits(agentUser);
    expect(mine.earnings).toEqual({ accepted: 1, owed: 5000, paid: 0 });
    await markPaid(admin, v2.id);
    await expect(markPaid(admin, v2.id)).rejects.toThrow(/unpaid/);
    mine = await myVisits(agentUser);
    expect(mine.earnings).toEqual({ accepted: 1, owed: 0, paid: 5000 });
    await expect(myVisits(await user())).rejects.toThrow(/not a field agent/);
  });
});
