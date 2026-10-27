import type { PrismaClient } from "@prisma/client";

/**
 * Sample trade hub data. Every business here is invented, flagged isSample, and labelled "Sample business" in the UI.
 * Dates are relative to the seed time so the price board and gas map always have current data in a demo.
 */
const DAY = 86_400_000;

export async function seedHub(db: PrismaClient, opts: { passwordHash: string; editorId: string }) {
  const now = Date.now();
  const ago = (d: number) => new Date(now - d * DAY);
  const dateOnly = (d: number) => { const x = ago(d); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())); };

  const owner = (email: string, name: string) => db.user.create({ data: { email, name, passwordHash: opts.passwordHash, role: "USER", plan: "FREE" } });
  const trader = await owner("trader@refinerylens.test", "Tunde Trader");
  const haulier = await owner("haulier@refinerylens.test", "Hauwa Haulier");
  const agent = await db.user.create({ data: { email: "agent@refinerylens.test", name: "Femi Field", passwordHash: opts.passwordHash, role: "USER", plan: "FREE", fieldAgent: true, agentAreas: ["LA", "OG"] } });

  type Spec = { key: string; name: string; roles: string[]; products: string[]; state: string; town: string; verification?: "VERIFIED" | "UNVERIFIED" | "PENDING"; description?: string; userId?: string };
  const specs: Spec[] = [
    { key: "ikeja", userId: trader.id, name: "Ikeja Gas Hub", roles: ["SELLER", "BUYER"], products: ["LPG"], state: "LA", town: "Ikeja", verification: "VERIFIED", description: "LPG refill plant and cylinder exchange serving kiosks and restaurants in mainland Lagos." },
    { key: "apapa", name: "Apapa Depot Services", roles: ["SELLER"], products: ["DIESEL", "PETROL", "KEROSENE", "LPG"], state: "LA", town: "Apapa", verification: "VERIFIED", description: "Product depot selling truckloads to independent marketers and manufacturers." },
    { key: "ojota", name: "Ojota Refill Plant", roles: ["SELLER"], products: ["LPG"], state: "LA", town: "Ojota", verification: "VERIFIED" },
    { key: "ijora", name: "Ijora Fuel Partners", roles: ["SELLER"], products: ["DIESEL", "PETROL"], state: "LA", town: "Ijora", verification: "VERIFIED" },
    { key: "mile2", name: "Mile 2 Energy Traders", roles: ["SELLER"], products: ["DIESEL", "PETROL", "LPG"], state: "LA", town: "Mile 2", verification: "UNVERIFIED" },
    { key: "lekki", name: "Lekki Kiosk Cooperative", roles: ["BUYER"], products: ["LPG"], state: "LA", town: "Lekki", verification: "UNVERIFIED", description: "Twenty-two cooking gas kiosks buying together." },
    { key: "eko", userId: haulier.id, name: "Eko Bobtail Logistics", roles: ["HAULIER"], products: ["LPG", "DIESEL"], state: "LA", town: "Orile", verification: "VERIFIED", description: "Six LPG bobtails and four 33,000-litre tankers. Lagos, Ogun and Oyo." },
    { key: "agbara", name: "Agbara Plastics and Packaging", roles: ["BUYER"], products: ["DIESEL", "LPG", "RESIN"], state: "OG", town: "Agbara", verification: "VERIFIED", description: "Sack and film maker buying diesel for generators and LPG for heaters." },
    { key: "sango", name: "Sango-Ota LPG Plant", roles: ["SELLER"], products: ["LPG"], state: "OG", town: "Sango-Ota", verification: "PENDING" },
    { key: "badagry", name: "Badagry Gas Point", roles: ["SELLER"], products: ["LPG"], state: "LA", town: "Badagry", verification: "PENDING" },
    { key: "kanogas", name: "Kano Northern Gas", roles: ["SELLER"], products: ["LPG", "CNG"], state: "KN", town: "Kano", verification: "VERIFIED" },
    { key: "sabon", name: "Sabon Gari Fleet Haulage", roles: ["HAULIER"], products: ["LPG", "DIESEL", "PETROL"], state: "KN", town: "Sabon Gari", verification: "UNVERIFIED" },
    { key: "kaduna", name: "Kaduna Textile Works", roles: ["BUYER"], products: ["LPG", "CNG", "DIESEL"], state: "KD", town: "Kakuri", verification: "VERIFIED", description: "Textile mill switching boilers from diesel to gas." },
    { key: "abujacng", name: "Abuja CNG Mobility", roles: ["SELLER"], products: ["CNG"], state: "FC", town: "Idu", verification: "VERIFIED" },
    { key: "phmodular", name: "Rivers Modular Refining", roles: ["REFINERY", "SELLER"], products: ["DIESEL", "KEROSENE", "CRUDE"], state: "RI", town: "Eleme", verification: "VERIFIED" },
    { key: "onne", name: "Onne Marine and Road Haulage", roles: ["HAULIER"], products: ["DIESEL", "KEROSENE"], state: "RI", town: "Onne", verification: "UNVERIFIED" },
  ];

  const b: Record<string, { id: string }> = {};
  let i = 0;
  for (const s of specs) {
    const ownerId = s.userId ?? (await owner(`sample-${s.key}@sample.refinerylens.test`, `${s.name} (sample owner)`)).id;
    const verified = s.verification === "VERIFIED";
    b[s.key] = await db.hubBusiness.create({
      data: {
        ownerId, name: s.name, roles: s.roles, products: s.products, state: s.state, town: s.town, description: s.description ?? "", isSample: true,
        phone: `+234 800 000 ${String(1000 + i++).slice(-4)}`, cacNumber: `RC SAMPLE-${1000 + i}`, licenceNumbers: s.roles.includes("SELLER") ? "NMDPRA sample licence" : "",
        verification: s.verification ?? "UNVERIFIED", verifiedAt: verified ? ago(40) : null, verifiedById: verified ? opts.editorId : null, verificationAskedAt: s.verification === "PENDING" ? ago(2) : verified ? ago(45) : null,
      },
    });
  }

  // Seller-stated prices, per unit, charged on recent days. Lagos has enough sellers for medians; Ogun, Kano and Rivers do not yet.
  const prices: [string, string, string, number, number][] = [
    ["ikeja", "LPG", "LA", 1350, 1], ["ojota", "LPG", "LA", 1300, 2], ["mile2", "LPG", "LA", 1420, 3], ["apapa", "LPG", "LA", 1330, 1],
    ["ikeja", "LPG", "LA", 1380, 9],
    ["apapa", "DIESEL", "LA", 1950, 1], ["ijora", "DIESEL", "LA", 1990, 2], ["mile2", "DIESEL", "LA", 2080, 4],
    ["apapa", "PETROL", "LA", 1010, 1], ["ijora", "PETROL", "LA", 995, 3], ["mile2", "PETROL", "LA", 1040, 2],
    ["apapa", "KEROSENE", "LA", 1850, 5],
    ["sango", "LPG", "OG", 1320, 2], ["ikeja", "LPG", "OG", 1360, 4],
    ["kanogas", "LPG", "KN", 1450, 3],
    ["phmodular", "DIESEL", "RI", 1880, 2],
    ["abujacng", "CNG", "FC", 230, 1], ["kanogas", "CNG", "KN", 240, 2],
  ];
  for (const [k, product, state, priceNgn, d] of prices) await db.priceReport.create({ data: { businessId: b[k]!.id, product, state, priceNgn, chargedOn: dateOnly(d) } });

  const sites: [string, "SUPPLY" | "DELIVERY" | "DEMAND", string, string, string, string, string, number][] = [
    ["ikeja", "SUPPLY", "LPG", "Ikeja refill plant", "LA", "Ikeja", "25 t storage, open daily", 3],
    ["ojota", "SUPPLY", "LPG", "Ojota plant", "LA", "Ojota", "40 t storage", 10],
    ["ojota", "SUPPLY", "LPG", "Ojota second skid", "LA", "Ketu", "10 t skid", 75],
    ["apapa", "SUPPLY", "LPG", "Apapa LPG bay", "LA", "Apapa", "Bobtail loading", 5],
    ["sango", "SUPPLY", "LPG", "Sango-Ota plant", "OG", "Sango-Ota", "15 t storage", 6],
    ["kanogas", "SUPPLY", "LPG", "Kano Northern plant", "KN", "Kano", "30 t storage", 4],
    ["kanogas", "SUPPLY", "CNG", "Kano CNG station", "KN", "Kano", "4 dispensers", 4],
    ["abujacng", "SUPPLY", "CNG", "Idu CNG station", "FC", "Idu", "6 dispensers, mother station", 2],
    ["eko", "DELIVERY", "LPG", "Eko bobtail coverage", "LA", "Lagos", "Same or next day", 2],
    ["eko", "DELIVERY", "LPG", "Eko bobtail coverage", "OG", "Ogun", "Next day", 2],
    ["eko", "DELIVERY", "LPG", "Eko bobtail coverage", "OY", "Ibadan", "Two days", 2],
    ["sabon", "DELIVERY", "LPG", "Northern bobtail coverage", "KD", "Kaduna", "Two days", 8],
    ["sabon", "DELIVERY", "LPG", "Northern bobtail coverage", "KN", "Kano", "Same day", 8],
    ["lekki", "DEMAND", "LPG", "Lekki kiosk cluster", "LA", "Lekki", "Needs 6 t a week", 1],
    ["agbara", "DEMAND", "LPG", "Agbara factory heaters", "OG", "Agbara", "Needs 5 t a week", 3],
    ["kaduna", "DEMAND", "LPG", "Kakuri mill boilers", "KD", "Kakuri", "Needs 12 t a week", 2],
    ["kaduna", "DEMAND", "CNG", "Kakuri mill boilers (CNG option)", "KD", "Kakuri", "Needs 9,000 scm a day", 2],
    ["agbara", "DEMAND", "CNG", "Agbara forklift fleet", "OG", "Agbara", "Needs 600 scm a day", 3],
  ];
  for (const [k, kind, gas, name, state, town, capacityNote, d] of sites) await db.gasSite.create({ data: { businessId: b[k]!.id, kind, gas, name, state, town, capacityNote, lastConfirmedAt: ago(d), createdAt: ago(d + 20) } });

  const listings: [string, "OFFER" | "REQUEST", string, number, string, string, string, boolean][] = [
    ["apapa", "OFFER", "DIESEL", 33000, "litres", "LA", "Truckloads daily from Apapa. Buyer's truck or ours.", true],
    ["ikeja", "OFFER", "LPG", 10000, "kg", "LA", "Cylinder refill and bulk to kiosks within Ikeja and Ogba.", false],
    ["lekki", "REQUEST", "LPG", 6000, "kg", "LA", "Weekly, delivered to Lekki Phase 1. Looking for a steady supplier.", false],
    ["agbara", "REQUEST", "DIESEL", 66000, "litres", "OG", "Two trucks a month to Agbara. Test certificate required.", false],
    ["phmodular", "OFFER", "KEROSENE", 30000, "litres", "RI", "Ex-refinery Eleme.", false],
    ["kanogas", "OFFER", "CNG", 20000, "scm", "KN", "Station fills and cascade loading.", false],
    ["kaduna", "REQUEST", "LPG", 12000, "kg", "KD", "Weekly to Kakuri. No supplier in Kaduna yet.", false],
    ["mile2", "OFFER", "PETROL", 45000, "litres", "LA", "Prompt loading.", false],
  ];
  for (const [k, kind, product, quantity, unit, state, details, promoted] of listings) await db.hubListing.create({ data: { businessId: b[k]!.id, kind, product, quantity, unit, state, details, promoted, expiresAt: new Date(now + 25 * DAY), createdAt: ago(2) } });

  // An open load with two quotes, a delivered and confirmed one, and an open northern job.
  const open = await db.deliveryJob.create({ data: { posterId: b.lekki!.id, product: "LPG", quantity: 20000, unit: "kg", fromState: "LA", fromPlace: "Ikeja Gas Hub, Ikeja", toState: "LA", toPlace: "Lekki Phase 1", readyBy: dateOnly(-3), notes: "Bobtail with metered discharge. Weekday mornings." } });
  await db.deliveryQuote.create({ data: { jobId: open.id, haulierId: b.eko!.id, priceNgn: 450000, days: 1, note: "Metered bobtail, 20 t." } });
  await db.deliveryQuote.create({ data: { jobId: open.id, haulierId: b.sabon!.id, priceNgn: 520000, days: 2 } });
  const done = await db.deliveryJob.create({ data: { posterId: b.agbara!.id, product: "DIESEL", quantity: 33000, unit: "litres", fromState: "LA", fromPlace: "Apapa Depot Services", toState: "OG", toPlace: "Agbara industrial estate", readyBy: dateOnly(12), status: "DELIVERED", posterConfirmedAt: ago(9), haulierConfirmedAt: ago(10), createdAt: ago(14) } });
  const won = await db.deliveryQuote.create({ data: { jobId: done.id, haulierId: b.eko!.id, priceNgn: 380000, days: 1, status: "ACCEPTED", createdAt: ago(13) } });
  await db.deliveryJob.update({ where: { id: done.id }, data: { acceptedQuoteId: won.id } });
  await db.deliveryJob.create({ data: { posterId: b.kaduna!.id, product: "LPG", quantity: 12000, unit: "kg", fromState: "KN", fromPlace: "Kano Northern Gas", toState: "KD", toPlace: "Kakuri, Kaduna", readyBy: dateOnly(-5) } });

  // Recurring supply with confirmed deliveries.
  const weekly = await db.supplyAgreement.create({ data: { buyerId: b.agbara!.id, sellerId: b.ojota!.id, proposedById: b.agbara!.id, product: "LPG", quantity: 5000, unit: "kg", frequency: "WEEKLY", deliverTo: "Agbara factory", startsOn: dateOnly(42), status: "ACTIVE", createdAt: ago(44) } });
  for (const w of [35, 28, 21, 14, 7]) await db.supplyDelivery.create({ data: { agreementId: weekly.id, deliveredOn: dateOnly(w), quantity: w === 21 ? 4800 : 5000, note: w === 21 ? "200 kg short; made up next week" : "", sellerConfirmedAt: ago(w), buyerConfirmedAt: ago(w - 1) } });
  await db.supplyDelivery.create({ data: { agreementId: weekly.id, deliveredOn: dateOnly(0), quantity: 5200, sellerConfirmedAt: ago(0) } });
  const kiosks = await db.supplyAgreement.create({ data: { buyerId: b.lekki!.id, sellerId: b.ikeja!.id, proposedById: b.ikeja!.id, product: "LPG", quantity: 2000, unit: "kg", frequency: "WEEKLY", deliverTo: "Lekki kiosks", startsOn: dateOnly(21), status: "ACTIVE", createdAt: ago(22) } });
  for (const w of [14, 7]) await db.supplyDelivery.create({ data: { agreementId: kiosks.id, deliveredOn: dateOnly(w), quantity: 2000, sellerConfirmedAt: ago(w), buyerConfirmedAt: ago(w) } });
  await db.supplyDelivery.create({ data: { agreementId: kiosks.id, deliveredOn: dateOnly(1), quantity: 2000, buyerConfirmedAt: ago(1) } });
  await db.supplyAgreement.create({ data: { buyerId: b.kaduna!.id, sellerId: b.ikeja!.id, proposedById: b.kaduna!.id, product: "LPG", quantity: 12000, unit: "kg", frequency: "WEEKLY", deliverTo: "Kakuri, Kaduna", startsOn: dateOnly(-7) } });

  // More confirmed hauls so Eko Bobtail has a reliability score; one was late.
  for (const [poster, d, late] of [["lekki", 30, false], ["ikeja", 26, false], ["agbara", 20, true], ["lekki", 17, false], ["kaduna", 24, false]] as const) {
    const j = await db.deliveryJob.create({ data: { posterId: b[poster]!.id, product: "LPG", quantity: 15000, unit: "kg", fromState: "LA", fromPlace: "Ikeja Gas Hub", toState: poster === "kaduna" ? "KD" : "LA", toPlace: "Sample delivery", readyBy: dateOnly(d), status: "DELIVERED", haulierConfirmedAt: ago(late ? d - 4 : d - 1), posterConfirmedAt: ago(d - 2), createdAt: ago(d + 3) } });
    const q = await db.deliveryQuote.create({ data: { jobId: j.id, haulierId: b.eko!.id, priceNgn: 400000, days: 1, status: "ACCEPTED", createdAt: ago(d + 2) } });
    await db.deliveryJob.update({ where: { id: j.id }, data: { acceptedQuoteId: q.id } });
  }

  // Ikeja Gas Hub is on the Verified Business plan (set by an administrator after offline payment).
  await db.hubBusiness.update({ where: { id: b.ikeja!.id }, data: { plan: "VERIFIED_BUSINESS", planUntil: new Date(now + 300 * DAY) } });

  // Field programme: Sango-Ota has a visit assigned; Badagry is waiting for one.
  await db.fieldVisit.create({ data: { businessId: b.sango!.id, agentId: agent.id, assignedById: opts.editorId, createdAt: ago(1) } });

  // Morning price alerts for the trader (in-app only until SMS or WhatsApp is switched on).
  await db.priceAlertSubscription.create({ data: { userId: trader.id, states: ["LA", "OG"], products: ["LPG", "DIESEL"], channels: ["IN_APP"] } });

  // Price history: weekly reports from Lagos and Ogun sellers for the past half year (older than the board's 14-day
  // window, so today's board is unchanged). A gentle upward drift with small deterministic wobbles.
  const history: [string, string, string, number][] = [
    ["ikeja", "LPG", "LA", 1180], ["ojota", "LPG", "LA", 1150], ["apapa", "LPG", "LA", 1200], ["mile2", "LPG", "LA", 1260],
    ["apapa", "DIESEL", "LA", 1720], ["ijora", "DIESEL", "LA", 1760], ["mile2", "DIESEL", "LA", 1830],
    ["sango", "LPG", "OG", 1170], ["ikeja", "LPG", "OG", 1210], ["ojota", "LPG", "OG", 1190],
  ];
  const histRows = [];
  for (const [k, product, state, base] of history) {
    for (let w = 3; w <= 26; w++) {
      const drift = (26 - w) * 0.006;
      const wobble = (((w * 7 + base) % 11) - 5) / 400;
      histRows.push({ businessId: b[k]!.id, product, state, priceNgn: Math.round(base * (1 + drift + wobble)), chargedOn: dateOnly(w * 7 - 2) });
    }
  }
  await db.priceReport.createMany({ data: histRows, skipDuplicates: true });

  // Finance pilot: an invented sample lender, its staff login, and Eko Bobtail's shared record.
  const lender = await db.financePartner.create({ data: { name: "Harbour Microfinance Bank (sample lender)", description: "Sample data. Stock and truck-repair loans for verified hauliers and gas sellers in Lagos and Ogun.", states: ["LA", "OG"], products: ["LPG", "DIESEL"] } });
  const lenderUser = await db.user.create({ data: { email: "lender@refinerylens.test", name: "Lola Lender", passwordHash: opts.passwordHash, role: "USER", plan: "FREE", financePartnerId: lender.id, priceDataUntil: new Date(now + 365 * DAY) } });
  await db.financeRequest.create({ data: { businessId: b.eko!.id, partnerId: lender.id, amountNgn: 4_500_000, purpose: "TRUCK", product: "LPG", notes: "Two bobtails need new pumps before the harmattan rush.", consentAt: ago(2), shareUntil: new Date(now + 88 * DAY), createdAt: ago(2) } });

  // Cylinders: Ikeja Gas Hub owns 40 tested cylinders (10 out at the Lekki kiosks) and 2 past their test date.
  const cyl = (n: number) => `IKG-${String(n).padStart(6, "0")}`;
  const tested = dateOnly(400);
  const due = new Date(Date.UTC(tested.getUTCFullYear() + 5, tested.getUTCMonth(), tested.getUTCDate()));
  await db.cylinder.createMany({ data: Array.from({ length: 40 }, (_, i) => ({ serial: cyl(i + 1), ownerId: b.ikeja!.id, holderId: i < 10 ? b.lekki!.id : b.ikeja!.id, sizeKg: 12.5, lastTestOn: tested, nextTestDue: due, lastFilledAt: i < 10 ? ago(3) : null, createdAt: ago(30) })) });
  const old = dateOnly(365 * 5 + 20);
  await db.cylinder.createMany({ data: [41, 42].map((n) => ({ serial: cyl(n), ownerId: b.ikeja!.id, holderId: b.ikeja!.id, sizeKg: 12.5, lastTestOn: old, nextTestDue: new Date(Date.UTC(old.getUTCFullYear() + 5, old.getUTCMonth(), old.getUTCDate())), createdAt: ago(30) })) });
  const cyls = await db.cylinder.findMany({ where: { ownerId: b.ikeja!.id }, select: { id: true, serial: true } });
  await db.cylinderEvent.createMany({ data: cyls.map((c) => ({ cylinderId: c.id, kind: "REGISTERED", byId: b.ikeja!.id, at: ago(30) })) });
  const out = cyls.filter((c) => Number(c.serial.slice(4)) <= 10);
  await db.cylinderEvent.createMany({ data: out.flatMap((c) => [{ cylinderId: c.id, kind: "FILLED", byId: b.ikeja!.id, at: ago(3) }, { cylinderId: c.id, kind: "DISPATCHED", byId: b.ikeja!.id, toId: b.lekki!.id, at: ago(3) }]) });

  // Compliance vault for Ikeja Gas Hub: one paper expiring soon and one expired, so reminders and warnings show.
  const inDays = (d: number) => dateOnly(-d);
  await db.complianceRecord.createMany({ data: [
    { businessId: b.ikeja!.id, kind: "CAC", title: "CAC certificate of incorporation", number: "RC SAMPLE-1001", issuer: "Corporate Affairs Commission", issuedOn: dateOnly(2200) },
    { businessId: b.ikeja!.id, kind: "NMDPRA", title: "LPG retail outlet licence, Ikeja", number: "NMDPRA/SAMPLE/LPG/0421", issuer: "NMDPRA", issuedOn: dateOnly(325), expiresOn: inDays(40), reminderStage: 60 },
    { businessId: b.ikeja!.id, kind: "TCC", title: "Tax clearance certificate 2026", number: "TCC-SAMPLE-7781", issuer: "FIRS", issuedOn: dateOnly(200), expiresOn: inDays(165) },
    { businessId: b.ikeja!.id, kind: "FIRE", title: "Fire safety certificate", number: "LSFS/SAMPLE/0932", issuer: "Lagos State Fire and Rescue Service", issuedOn: dateOnly(380), expiresOn: dateOnly(15), reminderStage: 0 },
    { businessId: b.ikeja!.id, kind: "INSURANCE", title: "Plant and stock insurance", number: "POL-SAMPLE-55120", issuer: "Sample Insurance Plc", issuedOn: dateOnly(90), expiresOn: inDays(275), inVendorPack: false },
  ] });

  await db.hubReport.create({ data: { businessId: b.mile2!.id, reporterId: haulier.id, reason: "ADVANCE_PAYMENT", details: "Sample report: asked for full payment before loading, then stopped answering for two days." } });

  return { trader, haulier, agent, lenderUser };
}
