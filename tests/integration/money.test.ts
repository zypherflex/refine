import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { advanceOrder, cancelOrder, placeOrder, saveHomeDelivery } from "@/server/everyday/orders";
import { markPaidOut, orderPaymentQuote, payoutsDue, sellerLedger, startOrderPayment, startSellerFeesPayment } from "@/server/everyday/money";
import { verifyAndSettle } from "@/server/connect/paystack";
import { verifyStripeReturn } from "@/server/connect/stripe";
import { gasEarnings } from "@/server/admin/money";
import { saveBusiness } from "@/server/hub/business";
import { seedFxDemo } from "../../prisma/seed-everyday";
import { resetDb, user } from "../helpers";

const saved = { ...process.env };
beforeEach(resetDb);
afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals(); });

async function seller() {
  const owner = await user();
  const b = await saveBusiness(owner, { name: "Surulere Gas Point", roles: ["SELLER"], state: "Lagos" });
  await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "VERIFIED" } });
  await saveHomeDelivery(owner, { homeDelivery: true, deliveryStates: ["Lagos"], homePricePerKg: 1200, deliveryFeeNaira: 500 });
  return { owner, b };
}

const forMum = (businessId: string) => ({ businessId, cylinderKg: 12.5, cylinders: 1, state: "Lagos", area: "Surulere", address: "12 Adeniran Ogunsanya St, by the mall", phone: "0803 123 4567", recipientName: "Mama Ngozi" });

/** Paystack: initialize returns a checkout URL; verify returns whatever `paid` holds. */
function paystack(paid: { amount: number; currency: string }) {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/transaction/initialize")) {
      bodies.push(JSON.parse(String(init!.body)));
      return new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/x" } }));
    }
    return new Response(JSON.stringify({ status: true, data: { status: "success", ...paid, reference: url.split("/").pop() } }));
  });
  return bodies;
}

describe("sending gas home and paying online", () => {
  beforeEach(() => Object.assign(process.env, { PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: "sk_test", APP_URL: "https://app.example" }));

  it("takes a naira payment with a service fee, tells the seller, and keeps commission from the payout", async () => {
    const { owner, b } = await seller();
    const abroad = await user();
    const o = await placeOrder(abroad, forMum(b.id));
    expect(o.recipientName).toBe("Mama Ngozi");
    await expect(startOrderPayment({ ...abroad, email: abroad.email }, o.id, "NGN")).rejects.toThrow(/once the seller has accepted/);
    await advanceOrder(owner, o.id, "accept", { priceNaira: 15_500 });
    await expect(startOrderPayment({ ...owner, email: owner.email }, o.id, "NGN")).rejects.toThrow(/not found/);

    const bodies = paystack({ amount: 1_596_500, currency: "NGN" });
    expect(await startOrderPayment({ ...abroad, email: abroad.email }, o.id, "NGN")).toContain("paystack");
    expect(bodies[0]).toMatchObject({ amount: 1_596_500, currency: "NGN" });
    const pay = await db.payment.findFirstOrThrow({ where: { purpose: "GAS_ORDER" } });
    expect(pay.gasOrderId).toBe(o.id);
    expect(await verifyAndSettle(pay.reference)).toMatchObject({ ok: true });

    const paid = await db.gasOrder.findUniqueOrThrow({ where: { id: o.id } });
    expect(paid.paidOnlineAt).not.toBeNull();
    expect(paid.serviceFeeNaira).toBe(465);
    expect(await db.alert.count({ where: { userId: owner.id, title: { contains: "do not collect cash" } } })).toBe(1);
    await expect(cancelOrder(abroad, o.id)).rejects.toThrow(/refund/);
    await expect(startOrderPayment({ ...abroad, email: abroad.email }, o.id, "NGN")).rejects.toThrow(/already paid/);

    await advanceOrder(owner, o.id, "deliver");
    expect((await db.gasOrder.findUniqueOrThrow({ where: { id: o.id } })).commissionNaira).toBe(388);
    const ledger = await sellerLedger(owner);
    expect(ledger).toMatchObject({ owedNaira: 0, payoutNaira: 15_112 });
    const admin = await user("ADMIN");
    expect((await payoutsDue()).map((p) => p.payoutNaira)).toEqual([15_112]);
    await expect(markPaidOut(owner, o.id)).rejects.toThrow();
    await markPaidOut(admin, o.id);
    expect(await payoutsDue()).toHaveLength(0);
    expect(await gasEarnings(admin)).toMatchObject({ serviceFees: 465, commission: 388, commissionOwed: 0 });
  });

  it("charges someone abroad in US dollars at the day's rate through Stripe", async () => {
    Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_stripe" });
    await seedFxDemo(db);
    const { owner, b } = await seller();
    const abroad = await user();
    const o = await placeOrder(abroad, forMum(b.id));
    await advanceOrder(owner, o.id, "accept", { priceNaira: 15_500 });
    const quote = (await orderPaymentQuote(await db.gasOrder.findUniqueOrThrow({ where: { id: o.id } })))!;
    expect(quote.usd!.cents).toBe(Math.ceil((15_965 / quote.usd!.rate) * 100));

    let form = "";
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      if (init?.method === "POST") { form = String(init.body); return new Response(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" })); }
      const ref = new URLSearchParams(form).get("client_reference_id");
      return new Response(JSON.stringify({ id: "cs_test_1", client_reference_id: ref, payment_status: "paid", amount_total: quote.usd!.cents, currency: "usd", status: "complete" }));
    });
    expect(await startOrderPayment({ ...abroad, email: abroad.email }, o.id, "USD")).toContain("checkout.stripe.com");
    const params = new URLSearchParams(form);
    expect(params.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(params.get("line_items[0][product_data][name]") ?? params.get("line_items[0][price_data][product_data][name]")).toContain("Mama Ngozi");
    expect(params.get("cancel_url")).toBe(`https://app.example/orders/${o.id}?payment=cancelled`);
    expect(await verifyStripeReturn(params.get("client_reference_id")!, "cs_test_1")).toMatchObject({ ok: true });
    expect((await db.gasOrder.findUniqueOrThrow({ where: { id: o.id } })).paidOnlineAt).not.toBeNull();
  });

  it("waives the service fee for Plus members", async () => {
    const { owner, b } = await seller();
    const plus = await db.user.update({ where: { id: (await user()).id }, data: { plan: "PRO", planUntil: new Date(Date.now() + 86_400_000) } });
    const o = await placeOrder(plus, forMum(b.id));
    await advanceOrder(owner, o.id, "accept", { priceNaira: 15_500 });
    expect(await orderPaymentQuote(await db.gasOrder.findUniqueOrThrow({ where: { id: o.id } }))).toMatchObject({ feeNaira: 0, totalNaira: 15_500 });
  });
});

describe("seller commission on cash orders", () => {
  it("adds up what the seller owes and settles it once they pay", async () => {
    Object.assign(process.env, { PAYMENT_PROVIDER: "paystack", PAYSTACK_SECRET_KEY: "sk_test" });
    const { owner, b } = await seller();
    const buyer = await user();
    for (const price of [15_500, 16_000]) {
      const o = await placeOrder(buyer, { ...forMum(b.id), recipientName: "" });
      await advanceOrder(owner, o.id, "accept", { priceNaira: price });
      await advanceOrder(owner, o.id, "deliver");
    }
    expect((await sellerLedger(owner)).owedNaira).toBe(388 + 400);
    // On the Business plan the next order is charged at the lower rate.
    await db.hubBusiness.update({ where: { id: b.id }, data: { planUntil: new Date(Date.now() + 86_400_000) } });
    const third = await placeOrder(buyer, { ...forMum(b.id), recipientName: "" });
    await advanceOrder(owner, third.id, "accept", { priceNaira: 10_000 });
    await advanceOrder(owner, third.id, "deliver");
    expect((await db.gasOrder.findUniqueOrThrow({ where: { id: third.id } })).commissionNaira).toBe(150);

    const bodies = paystack({ amount: 93_800, currency: "NGN" });
    await startSellerFeesPayment({ ...owner, email: owner.email });
    expect(bodies[0]).toMatchObject({ amount: 93_800, currency: "NGN" });
    const pay = await db.payment.findFirstOrThrow({ where: { purpose: "SELLER_FEES" } });
    expect(pay.businessId).toBe(b.id);
    expect(await verifyAndSettle(pay.reference)).toMatchObject({ ok: true });
    expect((await sellerLedger(owner)).owedNaira).toBe(0);
    await expect(startSellerFeesPayment({ ...owner, email: owner.email })).rejects.toThrow(/owe nothing/);
  });
});
