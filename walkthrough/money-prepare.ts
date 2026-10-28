/**
 * Prepares a freshly seeded database for the "Nigerians everywhere" walkthrough (walkthrough/money-record.cjs): a
 * demo Nigerian living in London, and a few earlier gas orders paid online so the admin earnings have a history.
 * Run with: npx tsx walkthrough/money-prepare.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const DEMO_PASSWORD = "RefineryLens-demo-2026";

const db = new PrismaClient();
const DAY = 86_400_000;

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  await db.user.create({ data: { email: "chidi@refinerylens.test", name: "Chidi Okafor (demo)", passwordHash: hash, audience: "PERSONAL", homeState: "Lagos" } });
  const kemi = await db.user.findUniqueOrThrow({ where: { email: "kemi@refinerylens.test" } });
  const ikeja = await db.hubBusiness.findFirstOrThrow({ where: { owner: { email: "seller@refinerylens.test" } } });
  // Three earlier orders paid online: two already paid out to the seller, one still owed.
  for (const [i, d] of [20, 12, 3].entries()) {
    const at = new Date(Date.now() - d * DAY);
    const o = await db.gasOrder.create({
      data: {
        userId: kemi.id, businessId: ikeja.id, cylinderKg: 12.5, state: "Lagos", area: "Ikeja", address: "5 Demo Crescent, Ikeja (fictional)", phone: "+2348030000005",
        estimateNaira: 16_750, priceNaira: 16_750, status: "DELIVERED", createdAt: at, deliveredAt: new Date(at.getTime() + 3 * 3_600_000),
        paidOnlineAt: at, serviceFeeNaira: 503, commissionNaira: 419, payoutAt: i < 2 ? new Date(at.getTime() + DAY) : null, commissionSettledAt: i < 2 ? new Date(at.getTime() + DAY) : null,
      },
    });
    await db.payment.create({ data: { userId: kemi.id, provider: "paystack", reference: `demo-gas-${i}-${Date.now()}`, purpose: "GAS_ORDER", gasOrderId: o.id, amountKobo: 1_725_300, currency: "NGN", status: "SUCCESS", createdAt: at, paidAt: at } });
  }
  console.log("Walkthrough data ready: chidi@refinerylens.test");
}

main().finally(() => db.$disconnect());
