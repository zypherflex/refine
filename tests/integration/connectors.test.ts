import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { saveBusiness, requestVerification } from "@/server/hub/business";
import { createSite } from "@/server/hub/gas";
import { reportPrices } from "@/server/hub/prices";
import { handleWebhook, startProCheckout, validWebhookSignature, verifyAndSettle } from "@/server/connect/paystack";
import { getTextSender, normalisePhone } from "@/server/connect/text";
import { lookupBusiness, namesMatch, parseRegistration } from "@/server/connect/registry";
import { geocodeSite } from "@/server/connect/geocode";
import { matchState, ussdReply } from "@/server/connect/ussd";
import { saveTextSettings, sendDueAlertTexts, sendPriceDigests } from "@/server/services/alert-text";
import { createAlert } from "@/server/services/alerts";
import { integrationStatus } from "@/server/integrations";
import { resetDb, user } from "../helpers";

const saved = { ...process.env };
type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

function mockFetch(respond: (url: string, init: RequestInit) => unknown, status = 200) {
  calls = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    const body = respond(String(url), init);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  });
}

beforeEach(resetDb);
afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
});

describe("Paystack", () => {
  beforeEach(() => Object.assign(process.env, { PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: "sk_test_x", PRO_PLAN_PRICE_NGN: "25000", APP_URL: "https://app.example" }));

  it("starts a checkout in kobo and upgrades only after Paystack verifies the full amount", async () => {
    const u = await user();
    mockFetch(() => ({ status: true, data: { authorization_url: "https://checkout.paystack.com/abc" } }));
    const url = await startProCheckout({ ...u, email: u.email });
    expect(url).toBe("https://checkout.paystack.com/abc");
    const body = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toBe("https://api.paystack.co/transaction/initialize");
    expect(body).toMatchObject({ amount: 2_500_000, currency: "NGN", callback_url: "https://app.example/api/payments/paystack/callback" });
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk_test_x");
    const ref = body.reference as string;

    mockFetch(() => ({ status: true, data: { status: "success", amount: 100, currency: "NGN", reference: ref } }));
    expect((await verifyAndSettle(ref)).ok).toBe(false); // tampered amount
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("FREE");

    mockFetch(() => ({ status: true, data: { status: "success", amount: 2_500_000, currency: "NGN", reference: ref } }));
    expect(await verifyAndSettle(ref)).toMatchObject({ ok: true, already: false });
    expect(await handleWebhook({ event: "charge.success", data: { reference: ref } })).toMatchObject({ handled: true, ok: true, already: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).plan).toBe("PRO");
    expect(await verifyAndSettle("not-a-reference")).toMatchObject({ ok: false });
  });

  it("checks the webhook signature as HMAC-SHA512 of the raw body", () => {
    const raw = JSON.stringify({ event: "charge.success" });
    const good = crypto.createHmac("sha512", "sk_test_x").update(raw).digest("hex");
    expect(validWebhookSignature(raw, good)).toBe(true);
    expect(validWebhookSignature(raw + " ", good)).toBe(false);
    expect(validWebhookSignature(raw, null)).toBe(false);
  });

  it("reports payments available only with provider and key", () => {
    expect(integrationStatus().payments.available).toBe(true);
    delete process.env.PAYSTACK_SECRET_KEY;
    expect(integrationStatus().payments.available).toBe(false);
  });
});

describe("text messages", () => {
  it("normalises Nigerian phone numbers", () => {
    expect(normalisePhone("0803 123 4567")).toBe("+2348031234567");
    expect(normalisePhone("2348031234567")).toBe("+2348031234567");
    expect(normalisePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalisePhone("12345")).toBeNull();
  });

  it("sends through Termii, Africa's Talking or WhatsApp with each API's own request shape", async () => {
    Object.assign(process.env, { TEXT_PROVIDER: "termii", TERMII_API_KEY: "tk", TERMII_SENDER_ID: "RefLens" });
    mockFetch(() => ({ code: "ok", message_id: "1" }));
    await getTextSender()!.send("+2348031234567", "Hello");
    expect(calls[0].url).toBe("https://api.ng.termii.com/api/sms/send");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ to: "2348031234567", from: "RefLens", sms: "Hello", api_key: "tk", type: "plain" });

    Object.assign(process.env, { TEXT_PROVIDER: "africastalking", AT_USERNAME: "sandbox", AT_API_KEY: "ak" });
    mockFetch(() => ({ SMSMessageData: { Recipients: [{ status: "Success" }] } }));
    await getTextSender()!.send("+2348031234567", "Hello");
    expect(calls[0].url).toBe("https://api.sandbox.africastalking.com/version1/messaging");
    expect((calls[0].init.headers as Record<string, string>).apiKey).toBe("ak");
    expect(String(calls[0].init.body)).toContain("username=sandbox");

    Object.assign(process.env, { TEXT_PROVIDER: "whatsapp", WHATSAPP_TOKEN: "wt", WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_TEMPLATE: "rl_alert" });
    mockFetch(() => ({ messages: [{ id: "wamid" }] }));
    await getTextSender()!.send("+2348031234567", "Hello");
    expect(calls[0].url).toBe("https://graph.facebook.com/v23.0/123/messages");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ messaging_product: "whatsapp", type: "template", template: { name: "rl_alert" } });

    process.env.TEXT_PROVIDER = "termii";
    delete process.env.TERMII_API_KEY;
    expect(getTextSender()).toBeNull();
  });

  it("texts only trade hub alerts to opted-in users, once, and the price digest once a day", async () => {
    const u = await user();
    const sent: string[] = [];
    const sender = { provider: "termii" as const, async send(_to: string, m: string) { sent.push(m); } };
    await createAlert({ userId: u.id, kind: "HUB_MESSAGE", title: "Old message", body: "", link: "/hub/inbox", dedupeKey: "old" });
    expect(await saveTextSettings(u.id, { phone: "08031234567", textAlerts: true, priceDigest: true, digestState: "Lagos" })).toEqual({ ok: "Saved." });
    await createAlert({ userId: u.id, kind: "HUB_MESSAGE", title: "Kano Gas sent you a message", body: "", link: "/hub/inbox/1", dedupeKey: "m1" });
    await createAlert({ userId: u.id, kind: "NEW_ANNOUNCEMENT", title: "Research alert", body: "", link: "/x", dedupeKey: "r1" });
    expect(await sendDueAlertTexts(new Date(), sender)).toEqual({ sent: 1 });
    expect(sent[0]).toContain("Kano Gas sent you a message");
    expect(await sendDueAlertTexts(new Date(), sender)).toEqual({ sent: 0 });

    const sellers = await Promise.all(["A", "B", "C"].map(async (n) => { const s = await user(); await saveBusiness(s, { name: `${n} Gas`, roles: ["SELLER"], state: "Lagos" }); return s; }));
    for (const [i, s] of sellers.entries()) await reportPrices(s, { state: "Lagos", prices: { lpg_retail_kg: 1200 + i * 100 } });
    const morning = new Date(); morning.setUTCHours(8, 0, 0, 0);
    expect(await sendPriceDigests(morning, sender)).toEqual({ sent: 1 });
    expect(sent[1]).toContain("LPG refill ₦1,300 per kg");
    expect(await sendPriceDigests(morning, sender)).toEqual({ sent: 0 });
    expect(await saveTextSettings(u.id, { phone: "123", textAlerts: true, priceDigest: false, digestState: "" })).toHaveProperty("error");
  });
});

describe("CAC registry lookup", () => {
  it("parses CAC numbers and compares names loosely", () => {
    expect(parseRegistration("RC 1234567")).toEqual({ number: "1234567", companyType: "COMPANY" });
    expect(parseRegistration("bn-998877")).toEqual({ number: "998877", companyType: "BUSINESS_NAME" });
    expect(parseRegistration("not a number")).toBeNull();
    expect(namesMatch("Ikeja Energy Supplies", "IKEJA ENERGY SUPPLIES LIMITED")).toBe(true);
    expect(namesMatch("Ikeja Energy", "Lekki Petroleum Ltd")).toBe(false);
  });

  it("looks the business up on request and stores the result for the administrator", async () => {
    Object.assign(process.env, { CAC_LOOKUP_PROVIDER: "dojah", DOJAH_APP_ID: "app", DOJAH_SECRET_KEY: "sec" });
    const u = await user();
    const b = await saveBusiness(u, { name: "Ikeja Energy Supplies", roles: ["SELLER"], state: "Lagos", registrationNumber: "RC 1234567" });
    await requestVerification(u);
    expect(await db.job.count({ where: { type: "hub.registry-lookup" } })).toBe(1);
    mockFetch(() => ({ entity: { company_name: "IKEJA ENERGY SUPPLIES LTD", status: "ACTIVE" } }));
    const check = await lookupBusiness(b.id);
    expect(calls[0].url).toBe("https://api.dojah.io/api/v1/kyc/cac/basic?rc_number=1234567&company_type=COMPANY");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("sec");
    expect(check).toMatchObject({ ok: true, matches: true, status: "ACTIVE" });
    expect((await db.hubBusiness.findUniqueOrThrow({ where: { id: b.id } })).registryCheckedAt).not.toBeNull();
  });
});

describe("geocoding and USSD", () => {
  it("geocodes a site through Nominatim with an identifying User-Agent, rejecting points outside Nigeria", async () => {
    Object.assign(process.env, { GEOCODER: "nominatim", NOMINATIM_EMAIL: "ops@example.com" });
    const u = await user();
    await saveBusiness(u, { name: "Ikeja Energy", roles: ["SELLER"], state: "Lagos" });
    const s = await createSite(u, { name: "Depot", kind: "DEPOT", gases: ["lpg_bulk"], state: "Lagos", town: "Ikeja" });
    expect(await db.job.count({ where: { type: "gas.geocode" } })).toBe(1);
    mockFetch(() => [{ lat: "6.6018", lon: "3.3515" }]);
    expect(await geocodeSite(s.id)).toEqual({ lat: 6.6018, lon: 3.3515 });
    expect(calls[0].url).toContain("countrycodes=ng");
    expect((calls[0].init.headers as Record<string, string>)["User-Agent"]).toContain("ops@example.com");
    mockFetch(() => [{ lat: "51.5", lon: "-0.1" }]);
    expect(await geocodeSite(s.id)).toBeNull();
  });

  it("answers a USSD price check from the menu, the item and the state", async () => {
    expect(matchState("abuja")).toBe("FCT Abuja");
    expect(matchState("akwa ibom")).toBe("Akwa Ibom");
    expect(matchState("xyz")).toBeNull();
    expect(await ussdReply("")).toMatch(/^CON RefineryLens prices/);
    expect(await ussdReply("1")).toMatch(/^CON Type your state/);
    expect(await ussdReply("1*Lagos")).toMatch(/^END Not enough sellers/);
    const sellers = await Promise.all(["A", "B", "C"].map(async (n) => { const s = await user(); await saveBusiness(s, { name: `${n} Gas`, roles: ["SELLER"], state: "Lagos" }); return s; }));
    for (const [i, s] of sellers.entries()) await reportPrices(s, { state: "Lagos", prices: { lpg_retail_kg: 1200 + i * 100 } });
    expect(await ussdReply("1*lagos")).toMatch(/^END LPG refill in Lagos: ₦1,300 per kg, median of 3 sellers/);
    expect(await ussdReply("9")).toMatch(/^END Choose a number/);
  });
});
