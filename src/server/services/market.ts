import { db } from "@/lib/db";
import { can, type Actor } from "@/lib/permissions";

/**
 * Market and macro context series. Readers only see series whose source an editor has approved; staff also see the
 * rest so they can check the data before approving.
 */
export async function listMarketSeries(actor: Actor | null, opts: { days?: number } = {}) {
  const staff = can.viewEditorial(actor);
  const since = new Date(Date.now() - (opts.days ?? 400) * 86_400_000);
  const series = await db.marketSeries.findMany({
    where: staff ? {} : { source: { approved: true } },
    include: { source: true, observations: { orderBy: { periodStart: "desc" }, take: 400 } },
    orderBy: { key: "asc" },
  });
  return series.map((s) => ({
    ...s,
    // Annual and monthly series keep their full history; daily ones are trimmed to the window.
    observations: s.observations.filter((o) => s.frequency !== "DAILY" || o.periodStart >= since).reverse(),
  }));
}

export type MarketSeriesView = Awaited<ReturnType<typeof listMarketSeries>>[number];

export async function latestIngestionRuns() {
  const rows = await db.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 40 });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.provider)) latest.set(r.provider, r);
  return latest;
}
