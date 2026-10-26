import type { ContextScope, Provenance } from "@prisma/client";
import { db } from "@/lib/db";
import { can, type Actor } from "@/lib/permissions";
import { crack321, CRACK_321_FORMULA } from "@/lib/market";
import { PROVIDERS, type ProviderId } from "./catalog";

/**
 * Read API over the cached open-data feeds, for any feature that needs market context or the refinery directory.
 * Nothing here calls an external API: values come from what the ingestion last stored. Without an actor (or for a
 * reader) only data from editor-approved sources is returned; staff also get the rest, flagged approved=false.
 */
export { PROVIDERS, SERIES, NOT_INGESTED } from "./catalog";
export { runOpenDataIngestion } from "./ingest";

export type MarketSignal = {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** End of the period the value describes. */
  asOf: Date;
  /** The period exactly as the publisher labels it. */
  period: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: Date;
  attribution: string;
  licence: string;
  provenance: Provenance;
  scope: ContextScope;
  approved: boolean;
  /** Set for calculated signals. */
  formula?: string;
};

export const CRACK_KEY = "calc.crack_321";
const CRACK_INPUTS = ["eia.brent_spot", "eia.gulf_gasoline_spot", "eia.gulf_ulsd_spot"];

const toPoints = (s: { observations: { period: string; value: unknown }[] }) => s.observations.map((o) => ({ period: o.period, value: Number(o.value) }));

const sourceWhere = (actor: Actor | null) => (can.viewEditorial(actor) ? {} : { source: { approved: true } });

/** Latest value for each requested key. Keys without data are left out rather than filled in. */
export async function getMarketSignals(keys: string[], actor: Actor | null = null): Promise<MarketSignal[]> {
  const wanted = new Set(keys);
  const fetchKeys = [...wanted].filter((k) => k !== CRACK_KEY);
  if (wanted.has(CRACK_KEY)) fetchKeys.push(...CRACK_INPUTS);
  const series = await db.marketSeries.findMany({
    where: { key: { in: fetchKeys }, ...sourceWhere(actor) },
    include: { source: true, observations: { orderBy: { periodStart: "desc" }, take: wanted.has(CRACK_KEY) ? 30 : 1 } },
  });
  const byKey = new Map(series.map((s) => [s.key, s]));
  const out: MarketSignal[] = [];
  for (const key of keys) {
    if (key === CRACK_KEY) {
      const [b, g, d] = CRACK_INPUTS.map((k) => byKey.get(k));
      if (!b || !g || !d) continue;
      const pts = crack321(toPoints(b), toPoints(g), toPoints(d));
      const last = pts[pts.length - 1];
      if (!last) continue;
      const obs = b.observations.find((o) => o.period === last.period)!;
      out.push({ key, label: "Indicative 3-2-1 crack spread (US Gulf Coast products vs Brent)", value: last.value, unit: "USD/bbl", asOf: obs.periodEnd, period: last.period, sourceName: `Calculated by RefineryLens from ${b.source.name}`, sourceUrl: b.sourcePageUrl, retrievedAt: obs.retrievedAt, attribution: b.attribution, licence: b.source.licenseNotes, provenance: "ANALYST_ESTIMATE", scope: "GLOBAL_MARKET", approved: b.source.approved, formula: CRACK_321_FORMULA });
      continue;
    }
    const s = byKey.get(key);
    const o = s?.observations[0];
    if (!s || !o) continue;
    out.push({ key, label: s.label, value: Number(o.value), unit: s.unit, asOf: o.periodEnd, period: o.period, sourceName: s.source.name, sourceUrl: s.sourcePageUrl, retrievedAt: o.retrievedAt, attribution: s.attribution, licence: s.source.licenseNotes, provenance: s.source.provenance, scope: s.contextScope, approved: s.source.approved });
  }
  return out;
}

export type RefineryAssetView = {
  id: string;
  externalId: string;
  name: string;
  countryCode: string;
  assetType: string;
  capacityBpd: number | null;
  owners: string[];
  lat: number | null;
  lon: number | null;
  emissionsTCo2e: number | null;
  emissionsYear: number | null;
  sourceUrl: string;
  retrievedAt: Date;
  attribution: string;
  approved: boolean;
};

/** Refineries from the global inventory, largest first. */
export async function listRefineryAssets(filter: { countries?: string[]; minCapacityBpd?: number; q?: string; take?: number } = {}, actor: Actor | null = null): Promise<RefineryAssetView[]> {
  const rows = await db.refineryAsset.findMany({
    where: {
      ...sourceWhere(actor),
      ...(filter.countries?.length ? { countryCode: { in: filter.countries.map((c) => c.toUpperCase()) } } : {}),
      ...(filter.minCapacityBpd ? { capacityBpd: { gte: filter.minCapacityBpd } } : {}),
      ...(filter.q ? { OR: [{ name: { contains: filter.q, mode: "insensitive" as const } }, { owners: { has: filter.q } }] } : {}),
    },
    include: { source: { select: { approved: true } } },
    orderBy: [{ capacityBpd: { sort: "desc", nulls: "last" } }, { name: "asc" }],
    take: filter.take ?? 500,
  });
  const attribution = PROVIDERS["climate-trace"].attribution;
  return rows.map((r) => ({
    id: r.id,
    externalId: r.externalId,
    name: r.name,
    countryCode: r.countryCode,
    assetType: r.assetType,
    capacityBpd: r.capacityBpd === null ? null : Number(r.capacityBpd),
    owners: r.owners,
    lat: r.lat,
    lon: r.lon,
    emissionsTCo2e: r.emissionsTCo2e === null ? null : Number(r.emissionsTCo2e),
    emissionsYear: r.emissionsYear,
    sourceUrl: r.sourceUrl,
    retrievedAt: r.retrievedAt,
    attribution,
    approved: r.source.approved,
  }));
}

export type { ProviderId };
