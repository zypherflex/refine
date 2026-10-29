import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { latestFx } from "@/server/fx";
import { buildIndexForDay } from "@/server/data/index-builder";
import { createKey, startTrial } from "@/server/data/accounts";
import { businessPlanPrice, startBusinessPlanCheckout } from "@/server/data/billing";
import { addOutlet, reportOutlet } from "@/server/everyday/outlets";
import { GET as prices } from "@/app/api/v1/prices/route";
import { seedFxDemo } from "../../prisma/seed-everyday";
import { resetDb, user } from "../helpers";

const saved = { ...process.env };
beforeEach(resetDb);
afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });

const req = (path: string, key: string) => new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${key}` } });

async function lagosPetrol() {
  const people = await Promise.all([1, 2, 3].map(() => user()));
  const o = await addOutlet(people[0], { name: "MRS Ojuelegba", kind: "FILLING_STATION", state: "Lagos", area: "Surulere" });
  for (const [i, p] of [1470, 1480, 1490].entries()) await reportOutlet(people[i], o.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: p });
}

describe("naira prices in US dollars", () => {
  it("ignores exchange rates from a source an editor has not approved", async () => {
    await seedFxDemo(db);
    await db.source.updateMany({ data: { approved: false } });
    expect(await latestFx()).toBeNull();
  });

  it("adds US dollar values to the API with currency=USD", async () => {
    await seedFxDemo(db);
    await lagosPetrol();
    await buildIndexForDay(new Date());
    const u = await user();
    await startTrial(u, { organisation: "Houston Fuels LLC", billingCountry: "US" });
    const key = await createKey(u, "model");

    const ngn = await (await prices(req("/api/v1/prices?item=pms_retail_litre", key))).json();
    expect(ngn.data[0]).not.toHaveProperty("usd");

    const res = await prices(req("/api/v1/prices?item=pms_retail_litre&currency=usd", key));
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = body.data[0];
    expect(row).toMatchObject({ currency: "NGN", median: 1480, usd: { demo: true } });
    expect(row.usd.median).toBeCloseTo(1480 / row.usd.ngnPerUsd, 3);
    expect(row.usd.rateDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await prices(req("/api/v1/prices?currency=EUR", key))).status).toBe(400);
  });
});

describe("the Business plan in two currencies", () => {
  it("prices Nigerian businesses in naira and international suppliers in US dollars", () => {
    expect(businessPlanPrice("Lagos").currency).toBe("NGN");
    expect(businessPlanPrice("United States")).toEqual({ currency: "USD", minor: 9900 });
    process.env.BUSINESS_PLAN_PRICE_USD = "149";
    expect(businessPlanPrice("Outside Africa")).toEqual({ currency: "USD", minor: 14900 });
    process.env.BUSINESS_PLAN_PRICE_USD = "nonsense";
    expect(businessPlanPrice("Ghana").minor).toBe(9900);
  });

  it("charges a verified US supplier in dollars through Stripe", async () => {
    Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_stripe", APP_URL: "https://app.example" });
    delete process.env.PAYSTACK_SECRET_KEY;
    let form = "";
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => { form = String(init.body); return new Response(JSON.stringify({ id: "cs_test_b", url: "https://checkout.stripe.com/c/pay/cs_test_b" })); });
    const u = await user();
    await expect(startBusinessPlanCheckout({ ...u, email: u.email })).rejects.toThrow(/profile/);
    const b = await db.hubBusiness.create({ data: { ownerId: u.id, name: "Gulf LPG Exports Inc", roles: ["SELLER"], state: "United States" } });
    await expect(startBusinessPlanCheckout({ ...u, email: u.email })).rejects.toThrow(/verified/);
    await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "VERIFIED" } });
    expect(await startBusinessPlanCheckout({ ...u, email: u.email })).toContain("checkout.stripe.com");
    const params = new URLSearchParams(form);
    expect(params.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(params.get("line_items[0][price_data][unit_amount]")).toBe("9900");
    expect(await db.payment.findFirstOrThrow()).toMatchObject({ purpose: "BUSINESS_PLAN", currency: "USD", amountKobo: 9900 });
  });
});
