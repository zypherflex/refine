import { db } from "@/lib/db";

/** Demo market values written by the seed carry this request URL, so pages can label them. */
export const DEMO_REQUEST = "demo-seed";

export type Observation = { value: number; period: string; label: string; unit: string; sourcePageUrl: string; demo: boolean };

/** The latest observation of a market series, only from a source an editor has approved (as on the market page). */
export async function latestObservation(key: string): Promise<Observation | null> {
  const o = await db.marketObservation.findFirst({
    where: { series: { key, source: { approved: true } } },
    orderBy: { periodStart: "desc" },
    include: { series: { select: { label: true, unit: true, sourcePageUrl: true } } },
  });
  if (!o) return null;
  return { value: Number(o.value), period: o.period, label: o.series.label, unit: o.series.unit, sourcePageUrl: o.series.sourcePageUrl, demo: o.requestUrl === DEMO_REQUEST };
}

export const latestFx = () => latestObservation("fx.usd_ngn");

/** Daily naira rates, oldest first, for converting a history: each day uses the latest rate on or before it. */
export async function fxHistory() {
  const rows = await db.marketObservation.findMany({ where: { series: { key: "fx.usd_ngn", source: { approved: true } } }, orderBy: { periodStart: "asc" }, select: { periodStart: true, period: true, value: true, requestUrl: true } });
  const list = rows.map((r) => ({ t: r.periodStart.getTime(), period: r.period, rate: Number(r.value), demo: r.requestUrl === DEMO_REQUEST }));
  return (day: Date) => {
    let hit: (typeof list)[number] | null = null;
    for (const r of list) {
      if (r.t > day.getTime() + 86_400_000) break;
      hit = r;
    }
    return hit;
  };
}
