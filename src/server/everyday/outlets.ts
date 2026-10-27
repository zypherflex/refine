import { z } from "zod";
import type { OutletKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { isPubliclyVisible, NIGERIAN_STATES } from "@/lib/hub/catalog";
import { dayOf, MIN_SELLERS, median, naira, priceItem, WINDOW_DAYS } from "@/lib/hub/prices";
import {
  AVAILABILITY_HOURS, communityPrice, DAILY_REPORT_LIMIT, EVERYDAY_ITEMS, FRESH_HOURS, isOutlier, itemsSoldAt, PROBLEMS, QUEUES,
  type CommunityPrice, type EverydayItem,
} from "@/lib/everyday";
import { audit } from "../audit";

const state = z.string().refine((s) => (NIGERIAN_STATES as readonly string[]).includes(s), "Choose a Nigerian state");

export const outletInput = z.object({
  name: z.string().trim().min(2, "Give the station or shop's name").max(100),
  brand: z.string().trim().max(60).default(""),
  kind: z.enum(["FILLING_STATION", "GAS_RETAILER", "CNG_STATION"]),
  state,
  area: z.string().trim().min(2, "Give the area or LGA, e.g. Surulere").max(80),
  address: z.string().trim().max(200).default(""),
});

/** People add the stations and gas shops they use. Near-duplicates in the same area are refused. */
export async function addOutlet(actor: Actor, raw: z.input<typeof outletInput>) {
  const input = outletInput.parse(raw);
  const today = await db.outlet.count({ where: { addedById: actor.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
  if (today >= 10) throw new AppError("You have added 10 places today. Try again tomorrow.");
  const dup = await db.outlet.findFirst({
    where: { state: input.state, kind: input.kind, hidden: false, name: { equals: input.name, mode: "insensitive" }, area: { equals: input.area, mode: "insensitive" } },
  });
  if (dup) throw new AppError(`${dup.name} in ${dup.area} is already listed.`);
  const o = await db.outlet.create({ data: { ...input, addedById: actor.id } });
  await audit(actor.id, "outlet.add", "Outlet", o.id);
  return o;
}

export const reportInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PRICE"), item: z.enum(EVERYDAY_ITEMS), priceNaira: z.number().positive().finite(), note: z.string().trim().max(280).default("") }),
  z.object({ kind: z.literal("AVAILABILITY"), item: z.enum(EVERYDAY_ITEMS), available: z.boolean(), queue: z.enum(QUEUES.map((q) => q.id) as [string, ...string[]]).nullable().default(null), note: z.string().trim().max(280).default("") }),
  z.object({ kind: z.literal("PROBLEM"), problem: z.enum(PROBLEMS.map((p) => p.id) as [string, ...string[]]), note: z.string().trim().max(500).default("") }),
]);

/** Median of everyone's fresh reports for an item across a state, used to catch typing mistakes. */
async function statePrice(item: string, s: string, now = new Date()) {
  const rows = await db.outletReport.findMany({
    where: { kind: "PRICE", item, hidden: false, outlet: { state: s, hidden: false }, createdAt: { gte: new Date(now.getTime() - FRESH_HOURS * 3_600_000) } },
    select: { userId: true, priceNaira: true, createdAt: true },
  });
  return communityPrice(rows.map((r) => ({ ...r, priceNaira: r.priceNaira! })), now);
}

/** A signed-in person reports a price, availability or a problem at an outlet. */
export async function reportOutlet(actor: Actor, outletId: string, raw: z.input<typeof reportInput>) {
  const outlet = await db.outlet.findUnique({ where: { id: outletId } });
  if (!outlet || outlet.hidden) throw new NotFoundError("Place not found");
  const input = reportInput.parse(raw);
  const since = new Date(Date.now() - 86_400_000);
  if ((await db.outletReport.count({ where: { userId: actor.id, createdAt: { gte: since } } })) >= DAILY_REPORT_LIMIT) {
    throw new AppError("You have sent the most reports allowed in a day. Thank you; try again tomorrow.");
  }
  const data: Prisma.OutletReportUncheckedCreateInput = { outletId, userId: actor.id, kind: input.kind, note: input.note };
  if (input.kind === "PRICE" || input.kind === "AVAILABILITY") {
    if (!itemsSoldAt(outlet.kind).includes(input.item)) throw new AppError("That product is not sold at this kind of place.");
    data.item = input.item;
  }
  if (input.kind === "PRICE") {
    const item = priceItem(input.item)!;
    if (input.priceNaira < item.min || input.priceNaira > item.max) throw new AppError(`₦${input.priceNaira.toLocaleString("en-GB")} ${item.unit} looks wrong. Check the amount and the unit.`);
    const sameRecently = await db.outletReport.findFirst({ where: { userId: actor.id, outletId, kind: "PRICE", item: input.item, createdAt: { gte: new Date(Date.now() - 6 * 3_600_000) } } });
    if (sameRecently) throw new AppError("You reported this price here in the last 6 hours.");
    const { median: m } = await statePrice(input.item, outlet.state);
    if (isOutlier(input.priceNaira, m)) throw new AppError(`That is far from the ${naira(m!)} most people report in ${outlet.state}. Check the amount; if it is right, add a note and report it as a problem instead.`);
    data.priceNaira = input.priceNaira;
  }
  if (input.kind === "AVAILABILITY") {
    data.available = input.available;
    data.queue = input.available ? input.queue : null;
  }
  if (input.kind === "PROBLEM") data.problem = input.problem;
  const r = await db.outletReport.create({ data });
  await audit(actor.id, "outlet.report", "Outlet", outletId, { kind: input.kind });
  return r;
}

export type OutletFilter = { state: string; kind?: OutletKind; q?: string };

export type OutletCard = {
  id: string; name: string; brand: string; kind: OutletKind; state: string; area: string; address: string; isDemo: boolean;
  prices: { item: EverydayItem; priceNaira: number; at: Date; reporters: number }[];
  availability: { item: EverydayItem; available: boolean; queue: string | null; at: Date }[];
  problems30d: number;
};

/** Public list of outlets in a state with the latest price per product (last 3 days) and fresh queue reports. */
export async function listOutlets(f: OutletFilter, now = new Date()): Promise<OutletCard[]> {
  const where: Prisma.OutletWhereInput = { state: f.state, hidden: false, ...(f.kind ? { kind: f.kind } : {}) };
  if (f.q?.trim()) where.OR = [{ name: { contains: f.q.trim(), mode: "insensitive" } }, { area: { contains: f.q.trim(), mode: "insensitive" } }, { brand: { contains: f.q.trim(), mode: "insensitive" } }];
  const outlets = await db.outlet.findMany({
    where,
    orderBy: [{ area: "asc" }, { name: "asc" }],
    take: 200,
    include: { reports: { where: { hidden: false, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } }, orderBy: { createdAt: "desc" } } },
  });
  return outlets.map((o) => summariseOutlet(o, now)).sort((a, b) => latestAt(b) - latestAt(a));
}

const latestAt = (o: OutletCard) => Math.max(0, ...o.prices.map((p) => p.at.getTime()), ...o.availability.map((a) => a.at.getTime()));

type OutletWithReports = Prisma.OutletGetPayload<{ include: { reports: true } }>;

function summariseOutlet(o: OutletWithReports, now: Date): OutletCard {
  const fresh = now.getTime() - FRESH_HOURS * 3_600_000;
  const prices: OutletCard["prices"] = [];
  const availability: OutletCard["availability"] = [];
  for (const item of itemsSoldAt(o.kind)) {
    const pr = o.reports.filter((r) => r.kind === "PRICE" && r.item === item && r.createdAt.getTime() >= fresh);
    if (pr.length) prices.push({ item, priceNaira: pr[0].priceNaira!, at: pr[0].createdAt, reporters: new Set(pr.map((r) => r.userId)).size });
    const av = o.reports.find((r) => r.kind === "AVAILABILITY" && r.item === item && r.createdAt.getTime() >= now.getTime() - AVAILABILITY_HOURS * 3_600_000);
    if (av) availability.push({ item, available: !!av.available, queue: av.queue, at: av.createdAt });
  }
  return {
    id: o.id, name: o.name, brand: o.brand, kind: o.kind, state: o.state, area: o.area, address: o.address, isDemo: o.isDemo,
    prices, availability, problems30d: o.reports.filter((r) => r.kind === "PROBLEM").length,
  };
}

export async function getOutlet(id: string, now = new Date()) {
  const o = await db.outlet.findUnique({
    where: { id },
    include: { reports: { where: { hidden: false, createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } }, orderBy: { createdAt: "desc" } } },
  });
  if (!o || o.hidden) throw new NotFoundError("Place not found");
  const problems = new Map<string, number>();
  for (const r of o.reports) if (r.kind === "PROBLEM") problems.set(r.problem!, (problems.get(r.problem!) ?? 0) + 1);
  return { card: summariseOutlet(o, now), recent: o.reports.slice(0, 30), problems: [...problems.entries()].sort((a, b) => b[1] - a[1]) };
}

export type TodayRow = { item: EverydayItem; people: CommunityPrice; sellers: { median: number | null; count: number } };

/**
 * "Today" for a state: for each everyday product, the median of what people paid in the last three days and, for
 * comparison, the median sellers on the trade hub reported for the week. Either can be missing when too few reported.
 */
export async function todayPrices(s: string, now = new Date()): Promise<{ rows: TodayRow[]; includesDemo: boolean }> {
  const [reports, sellerReports] = await Promise.all([
    db.outletReport.findMany({
      where: { kind: "PRICE", hidden: false, outlet: { state: s, hidden: false }, createdAt: { gte: new Date(now.getTime() - FRESH_HOURS * 3_600_000) } },
      select: { item: true, userId: true, priceNaira: true, createdAt: true, outlet: { select: { isDemo: true } } },
    }),
    db.priceReport.findMany({
      where: { state: s, item: { in: [...EVERYDAY_ITEMS] }, day: { gte: new Date(dayOf(now).getTime() - (WINDOW_DAYS - 1) * 86_400_000) }, business: { verification: { not: "SUSPENDED" } } },
      select: { item: true, businessId: true, priceNaira: true, day: true, business: { select: { name: true, verification: true, isDemo: true } } },
    }),
  ]);
  const visibleSellers = sellerReports.filter((r) => isPubliclyVisible(r.business));
  const rows = EVERYDAY_ITEMS.map((item) => {
    const people = communityPrice(reports.filter((r) => r.item === item).map((r) => ({ userId: r.userId, priceNaira: r.priceNaira!, createdAt: r.createdAt })), now);
    const latest = new Map<string, { price: number; day: Date }>();
    for (const r of visibleSellers.filter((x) => x.item === item)) {
      const cur = latest.get(r.businessId);
      if (!cur || cur.day < r.day) latest.set(r.businessId, { price: r.priceNaira, day: r.day });
    }
    const prices = [...latest.values()].map((v) => v.price);
    return { item, people, sellers: { median: prices.length >= MIN_SELLERS ? median(prices) : null, count: prices.length } };
  });
  return { rows, includesDemo: reports.some((r) => r.outlet.isDemo) || visibleSellers.some((r) => r.business.isDemo) };
}

/** Today's petrol and CNG medians across the country (or a state), to prefill the CNG savings calculator. */
export async function fuelPricesFor(s: string | null, now = new Date()) {
  const where = (item: string) => ({ kind: "PRICE" as const, item, hidden: false, outlet: { hidden: false, ...(s ? { state: s } : {}) }, createdAt: { gte: new Date(now.getTime() - FRESH_HOURS * 3_600_000) } });
  const [petrol, cng] = await Promise.all(["pms_retail_litre", "cng_scm"].map((item) => db.outletReport.findMany({ where: where(item), select: { userId: true, priceNaira: true, createdAt: true } })));
  const pick = (rows: typeof petrol) => communityPrice(rows.map((r) => ({ ...r, priceNaira: r.priceNaira! })), now).median;
  return { petrol: pick(petrol), cng: pick(cng) };
}

/** Administrators hide a wrong or abusive report, or an outlet that is a duplicate or does not exist. */
export async function hideOutletReport(actor: Actor, reportId: string) {
  if (!can.moderateHub(actor)) throw new ForbiddenError();
  await db.outletReport.update({ where: { id: reportId }, data: { hidden: true } });
  await audit(actor.id, "outlet.report.hide", "OutletReport", reportId);
}

export async function hideOutlet(actor: Actor, outletId: string) {
  if (!can.moderateHub(actor)) throw new ForbiddenError();
  await db.outlet.update({ where: { id: outletId }, data: { hidden: true } });
  await audit(actor.id, "outlet.hide", "Outlet", outletId);
}
