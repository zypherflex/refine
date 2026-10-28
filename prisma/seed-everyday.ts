import type { PrismaClient } from "@prisma/client";

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * Everyday demo data: stations and gas shops with prices and queues reported by fictional people, a household with a
 * cylinder on the tracker and gas orders, and two verified demo sellers delivering in Lagos. All figures are samples.
 */
export async function seedEveryday(
  db: PrismaClient,
  mk: (email: string, name: string) => Promise<{ id: string }>,
  sellers: { ikejaId: string; surulereId: string },
) {
  const tunde = await mk("tunde@refinerylens.test", "Tunde Household");
  const people = await Promise.all(["Kemi", "Emeka", "Halima", "Joy"].map((n) => mk(`${n.toLowerCase()}@refinerylens.test`, `${n} (demo)`)));
  await db.user.updateMany({ where: { id: { in: [tunde.id, ...people.map((p) => p.id)] } }, data: { audience: "PERSONAL", homeState: "Lagos" } });
  await db.user.update({ where: { id: tunde.id }, data: { phone: "+2348030000001" } });

  type Spot = [name: string, brand: string, kind: "FILLING_STATION" | "GAS_RETAILER" | "CNG_STATION", state: string, area: string, address: string];
  const spots: Spot[] = [
    ["Ojuelegba Service Station (demo)", "MRS", "FILLING_STATION", "Lagos", "Surulere", "Ojuelegba Rd, by the bridge"],
    ["Ikorodu Road Filling Station (demo)", "Conoil", "FILLING_STATION", "Lagos", "Fadeyi", "Ikorodu Rd, opposite the bus stop"],
    ["Lekki Phase 1 Fuel (demo)", "NNPC Retail", "FILLING_STATION", "Lagos", "Lekki", "Admiralty Way"],
    ["Mama Bisi Gas (demo)", "", "GAS_RETAILER", "Lagos", "Surulere", "Bode Thomas St"],
    ["Ikeja Gas Refill Plant (demo)", "", "GAS_RETAILER", "Lagos", "Ikeja", "Obafemi Awolowo Way"],
    ["Ikeja CNG Station (demo)", "", "CNG_STATION", "Lagos", "Ikeja", "Along Oba Akran Ave"],
    ["Wuse Zone 4 Station (demo)", "Total", "FILLING_STATION", "FCT Abuja", "Wuse", "Herbert Macaulay Way"],
    ["Kubwa Gas Plant (demo)", "", "GAS_RETAILER", "FCT Abuja", "Kubwa", "Gado Nasko Rd"],
    ["Idu CNG Station (demo)", "", "CNG_STATION", "FCT Abuja", "Idu", "Idu industrial area"],
    ["Zoo Road Filling Station (demo)", "", "FILLING_STATION", "Kano", "Tarauni", "Zoo Rd"],
    ["Rumuokoro Station (demo)", "Ardova", "FILLING_STATION", "Rivers", "Obio/Akpor", "Rumuokoro junction"],
  ];
  const outlets = await Promise.all(spots.map(([name, brand, kind, state, area, address], i) => db.outlet.create({ data: { name, brand, kind, state, area, address, isDemo: true, addedById: people[i % people.length].id } })));
  const by = (n: string) => outlets.find((o) => o.name.startsWith(n))!;

  // [outlet, item, prices by person (Kemi, Emeka, Halima, Joy)], hours ago staggered so the cards show different times.
  const prices: [string, string, number[]][] = [
    ["Ojuelegba", "pms_retail_litre", [945, 950, 955]],
    ["Ikorodu Road", "pms_retail_litre", [940, 948]],
    ["Lekki", "pms_retail_litre", [960, 965]],
    ["Ojuelegba", "ago_retail_litre", [1150, 1160, 1140]],
    ["Ikorodu Road", "dpk_retail_litre", [1400, 1420, 1380]],
    ["Mama Bisi", "lpg_retail_kg", [1300, 1320]],
    ["Ikeja Gas Refill", "lpg_retail_kg", [1260, 1280]],
    ["Mama Bisi", "lpg_cyl_12_5", [16000, 16500, 16200]],
    ["Ikeja CNG", "cng_scm", [230, 235, 230]],
    ["Wuse Zone 4", "pms_retail_litre", [930, 935, 940]],
    ["Kubwa Gas", "lpg_retail_kg", [1350, 1380, 1360]],
    ["Idu CNG", "cng_scm", [225, 230, 230]],
    ["Zoo Road", "pms_retail_litre", [960, 970, 965]],
    ["Rumuokoro", "pms_retail_litre", [955, 960, 965]],
  ];
  let h = 1;
  await db.outletReport.createMany({
    data: prices.flatMap(([n, item, ps]) => ps.map((priceNaira, i) => ({ outletId: by(n).id, userId: people[i].id, kind: "PRICE" as const, item, priceNaira, createdAt: new Date(Date.now() - (h++ % 40) * HOUR) }))),
  });
  await db.outletReport.createMany({
    data: [
      { outletId: by("Ojuelegba").id, userId: people[0].id, kind: "AVAILABILITY", item: "pms_retail_litre", available: true, queue: "SHORT", createdAt: new Date(Date.now() - 2 * HOUR) },
      { outletId: by("Lekki").id, userId: people[1].id, kind: "AVAILABILITY", item: "pms_retail_litre", available: false, note: "Pumps off, waiting for a truck", createdAt: new Date(Date.now() - 3 * HOUR) },
      { outletId: by("Ikeja CNG").id, userId: people[2].id, kind: "AVAILABILITY", item: "cng_scm", available: true, queue: "LONG", note: "About 30 minutes", createdAt: new Date(Date.now() - 1 * HOUR) },
      { outletId: by("Ikorodu Road").id, userId: people[3].id, kind: "PROBLEM", problem: "SHORT_MEASURE", note: "Demo report: paid for 20 litres, jerrycan held about 18", createdAt: new Date(Date.now() - 5 * DAY) },
      { outletId: by("Ikorodu Road").id, userId: people[1].id, kind: "PROBLEM", problem: "OVERCHARGED", note: "Demo report: ₦20 above the pump display", createdAt: new Date(Date.now() - 9 * DAY) },
    ],
  });

  // Two verified demo sellers deliver refills in Lagos.
  await db.hubBusiness.update({ where: { id: sellers.ikejaId }, data: { homeDelivery: true, deliveryStates: ["Lagos", "Ogun"], homePricePerKg: 1300, deliveryFeeNaira: 500 } });
  await db.hubBusiness.update({ where: { id: sellers.surulereId }, data: { verification: "VERIFIED", verifiedAt: new Date(Date.now() - 15 * DAY), homeDelivery: true, deliveryStates: ["Lagos"], homePricePerKg: 1320, deliveryFeeNaira: null } });

  // Tunde's kitchen cylinder lasts about 4 weeks and is due a refill in 3 days.
  await db.gasCylinder.create({ data: { userId: tunde.id, label: "Kitchen", sizeKg: 12.5, usualDays: 30, refills: { create: [{ filledAt: new Date(Date.now() - 81 * DAY), priceNaira: 15_500 }, { filledAt: new Date(Date.now() - 53 * DAY), priceNaira: 16_000 }, { filledAt: new Date(Date.now() - 25 * DAY), priceNaira: 16_750 }] } } });
  const address = { state: "Lagos", area: "Surulere", address: "14 Demo Close, off Bode Thomas St (fictional)", phone: "+2348030000001" };
  await db.gasOrder.create({ data: { ...address, userId: tunde.id, businessId: sellers.ikejaId, cylinderKg: 12.5, estimateNaira: 16_750, priceNaira: 16_750, status: "DELIVERED", rating: 5, createdAt: new Date(Date.now() - 25 * DAY), deliveredAt: new Date(Date.now() - 25 * DAY + 3 * HOUR) } });
  await db.gasOrder.create({ data: { ...address, userId: people[0].id, businessId: sellers.ikejaId, cylinderKg: 6, area: "Yaba", address: "3 Demo Street, Yaba (fictional)", phone: "+2348030000002", estimateNaira: 8_300, status: "PLACED", createdAt: new Date(Date.now() - 40 * 60_000) } });
  // An order on its way, with the driver sharing their location from Ikeja towards Surulere (demo positions).
  const onWay = await db.gasOrder.create({ data: { ...address, userId: tunde.id, businessId: sellers.ikejaId, cylinderKg: 6, estimateNaira: 8_300, priceNaira: 8_300, status: "OUT_FOR_DELIVERY", note: "Second cylinder for the shop (demo)", createdAt: new Date(Date.now() - 50 * 60_000) } });
  const route = Array.from({ length: 12 }, (_, i) => ({ lat: 6.6018 - i * 0.0062 + Math.sin(i) * 0.0008, lon: 3.3515 + i * 0.0004 + Math.cos(i) * 0.0006 }));
  const last = route.at(-1)!;
  await db.driverTrip.create({
    data: {
      gasOrderId: onWay.id, businessId: sellers.ikejaId, driverName: "Musa (demo)", driverPhone: "+2348030000009", tokenHash: `demo-${onWay.id}`, status: "LIVE",
      startedAt: new Date(Date.now() - 12 * 60_000), lastLat: last.lat, lastLon: last.lon, lastAccuracy: 12, lastSpeed: 6, lastAt: new Date(),
      destLat: 6.4969, destLon: 3.3581, destLabel: "Surulere, Lagos (area, approximate)",
      pings: { create: route.map((p, i) => ({ ...p, accuracy: 12, speed: 6, recordedAt: new Date(Date.now() - (11 - i) * 60_000) })) },
    },
  });
  await db.gasOrder.create({ data: { ...address, userId: people[1].id, businessId: sellers.surulereId, cylinderKg: 12.5, estimateNaira: 16_500, priceNaira: 16_500, status: "DELIVERED", rating: 4, createdAt: new Date(Date.now() - 6 * DAY), deliveredAt: new Date(Date.now() - 6 * DAY + 2 * HOUR) } });
}

/** Demo for the dollar revenue lines: the daily index built from the demo reports, one demo data customer and one demo sponsor. */
export async function seedRevenueDemo(db: PrismaClient, mk: (email: string, name: string) => Promise<{ id: string }>) {
  const { backfillIndex } = await import("../src/server/data/index-builder");
  await backfillIndex(14);
  const analyst = await mk("data@refinerylens.test", "Dana Data (demo)");
  await db.dataAccount.create({ data: { userId: analyst.id, organisation: "Demo Commodities Ltd (demo)", billingCountry: "GB", plan: "professional", paidUntil: new Date(Date.now() + 20 * DAY) } });
  await db.sponsorship.create({
    data: {
      sponsor: "Demo CNG Conversions (demo)", headline: "Convert your car or keke to CNG", body: "Certified dual-fuel conversions with a 12-month warranty. Sample sponsor for this demo installation.",
      url: "https://example.com/cng", placements: ["cng-savings", "stations"], priceUsd: 1500, startsAt: new Date(Date.now() - 5 * DAY), endsAt: new Date(Date.now() + 25 * DAY),
    },
  });
}
