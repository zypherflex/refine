import { db } from "@/lib/db";
import { isPubliclyVisible } from "@/lib/hub/catalog";
import { median, MIN_SELLERS, WINDOW_DAYS } from "@/lib/hub/prices";
import { EVERYDAY_ITEMS, FRESH_HOURS, MIN_REPORTERS } from "@/lib/everyday";

const DAY = 86_400_000;
export const utcDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

type Row = { day: Date; state: string; item: string; source: "PUBLIC" | "SELLER"; median: number; low: number; high: number; reporters: number; includesDemo: boolean };

/**
 * Builds the index for one UTC day: PUBLIC is each person's latest pump or counter price in the 3 days to the end of
 * that day; SELLER is each seller's latest reported price in the 7 days to that day. A row is written only with at
 * least MIN_REPORTERS people or MIN_SELLERS sellers, the same rules as the public pages.
 */
export async function buildIndexForDay(dayIn: Date) {
  const day = utcDay(dayIn);
  const end = new Date(day.getTime() + DAY);
  const rows: Row[] = [];

  const reports = await db.outletReport.findMany({
    where: { kind: "PRICE", hidden: false, item: { in: [...EVERYDAY_ITEMS] }, createdAt: { gte: new Date(end.getTime() - FRESH_HOURS * 3_600_000), lt: end }, outlet: { hidden: false } },
    select: { userId: true, item: true, priceNaira: true, createdAt: true, outlet: { select: { state: true, isDemo: true } } },
  });
  const latest = new Map<string, (typeof reports)[number]>();
  reports.forEach((r, i) => {
    const k = `${r.outlet.state}|${r.item}|${r.userId ?? `anon${i}`}`;
    const cur = latest.get(k);
    if (!cur || cur.createdAt < r.createdAt) latest.set(k, r);
  });
  group([...latest.values()], (r) => `${r.outlet.state}|${r.item}`).forEach((g, k) => {
    if (g.length < MIN_REPORTERS) return;
    const [state, item] = k.split("|");
    const prices = g.map((r) => r.priceNaira!);
    rows.push({ day, state, item, source: "PUBLIC", median: median(prices)!, low: Math.min(...prices), high: Math.max(...prices), reporters: g.length, includesDemo: g.some((r) => r.outlet.isDemo) });
  });

  const seller = await db.priceReport.findMany({
    where: { day: { gte: new Date(day.getTime() - (WINDOW_DAYS - 1) * DAY), lte: day }, business: { verification: { not: "SUSPENDED" } } },
    select: { businessId: true, item: true, state: true, priceNaira: true, day: true, business: { select: { name: true, verification: true, isDemo: true } } },
  });
  const latestSeller = new Map<string, (typeof seller)[number]>();
  for (const r of seller.filter((x) => isPubliclyVisible(x.business))) {
    const k = `${r.state}|${r.item}|${r.businessId}`;
    const cur = latestSeller.get(k);
    if (!cur || cur.day < r.day) latestSeller.set(k, r);
  }
  group([...latestSeller.values()], (r) => `${r.state}|${r.item}`).forEach((g, k) => {
    if (g.length < MIN_SELLERS) return;
    const [state, item] = k.split("|");
    const prices = g.map((r) => r.priceNaira);
    rows.push({ day, state, item, source: "SELLER", median: median(prices)!, low: Math.min(...prices), high: Math.max(...prices), reporters: g.length, includesDemo: g.some((r) => r.business.isDemo) });
  });

  await db.$transaction([
    // A day is rebuilt whole, so a hidden report or a suspended seller drops out of past figures too.
    db.priceIndexDaily.deleteMany({ where: { day } }),
    db.priceIndexDaily.createMany({ data: rows }),
  ]);
  return rows.length;
}

function group<T>(xs: T[], key: (x: T) => string) {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

/** Rebuilds the last `days` days, for a new installation or after moderation changed past reports. */
export async function backfillIndex(days: number, now = new Date()) {
  let total = 0;
  for (let i = days - 1; i >= 0; i--) total += await buildIndexForDay(new Date(now.getTime() - i * DAY));
  return total;
}

let lastBuild = 0;
/** Worker: rebuilds yesterday and today at most once an hour, so late reports still count. */
export async function refreshIndexIfDue(now = new Date()) {
  if (now.getTime() - lastBuild < 3_600_000) return 0;
  lastBuild = now.getTime();
  return (await buildIndexForDay(new Date(now.getTime() - DAY))) + (await buildIndexForDay(now));
}
