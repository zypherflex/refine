import type { PrismaClient } from "@prisma/client";

/**
 * Fictional trade hub businesses for the demo. Every one is flagged isDemo and named "(demo)" so nobody mistakes it
 * for a real trading partner; prices are labelled as demo figures.
 */

const DAY = 86_400_000;
const until = (days: number) => new Date(Date.now() + days * DAY);

export async function seedHub(db: PrismaClient, mk: (email: string, name: string) => Promise<{ id: string }>, adminId: string) {
  const [seller, buyer, haulier, refinery, converter, cngUser] = await Promise.all([
    mk("seller@refinerylens.test", "Sade Seller"),
    mk("buyer@refinerylens.test", "Bello Buyer"),
    mk("haulier@refinerylens.test", "Haruna Haulier"),
    mk("refinery@refinerylens.test", "Rita Refinery"),
    mk("converter@refinerylens.test", "Chidi Converter"),
    mk("cng@refinerylens.test", "Chioma CNG"),
  ]);
  const verified = { verification: "VERIFIED" as const, verifiedAt: new Date(Date.now() - 20 * DAY), verifiedById: adminId };

  const ikeja = await db.hubBusiness.create({
    data: {
      ownerId: seller.id, isDemo: true, ...verified,
      name: "Ikeja Energy Supplies (demo)", roles: ["SELLER"], state: "Lagos", city: "Ikeja",
      about: "Fictional depot-backed marketer supplying diesel, petrol and LPG to stations, factories and fleets in the South-West.",
      registrationNumber: "RC 0000001 (demo)", licences: "Depot and bulk storage licence; LPG bulk distribution (demo entries)",
    },
  });
  const kano = await db.hubBusiness.create({
    data: {
      ownerId: buyer.id, isDemo: true, verification: "PENDING_REVIEW",
      name: "Kano Gas Kiosks (demo)", roles: ["BUYER", "SELLER"], state: "Kano", city: "Kano",
      about: "Fictional chain of six LPG refill kiosks looking for steady bulk supply.",
      registrationNumber: "RC 0000002 (demo)", licences: "LPG retail outlet permits for six sites (demo entries)",
    },
  });
  const corridor = await db.hubBusiness.create({
    data: {
      ownerId: haulier.id, isDemo: true, ...verified,
      name: "Northern Corridor Haulage (demo)", roles: ["DELIVERY"], state: "Kaduna", city: "Kaduna",
      about: "Fictional fleet of twelve 33,000-litre tankers and three LPG bullet trucks running Lagos to the North.",
      registrationNumber: "RC 0000003 (demo)", licences: "Petroleum products haulage permits (demo entries)",
    },
  });
  const lagoon = await db.hubBusiness.create({
    data: {
      ownerId: refinery.id, isDemo: true, ...verified,
      name: "Lagoon Coast Refining Co. (fictional demo)", roles: ["REFINERY", "SELLER", "BUYER"], state: "Rivers", city: "Onne",
      about: "The fictional refinery from RefineryLens's demo research pages. Sells diesel and polypropylene and buys crude and condensate.",
      registrationNumber: "RC 0000004 (demo)", licences: "Refinery operating licence (demo entry)", capacityBpd: 120_000,
      // On the demo Business plan, so its listings show as Featured.
      planUntil: until(20),
    },
  });
  const ogun = await db.hubBusiness.create({
    data: {
      ownerId: converter.id, isDemo: true,
      name: "Ogun Resin Converters (demo)", roles: ["BUYER"], state: "Ogun", city: "Sagamu",
      about: "Fictional maker of woven sacks and household plastics, switching from imported to local polypropylene.",
    },
  });

  const l = (businessId: string, data: Omit<Parameters<typeof db.hubListing.create>[0]["data"], "businessId" | "business">) => db.hubListing.create({ data: { ...data, businessId } as never });
  const lpgOffer = await l(ikeja.id, {
    kind: "OFFER", title: "LPG in 20-tonne lots, ex-Ikeja", products: ["lpg"], quantity: 20, unit: "tonnes", priceNote: "Demo price: NGN 1,050 per kg ex-depot",
    state: "Lagos", areas: ["Lagos", "Ogun", "Oyo", "Kano", "Kaduna"], details: "Fictional demo listing. Weekly lifting slots; buyer arranges bullet truck or we introduce a haulier.", expiresAt: until(25),
  });
  await l(ikeja.id, {
    kind: "OFFER", title: "Diesel (AGO) for factories and fleets", products: ["ago"], quantity: 66_000, unit: "litres", priceNote: "Demo price: NGN 1,120 per litre delivered in Lagos",
    state: "Lagos", areas: ["Lagos", "Ogun", "Oyo"], details: "Fictional demo listing. Minimum order 10,000 litres.", expiresAt: until(28),
  });
  await l(lagoon.id, {
    kind: "OFFER", title: "Polypropylene resin, injection and raffia grades", products: ["pp"], quantity: 500, unit: "tonnes", priceNote: "Demo terms: quoted monthly",
    state: "Rivers", areas: ["Rivers", "Lagos", "Ogun", "Kano", "Ghana"], details: "Fictional demo listing. Bagged in 25 kg sacks; certificates of analysis on request.", expiresAt: until(60),
  });
  await l(lagoon.id, {
    kind: "REQUEST", title: "Crude and condensate cargoes for Q1 2027", products: ["crude", "condensate"], quantity: 950_000, unit: "barrels", priceNote: "Demo terms: Brent-linked",
    state: "Rivers", areas: [], details: "Fictional demo listing. Light sweet grades preferred.", expiresAt: until(80),
  });
  await l(corridor.id, {
    kind: "DELIVERY", title: "Tankers Lagos to Kaduna, Kano and Abuja", products: ["pms", "ago", "dpk"], quantity: 33_000, unit: "litres per trip", priceNote: "Demo rate: NGN 2.1 million per trip Lagos–Kano",
    state: "Kaduna", areas: ["Lagos", "Ogun", "Kaduna", "Kano", "Katsina", "FCT Abuja"], details: "Fictional demo listing. Tracked trucks, sealed compartments.", expiresAt: until(20),
  });
  await l(corridor.id, {
    kind: "DELIVERY", title: "LPG bullet trucks, South-West to the North", products: ["lpg"], quantity: 20, unit: "tonnes per trip", priceNote: "Demo rate on request",
    state: "Kaduna", areas: ["Lagos", "Oyo", "Kaduna", "Kano"], expiresAt: until(20),
  });
  await l(kano.id, {
    kind: "REQUEST", title: "Weekly 20 tonnes LPG delivered to Kano", products: ["lpg"], quantity: 20, unit: "tonnes", priceNote: "Target: under NGN 1,150 per kg delivered",
    state: "Kano", areas: ["Lagos", "Kaduna", "Rivers"], details: "Fictional demo listing. Six refill kiosks; can receive at our Kano skid plant.", expiresAt: until(27),
  });
  await l(ogun.id, {
    kind: "REQUEST", title: "40 tonnes polypropylene raffia grade each month", products: ["pp"], quantity: 40, unit: "tonnes", priceNote: "",
    state: "Ogun", areas: ["Lagos", "Rivers"], details: "Fictional demo listing. Replacing imported resin; need certificates of analysis.", expiresAt: until(29),
  });

  const abujaCng = await db.hubBusiness.create({
    data: {
      ownerId: cngUser.id, isDemo: true, ...verified,
      name: "Abuja CNG Mobility (demo)", roles: ["SELLER"], state: "FCT Abuja", city: "Kubwa",
      about: "Fictional operator of CNG refuelling stations for buses, taxis and tricycles, supplied by its own compression site.",
      registrationNumber: "RC 0000006 (demo)", licences: "CNG refuelling station permits (demo entries)",
    },
  });
  await l(kano.id, {
    kind: "REQUEST", title: "LPG for three new kiosks in Bauchi", products: ["lpg"], quantity: 8, unit: "tonnes", priceNote: "",
    state: "Bauchi", areas: ["Kano", "Kaduna", "Plateau"], details: "Fictional demo listing. Opening in December; looking for a supplier and a haulier.", expiresAt: until(30),
  });
  await l(ogun.id, {
    kind: "REQUEST", title: "CNG for factory boilers in Sagamu", products: ["cng"], quantity: 15_000, unit: "standard cubic metres", priceNote: "",
    state: "Ogun", areas: ["Lagos"], details: "Fictional demo listing. Switching two boilers from diesel; need a virtual-pipeline supplier.", expiresAt: until(30),
  });

  // Gas network sites, as stated by each business. One is deliberately overdue for confirmation.
  const site = (businessId: string, data: Omit<Parameters<typeof db.gasSite.create>[0]["data"], "businessId" | "business">) => db.gasSite.create({ data: { ...data, businessId } as never });
  await site(lagoon.id, { name: "Onne LPG terminal (demo)", kind: "TERMINAL", gases: ["lpg_bulk"], state: "Rivers", town: "Onne", storageTonnes: 12_000, delivers: false, hours: "24 hours", notes: "Fictional demo site. Loads bullet trucks for depots and refill plants." });
  await site(ikeja.id, { name: "Ikeja bulk LPG depot (demo)", kind: "DEPOT", gases: ["lpg_bulk"], state: "Lagos", town: "Ikeja", storageTonnes: 2_500, delivers: true, hours: "Mon–Sat 6:00–20:00" });
  await site(ikeja.id, { name: "Sagamu refill plant (demo)", kind: "REFILL_PLANT", gases: ["lpg_bulk", "lpg_cylinder"], cylinderSizes: [6, 12.5, 25, 50], state: "Ogun", town: "Sagamu", storageTonnes: 40, delivers: true, hours: "Daily 7:00–19:00" });
  await site(ikeja.id, { name: "Ibadan cylinder exchange (demo)", kind: "CYLINDER_RETAIL", gases: ["lpg_cylinder"], cylinderSizes: [3, 6, 12.5], state: "Oyo", town: "Ibadan", delivers: false, lastConfirmedAt: new Date(Date.now() - 130 * DAY) });
  await site(kano.id, { name: "Sabon Gari kiosk (demo)", kind: "CYLINDER_RETAIL", gases: ["lpg_cylinder"], cylinderSizes: [3, 6, 12.5], state: "Kano", town: "Sabon Gari", hours: "Daily 7:00–21:00" });
  await site(kano.id, { name: "Tarauni kiosk (demo)", kind: "CYLINDER_RETAIL", gases: ["lpg_cylinder"], cylinderSizes: [3, 6, 12.5], state: "Kano", town: "Tarauni", hours: "Daily 7:00–21:00" });
  await site(kano.id, { name: "Kano skid plant (demo)", kind: "REFILL_PLANT", status: "PLANNED", gases: ["lpg_bulk", "lpg_cylinder"], cylinderSizes: [6, 12.5, 25], state: "Kano", town: "Kumbotso", storageTonnes: 20 });
  await site(corridor.id, { name: "Kaduna gas truck yard (demo)", kind: "LOGISTICS_BASE", gases: ["lpg_bulk", "lpg_cylinder"], state: "Kaduna", town: "Kaduna South", delivers: true, notes: "Fictional demo site. Three 20-tonne bullet trucks and two cylinder trucks." });
  await site(abujaCng.id, { name: "Kubwa CNG station (demo)", kind: "CNG_STATION", gases: ["cng"], state: "FCT Abuja", town: "Kubwa", hours: "Daily 6:00–22:00" });
  await site(abujaCng.id, { name: "Lagos Ikeja CNG station (demo)", kind: "CNG_STATION", gases: ["cng"], state: "Lagos", town: "Ikeja", hours: "Daily 6:00–22:00" });
  await site(abujaCng.id, { name: "Lokoja compression site (demo)", kind: "CNG_MOTHER", gases: ["cng"], state: "Kogi", town: "Lokoja", delivers: true, notes: "Fictional demo site. Fills cascade trucks for stations and factories." });

  // A conversation in progress: Kano asked about Ikeja's LPG and Ikeja replied, which Kano has not read yet.
  const t0 = new Date(Date.now() - 2 * DAY);
  const t1 = new Date(Date.now() - DAY);
  const thread = await db.hubThread.create({
    data: { businessId: ikeja.id, listingId: lpgOffer.id, starterId: buyer.id, subject: lpgOffer.title, createdAt: t0, lastMessageAt: t1, starterReadAt: t0, ownerReadAt: t1 },
  });
  await db.hubMessage.createMany({
    data: [
      { threadId: thread.id, senderId: buyer.id, createdAt: t0, body: "Good morning. We need 20 tonnes a week delivered to Kano from November. Can you quote delivered, and do you work with a haulier?" },
      { threadId: thread.id, senderId: seller.id, createdAt: t1, body: "Thanks, Kano Gas. We can do 20 tonnes weekly. Ex-depot is on the listing; Northern Corridor Haulage carries for us to Kano. Shall I ask them for a delivered quote?" },
    ],
  });
  // Price board: three extra demo sellers so Lagos and Kano have enough reports for a median. Demo figures only.
  const extra = await Promise.all(
    [
      ["surulere@refinerylens.test", "Sade Surulere", "Surulere Gas Point (demo)", "Lagos"],
      ["agege@refinerylens.test", "Ade Agege", "Agege Energy (demo)", "Lagos"],
      ["kanobulk@refinerylens.test", "Musa Kano", "Kano Bulk Gas (demo)", "Kano"],
    ].map(async ([email, person, name, state]) => {
      const u = await mk(email, person);
      return db.hubBusiness.create({ data: { ownerId: u.id, isDemo: true, name, roles: ["SELLER"], state, about: "Fictional demo seller used to populate the price board." } });
    }),
  );
  const [surulere, agege, kanoBulk] = extra;
  const day = (ago: number) => { const d = new Date(Date.now() - ago * DAY); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
  const reports: { businessId: string; state: string; item: string; prices: number[] }[] = [
    // Each list is that seller's price 10 days ago, then 2 days ago (demo figures).
    { businessId: ikeja.id, state: "Lagos", item: "lpg_retail_kg", prices: [1240, 1300] },
    { businessId: surulere.id, state: "Lagos", item: "lpg_retail_kg", prices: [1260, 1320] },
    { businessId: agege.id, state: "Lagos", item: "lpg_retail_kg", prices: [1220, 1280] },
    { businessId: ikeja.id, state: "Lagos", item: "lpg_cyl_12_5", prices: [15500, 16200] },
    { businessId: surulere.id, state: "Lagos", item: "lpg_cyl_12_5", prices: [15800, 16500] },
    { businessId: agege.id, state: "Lagos", item: "lpg_cyl_12_5", prices: [15200, 16000] },
    { businessId: ikeja.id, state: "Lagos", item: "lpg_bulk_kg", prices: [1080, 1120] },
    { businessId: surulere.id, state: "Lagos", item: "lpg_bulk_kg", prices: [1100, 1150] },
    { businessId: agege.id, state: "Lagos", item: "lpg_bulk_kg", prices: [1070, 1110] },
    { businessId: ikeja.id, state: "Lagos", item: "ago_depot_litre", prices: [1850, 1800] },
    { businessId: agege.id, state: "Lagos", item: "ago_depot_litre", prices: [1870, 1830] },
    { businessId: lagoon.id, state: "Lagos", item: "ago_depot_litre", prices: [1840, 1795] },
    { businessId: kano.id, state: "Kano", item: "lpg_retail_kg", prices: [1380, 1420] },
    { businessId: kanoBulk.id, state: "Kano", item: "lpg_retail_kg", prices: [1360, 1400] },
    { businessId: ikeja.id, state: "Kano", item: "lpg_retail_kg", prices: [1400, 1450] },
    { businessId: kano.id, state: "Kano", item: "lpg_cyl_12_5", prices: [17200, 17800] },
    { businessId: kanoBulk.id, state: "Kano", item: "lpg_cyl_12_5", prices: [17000, 17500] },
    { businessId: abujaCng.id, state: "FCT Abuja", item: "cng_scm", prices: [230, 230] },
    { businessId: ikeja.id, state: "Ogun", item: "lpg_retail_kg", prices: [1250, 1290] },
  ];
  await db.priceReport.createMany({ data: reports.flatMap((r) => [{ businessId: r.businessId, state: r.state, item: r.item, priceNaira: r.prices[0], day: day(10) }, { businessId: r.businessId, state: r.state, item: r.item, priceNaira: r.prices[1], day: day(2) }]) });

  // Delivery jobs: one open with a quote, one completed.
  const openJob = await db.deliveryJob.create({ data: { posterId: kano.id, title: "20 tonnes LPG, Ikeja to Kano (demo)", products: ["lpg"], quantity: 20, unit: "tonnes", fromState: "Lagos", fromTown: "Ikeja", toState: "Kano", toTown: "Kumbotso", pickupDate: until(3), details: "Fictional demo job. Bullet truck with valid pressure-vessel certificate; offload at our skid plant." } });
  await db.deliveryQuote.create({ data: { jobId: openJob.id, carrierId: corridor.id, priceNaira: 2_150_000, note: "Demo quote. 20-tonne bullet truck, can load Thursday morning." } });
  const doneJob = await db.deliveryJob.create({ data: { posterId: ikeja.id, title: "33,000 litres diesel, Lagos to Abuja (demo)", products: ["ago"], quantity: 33_000, unit: "litres", fromState: "Lagos", toState: "FCT Abuja", pickupDate: new Date(Date.now() - 12 * DAY), status: "DELIVERED", posterConfirmedAt: new Date(Date.now() - 9 * DAY), carrierConfirmedAt: new Date(Date.now() - 9 * DAY) } });
  const doneQuote = await db.deliveryQuote.create({ data: { jobId: doneJob.id, carrierId: corridor.id, priceNaira: 1_900_000, status: "ACCEPTED" } });
  await db.deliveryJob.update({ where: { id: doneJob.id }, data: { acceptedQuoteId: doneQuote.id } });

  // Supply agreements: Kano Gas buys weekly from Ikeja (two confirmed deliveries, one waiting); Ogun Resin has proposed resin supply to Lagoon Coast.
  const weekly = await db.supplyAgreement.create({ data: { buyerId: kano.id, sellerId: ikeja.id, proposedById: kano.id, product: "lpg", quantity: 20, unit: "tonnes", frequency: "WEEKLY", deliverTo: "Kano", priceNote: "Demo terms: depot price + ₦60/kg delivered", startDate: day(21), status: "ACTIVE" } });
  await db.supplyDelivery.createMany({ data: [
    { agreementId: weekly.id, deliveredOn: day(21), quantity: 20, status: "CONFIRMED", confirmedAt: new Date(Date.now() - 20 * DAY) },
    { agreementId: weekly.id, deliveredOn: day(14), quantity: 20, status: "CONFIRMED", confirmedAt: new Date(Date.now() - 13 * DAY) },
    { agreementId: weekly.id, deliveredOn: day(7), quantity: 19.5, status: "LOGGED" },
  ] });
  await db.supplyAgreement.create({ data: { buyerId: ogun.id, sellerId: lagoon.id, proposedById: ogun.id, product: "pp", quantity: 40, unit: "tonnes", frequency: "MONTHLY", deliverTo: "Ogun", priceNote: "Demo terms: monthly quote", startDate: day(-10), status: "PROPOSED" } });

  return { ikeja, kano, corridor, lagoon, ogun, abujaCng, surulere };
}
