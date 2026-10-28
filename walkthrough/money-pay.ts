/**
 * Stands in for the card payment in the walkthrough: records a Stripe payment for an order's dollar total and settles
 * it through the same code that runs when Stripe confirms a real payment. Never used outside the demo.
 * Usage: npx tsx walkthrough/money-pay.ts <orderId>
 */
import crypto from "node:crypto";
import { db } from "../src/lib/db";
import { orderPaymentQuote } from "../src/server/everyday/money";
import { settle } from "../src/server/connect/settle";

async function main() {
  const o = await db.gasOrder.findUniqueOrThrow({ where: { id: process.argv[2] } });
  const q = await orderPaymentQuote(o);
  if (!q?.usd) throw new Error("No dollar quote for this order.");
  const reference = `rl_${crypto.randomBytes(12).toString("hex")}`;
  await db.payment.create({ data: { userId: o.userId, provider: "stripe", reference, purpose: "GAS_ORDER", gasOrderId: o.id, amountKobo: q.usd.cents, currency: "USD" } });
  console.log(JSON.stringify(await settle(reference, { status: "success", amount: q.usd.cents, currency: "usd" })));
}

main().finally(() => db.$disconnect());
