/**
 * Adds clearly-demo dollar payments for the US dollar walkthrough (walkthrough/usd-record.cjs) to a freshly seeded
 * database, so the revenue charts have a history to show. Run with: npx tsx walkthrough/usd-prepare.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DAY = 86_400_000;

async function main() {
  const data = await db.user.findUniqueOrThrow({ where: { email: "data@refinerylens.test" } });
  const account = await db.dataAccount.findUniqueOrThrow({ where: { userId: data.id } });
  // Demo Commodities (demo) has paid for Professional monthly, in US dollars through Stripe, since the spring.
  const months = [180, 150, 120, 90, 60, 30, 2];
  await db.payment.createMany({
    data: months.map((d, i) => ({
      userId: data.id, provider: "stripe", reference: `demo-usd-${i}-${Date.now()}`, purpose: "DATA_PLAN", dataAccountId: account.id, planId: "professional", periodDays: 30,
      amountKobo: 29_900, currency: "USD", status: "SUCCESS" as const, createdAt: new Date(Date.now() - d * DAY), paidAt: new Date(Date.now() - d * DAY),
    })),
  });
  console.log("Dollar walkthrough data ready.");
}

main().finally(() => db.$disconnect());
