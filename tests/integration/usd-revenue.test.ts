import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildIndexForDay } from "@/server/data/index-builder";
import { authenticateKey, createKey, exportIndexCsv, revokeKey, sendDataRenewalReminders, startTrial } from "@/server/data/accounts";
import { startDataCheckout } from "@/server/data/billing";
import { handleStripeEvent } from "@/server/connect/stripe";
import { listDataAccounts } from "@/server/admin/data";
import { clickThrough, createSponsorship, sponsorFor } from "@/server/sponsor";
import { GET as latest } from "@/app/api/v1/latest/route";
import { GET as prices } from "@/app/api/v1/prices/route";
import { POST as stripeWebhook } from "@/app/api/payments/stripe/webhook/route";
import { addOutlet, reportOutlet } from "@/server/everyday/outlets";
import { resetDb, user } from "../helpers";

const saved = { ...process.env };
beforeEach(resetDb);
afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });

const req = (path: string, key?: string) => new NextRequest(`http://localhost${path}`, { headers: key ? { authorization: `Bearer ${key}` } : {} });

async function lagosPetrol(prices: number[]) {
  const people = await Promise.all(prices.map(() => user()));
  const o = await addOutlet(people[0], { name: "MRS Ojuelegba", kind: "FILLING_STATION", state: "Lagos", area: "Surulere" });
  for (const [i, p] of prices.entries()) await reportOutlet(people[i], o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: p });
  return o;
}

describe("daily price index", () => {
  it("writes a state median only with three reporters, and never flags real data as demo", async () => {
    await lagosPetrol([940, 950]);
    expect(await buildIndexForDay(new Date())).toBe(0);
    const third = await user();
    const o = await db.outlet.findFirstOrThrow();
    await reportOutlet(third, o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 960 });
    expect(await buildIndexForDay(new Date())).toBe(1);
    expect(await db.priceIndexDaily.findFirstOrThrow()).toMatchObject({ state: "Lagos", item: "pms_retail_litre", source: "PUBLIC", median: 950, low: 940, high: 960, reporters: 3, includesDemo: false });
    // Hiding a report and rebuilding drops the day below the threshold.
    await db.outletReport.updateMany({ where: { priceNaira: 960 }, data: { hidden: true } });
    expect(await buildIndexForDay(new Date())).toBe(0);
  });
});

describe("data accounts and the API", () => {
  it("trial key reads the index; revoked, expired and over-limit keys are refused", async () => {
    await lagosPetrol([940, 950, 960]);
    await buildIndexForDay(new Date());
    const u = await user();
    await startTrial(u, { organisation: "Atlantic Commodities", billingCountry: "GB" });
    await expect(startTrial(u, { organisation: "Again", billingCountry: "GB" })).rejects.toThrow(/already/);
    const key = await createKey(u, "model");
    await expect(createKey(u, "second")).rejects.toThrow(/allows 1 active key/);

    expect((await latest(req("/api/v1/latest"))).status).toBe(401);
    const res = await latest(req("/api/v1/latest?item=pms_retail_litre", key));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-ratelimit-limit")).toBe("200");
    const body = await res.json();
    expect(body.data).toEqual([expect.objectContaining({ state: "Lagos", median: 950, reporters: 3, currency: "NGN" })]);
    expect(body.data[0]).not.toHaveProperty("demo");
    expect((await prices(req("/api/v1/prices?item=not_a_thing", key))).status).toBe(400);
    expect((await prices(req("/api/v1/prices?from=2026-1-1", key))).status).toBe(400);

    const csv = await exportIndexCsv(u);
    expect(csv.split("\r\n")[0]).toBe("date,state,item,source,currency,median,low,high,reporters,demo");
    expect(csv).toContain(",Lagos,pms_retail_litre,PUBLIC,NGN,950,940,960,3,false");
    const acct = await db.dataAccount.findFirstOrThrow();
    await db.apiUsage.updateMany({ data: { requests: 200 } });
    expect((await latest(req("/api/v1/latest", key))).status).toBe(429);
    await db.dataAccount.update({ where: { id: acct.id }, data: { paidUntil: new Date(Date.now() - 1000) } });
    expect(await authenticateKey(`Bearer ${key}`)).toMatchObject({ ok: false, status: 402 });
    await expect(exportIndexCsv(u)).rejects.toThrow(/ended/);
    const k = await db.apiKey.findFirstOrThrow();
    await revokeKey(u, k.id);
    expect(await authenticateKey(`Bearer ${key}`)).toMatchObject({ ok: false, status: 401 });
  });

  it("reminds a customer before access ends, once", async () => {
    const u = await user();
    const a = await startTrial(u, { organisation: "Kano Research", billingCountry: "NG" });
    await db.dataAccount.update({ where: { id: a.id }, data: { paidUntil: new Date(Date.now() + 2 * 86_400_000) } });
    await sendDataRenewalReminders();
    await sendDataRenewalReminders();
    expect(await db.alert.count({ where: { userId: u.id, kind: "DATA_PLAN" } })).toBe(1);
  });
});

describe("paying in dollars and naira", () => {
  it("charges Nigerian customers in naira through Paystack", async () => {
    Object.assign(process.env, { PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: "sk_test", APP_URL: "https://app.example" });
    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => { bodies.push(String(init.body)); return new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/x" } })); });
    const u = await user();
    await startTrial(u, { organisation: "Lagos Analytics", billingCountry: "NG" });
    expect(await startDataCheckout({ ...u, email: u.email }, "starter", "month")).toBe("https://checkout.paystack.com/x");
    expect(JSON.parse(bodies[0])).toMatchObject({ amount: 7_500_000, currency: "NGN" });
  });

  it("refuses dollars until a provider is set up, then settles a signed Stripe payment and applies the plan", async () => {
    const u = await user();
    await startTrial(u, { organisation: "Geneva Trading SA", billingCountry: "CH" });
    await expect(startDataCheckout({ ...u, email: u.email }, "professional", "year")).rejects.toThrow(/not set up/);

    Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_stripe", STRIPE_WEBHOOK_SECRET: "whsec_t", APP_URL: "https://app.example" });
    let form = "";
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => { form = String(init.body); return new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" })); });
    expect(await startDataCheckout({ ...u, email: u.email }, "professional", "year")).toContain("checkout.stripe.com");
    const params = new URLSearchParams(form);
    expect(params.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(params.get("line_items[0][price_data][unit_amount]")).toBe("299000");
    const reference = params.get("client_reference_id")!;

    // A forged or tampered event changes nothing.
    expect(await handleStripeEvent({ type: "checkout.session.completed", data: { object: { id: "cs_test_1", client_reference_id: reference, payment_status: "paid", amount_total: 100, currency: "usd", status: "complete" } } })).toMatchObject({ ok: false });
    const raw = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test_1", client_reference_id: reference, payment_status: "paid", amount_total: 299000, currency: "usd", status: "complete" } } });
    const bad = await stripeWebhook(new NextRequest("http://localhost/api/payments/stripe/webhook", { method: "POST", body: raw, headers: { "stripe-signature": "t=1,v1=00" } }));
    expect(bad.status).toBe(400);
    const t = Math.floor(Date.now() / 1000);
    const sig = `t=${t},v1=${crypto.createHmac("sha256", "whsec_t").update(`${t}.${raw}`).digest("hex")}`;
    const ok = await stripeWebhook(new NextRequest("http://localhost/api/payments/stripe/webhook", { method: "POST", body: raw, headers: { "stripe-signature": sig } }));
    expect(ok.status).toBe(200);

    const a = await db.dataAccount.findFirstOrThrow();
    expect(a.plan).toBe("professional");
    expect(a.paidUntil.getTime()).toBeGreaterThan(Date.now() + 360 * 86_400_000);
    expect(await db.payment.findFirstOrThrow()).toMatchObject({ provider: "stripe", currency: "USD", amountKobo: 299000, status: "SUCCESS" });
    const admin = await user("ADMIN");
    expect((await listDataAccounts(admin)).mrr).toEqual({ USD: 299, NGN: 0 });
  });
});

describe("sponsored placements", () => {
  it("shows one running sponsor for the placement and state, rotating by exposure, and counts clicks", async () => {
    const admin = await user("ADMIN");
    const day = 86_400_000;
    const base = { body: "Certified dual-fuel conversions with warranty.", url: "https://example.com/cng", priceUsd: 1500, startsAt: new Date(Date.now() - day), endsAt: new Date(Date.now() + 30 * day) };
    await expect(createSponsorship(admin, { ...base, sponsor: "X", headline: "Too early end", placements: ["cng-savings"], endsAt: new Date(Date.now() - 2 * day) })).rejects.toThrow(/end date/);
    await expect(createSponsorship(admin, { ...base, sponsor: "X", headline: "Plain http", placements: ["cng-savings"], url: "http://example.com" })).rejects.toThrow(/https/);
    const a = await createSponsorship(admin, { ...base, sponsor: "Lagos Kits", headline: "Convert in Lagos", placements: ["cng-savings"], states: ["Lagos"] });
    const b = await createSponsorship(admin, { ...base, sponsor: "Naija Kits", headline: "Convert anywhere", placements: ["cng-savings"] });
    // Lagos sees both in turn; Kano only the sponsor aimed at every state.
    expect([(await sponsorFor("cng-savings", "Lagos"))!.id, (await sponsorFor("cng-savings", "Lagos"))!.id]).toEqual([a.id, b.id]);
    expect((await sponsorFor("cng-savings", "Kano"))!.id).toBe(b.id);
    expect(await sponsorFor("hub")).toBeNull();
    expect(await clickThrough(a.id)).toBe("https://example.com/cng?utm_source=refinerylens&utm_medium=sponsored");
    expect((await db.sponsorship.findUniqueOrThrow({ where: { id: a.id } })).clicks).toBe(1);
    await expect(createSponsorship(await user(), { ...base, sponsor: "Y", headline: "Not an admin", placements: ["hub"] })).rejects.toThrow(/permission/);
  });
});
