/**
 * Adds clearly-demo work for the admin walkthrough (walkthrough/admin-record.cjs) to a freshly seeded database:
 * flags on a station report, a duplicate station, an outlier price, a stuck gas order, a silent driver trip, a failed
 * background job, and a few demo payments for the revenue chart. Run with: npx tsx walkthrough/admin-prepare.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const user = (email: string) => db.user.findUniqueOrThrow({ where: { email } });

async function main() {
  const [kemi, emeka, halima, joy, tunde, seller] = await Promise.all(["kemi", "emeka", "halima", "joy", "tunde", "seller"].map((n) => user(`${n}@refinerylens.test`)));

  // Two people flag a report at Ikorodu Road as made up.
  const report = await db.outletReport.findFirstOrThrow({ where: { note: { contains: "₦20 above the pump display" } } });
  await db.contentFlag.createMany({ data: [
    { reportId: report.id, userId: kemi.id, reason: "WRONG", note: "I was there the same day; the price matched the pump" },
    { reportId: report.id, userId: halima.id, reason: "WRONG", note: "" },
  ] });

  // A duplicate of Ojuelegba Service Station, with one report of its own.
  const dup = await db.outlet.create({ data: { name: "MRS Ojuelegba (demo duplicate)", brand: "MRS", kind: "FILLING_STATION", state: "Lagos", area: "Surulere", isDemo: true, addedById: joy.id } });
  await db.outletReport.create({ data: { outletId: dup.id, userId: joy.id, kind: "PRICE", item: "pms_retail_litre", priceNaira: 950, createdAt: new Date(Date.now() - 3 * HOUR) } });
  await db.contentFlag.create({ data: { outletId: dup.id, userId: emeka.id, reason: "DUPLICATE", note: "Same as Ojuelegba Service Station" } });

  // A petrol price far above everyone else's in Lagos, most likely a typing mistake.
  const lekki = await db.outlet.findFirstOrThrow({ where: { name: { startsWith: "Lekki Phase 1" } } });
  await db.outletReport.create({ data: { outletId: lekki.id, userId: joy.id, kind: "PRICE", item: "pms_retail_litre", priceNaira: 1500, createdAt: new Date(Date.now() - 2 * HOUR) } });

  // Kemi's 6 kg order has waited three hours without an answer from the seller.
  await db.gasOrder.updateMany({ where: { userId: kemi.id, status: "PLACED" }, data: { createdAt: new Date(Date.now() - 3 * HOUR) } });

  // The demo driver's phone went quiet 45 minutes ago.
  await db.driverTrip.updateMany({ where: { status: "LIVE" }, data: { lastAt: new Date(Date.now() - 45 * 60_000) } });

  // A background job that failed three times.
  await db.job.create({ data: { type: "extract_document", payload: { demo: true }, status: "FAILED", attempts: 3, error: "Demo failure: the PDF could not be read (timeout after 60 s)", finishedAt: new Date(Date.now() - 5 * HOUR) } });

  // Demo payments: Business plan renewals over recent months, one failed card payment this week.
  const ikeja = await db.hubBusiness.findFirstOrThrow({ where: { ownerId: seller.id } });
  const paid = [150, 120, 90, 60, 30, 3].map((d, i) => ({
    userId: seller.id, provider: "paystack", reference: `demo-${i}-${Date.now()}`, purpose: "BUSINESS_PLAN", businessId: ikeja.id, amountKobo: 1_500_000,
    status: "SUCCESS" as const, createdAt: new Date(Date.now() - d * DAY), paidAt: new Date(Date.now() - d * DAY),
  }));
  await db.payment.createMany({ data: [...paid, { userId: tunde.id, provider: "paystack", reference: `demo-failed-${Date.now()}`, purpose: "PLAN_PRO", amountKobo: 2_500_000, status: "FAILED", createdAt: new Date(Date.now() - 2 * DAY) }] });
  await db.hubBusiness.update({ where: { id: ikeja.id }, data: { planUntil: new Date(Date.now() + 9 * DAY) } });
  console.log("Admin walkthrough data ready.");
}

main().finally(() => db.$disconnect());
