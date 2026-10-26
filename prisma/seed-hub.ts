import type { PrismaClient } from "@prisma/client";

/**
 * Fictional trade hub businesses for the demo. Every one is flagged isDemo and named "(demo)" so nobody mistakes it
 * for a real trading partner; prices are labelled as demo figures.
 */

const DAY = 86_400_000;
const until = (days: number) => new Date(Date.now() + days * DAY);

export async function seedHub(db: PrismaClient, mk: (email: string, name: string) => Promise<{ id: string }>, adminId: string) {
  const [seller, buyer, haulier, refinery, converter] = await Promise.all([
    mk("seller@refinerylens.test", "Sade Seller"),
    mk("buyer@refinerylens.test", "Bello Buyer"),
    mk("haulier@refinerylens.test", "Haruna Haulier"),
    mk("refinery@refinerylens.test", "Rita Refinery"),
    mk("converter@refinerylens.test", "Chidi Converter"),
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
      name: "Kano Gas Kiosks (demo)", roles: ["BUYER"], state: "Kano", city: "Kano",
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
  return { ikeja, kano, corridor, lagoon, ogun };
}
