import { afterEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { currencyFor, dataPlan, fmtMoney, planPrice } from "@/lib/data-plans";
import { validStripeSignature } from "@/server/connect/stripe";

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("data plan pricing", () => {
  it("bills Nigeria in naira and everyone else in dollars", () => {
    expect(currencyFor("NG")).toBe("NGN");
    expect(currencyFor("us")).toBe("USD");
    expect(currencyFor("GB")).toBe("USD");
  });
  it("prices a month and a year (ten months), and sells no trial or enterprise online", () => {
    const starter = dataPlan("starter")!;
    expect(planPrice(starter, "USD", "month")).toBe(4_900);
    expect(planPrice(starter, "USD", "year")).toBe(49_000);
    expect(planPrice(starter, "NGN", "month")).toBe(7_500_000);
    expect(planPrice(dataPlan("trial")!, "USD", "month")).toBeNull();
    expect(planPrice(dataPlan("enterprise")!, "USD", "month")).toBeNull();
  });
  it("takes prices from the environment", () => {
    process.env.DATA_PROFESSIONAL_USD = "349";
    expect(planPrice(dataPlan("professional")!, "USD", "month")).toBe(34_900);
  });
  it("formats both currencies", () => {
    expect(fmtMoney(4_900, "USD")).toBe("$49");
    expect(fmtMoney(4_950, "USD")).toBe("$49.50");
    expect(fmtMoney(7_500_000, "NGN")).toBe("₦75,000");
  });
});

describe("Stripe webhook signatures", () => {
  const sign = (body: string, t: number, secret = "whsec_test") => `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  it("accepts a fresh, correct signature and rejects wrong, old or missing ones", () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    const body = '{"type":"checkout.session.completed"}';
    const now = Date.now();
    const t = Math.floor(now / 1000);
    expect(validStripeSignature(body, sign(body, t), now)).toBe(true);
    expect(validStripeSignature(body + " ", sign(body, t), now)).toBe(false);
    expect(validStripeSignature(body, sign(body, t, "whsec_other"), now)).toBe(false);
    expect(validStripeSignature(body, sign(body, t - 600), now)).toBe(false);
    expect(validStripeSignature(body, null, now)).toBe(false);
  });
});
