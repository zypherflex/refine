import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "../audit";
import { enqueue } from "../jobs";
import { openDataStatus } from "../integrations";
import { PROVIDERS, SERIES, type ProviderId, type SeriesDef } from "./catalog";
import { CLIMATE_TRACE_PAGE, climateTraceUrl, eiaUrl, fxUrl, parseClimateTrace, gdeltUrl, getJson, parseEia, parseFx, parseGdelt, parseWorldBank, redactUrl, worldBankUrl, type Fetch, type SeriesResult } from "./providers";

export const PROVIDER_ORDER: ProviderId[] = ["eia", "worldbank", "exchangerate-api", "climate-trace", "gdelt"];

export type RunSummary = { provider: ProviderId; status: "OK" | "FAILED" | "SKIPPED"; message: string; itemsUpserted: number };

/** Finds the provider's Source record, creating it unapproved so an editor reviews the licence before readers see data. */
async function ensureSource(id: ProviderId) {
  const p = PROVIDERS[id];
  const existing = await db.source.findFirst({ where: { name: p.name } });
  if (existing) return existing;
  return db.source.create({ data: { name: p.name, publisher: p.publisher, homepageUrl: p.homepageUrl, provenance: p.provenance, licenseNotes: p.licenseNotes, approved: false } });
}

async function fetchSeries(def: SeriesDef, fetchImpl: Fetch, now: Date): Promise<SeriesResult> {
  let url: string;
  let parse: (j: unknown) => SeriesResult["observations"];
  if (def.provider === "eia") {
    url = eiaUrl(def, process.env.EIA_API_KEY ?? "", now);
    parse = parseEia;
  } else if (def.provider === "worldbank") {
    url = worldBankUrl(def);
    parse = parseWorldBank;
  } else {
    url = fxUrl(def);
    parse = (j) => parseFx(j, def.params.quote);
  }
  const observations = parse(await getJson(fetchImpl, url));
  return { observations, requestUrl: redactUrl(url) };
}

/** Stores a series and its observations. New periods are added; values the publisher has revised are updated. */
async function storeSeries(def: SeriesDef, sourceId: string, result: SeriesResult, now: Date): Promise<number> {
  const p = PROVIDERS[def.provider];
  const meta = { provider: def.provider, externalId: def.externalId, label: def.label, description: def.description, unit: def.unit, frequency: def.frequency, contextScope: def.contextScope, geography: def.geography, sourceId, sourcePageUrl: def.sourcePageUrl, attribution: p.attribution };
  const series = await db.marketSeries.upsert({ where: { key: def.key }, create: { key: def.key, ...meta, lastRetrievedAt: now, lastError: "" }, update: { ...meta, lastRetrievedAt: now, lastError: "" } });
  const existing = new Map((await db.marketObservation.findMany({ where: { seriesId: series.id, period: { in: result.observations.map((o) => o.period) } } })).map((o) => [o.period, o]));
  const fresh = result.observations.filter((o) => !existing.has(o.period));
  const revised = result.observations.filter((o) => {
    const e = existing.get(o.period);
    return e && !new Prisma.Decimal(o.value).equals(e.value);
  });
  await db.$transaction([
    db.marketObservation.createMany({ data: fresh.map((o) => ({ seriesId: series.id, period: o.period, periodStart: o.periodStart, periodEnd: o.periodEnd, value: o.value, retrievedAt: now, requestUrl: result.requestUrl })), skipDuplicates: true }),
    ...revised.map((o) => db.marketObservation.update({ where: { seriesId_period: { seriesId: series.id, period: o.period } }, data: { value: o.value, retrievedAt: now, requestUrl: result.requestUrl } })),
  ]);
  return fresh.length + revised.length;
}

async function ingestSeriesProvider(id: SeriesDef["provider"], fetchImpl: Fetch, now: Date) {
  const source = await ensureSource(id);
  let items = 0;
  const failures: string[] = [];
  const defs = SERIES.filter((s) => s.provider === id);
  for (const def of defs) {
    try {
      items += await storeSeries(def, source.id, await fetchSeries(def, fetchImpl, now), now);
    } catch (e) {
      const message = (e as Error).message.slice(0, 500);
      failures.push(`${def.label}: ${message}`);
      await db.marketSeries.updateMany({ where: { key: def.key }, data: { lastError: message } });
    }
  }
  const status = failures.length === defs.length ? "FAILED" : "OK";
  const message = failures.length ? `${defs.length - failures.length} of ${defs.length} series updated. ${failures.join(" | ")}` : `${defs.length} series checked.`;
  return { status, message, items } as const;
}

/** The latest complete inventory year: two years back unless CLIMATE_TRACE_YEAR says otherwise. */
export function climateTraceYear(now: Date): number {
  const set = Number(process.env.CLIMATE_TRACE_YEAR);
  return Number.isInteger(set) && set > 2000 ? set : now.getUTCFullYear() - 2;
}

async function ingestRefineries(fetchImpl: Fetch, now: Date) {
  const source = await ensureSource("climate-trace");
  const year = climateTraceYear(now);
  let items = 0;
  // The global refining inventory is a few thousand assets at most; the page cap guards against a runaway loop.
  for (let page = 0; page < 60; page++) {
    const url = climateTraceUrl(year, page * CLIMATE_TRACE_PAGE);
    const assets = parseClimateTrace(await getJson(fetchImpl, url));
    for (const a of assets) {
      const data = { ...a, emissionsYear: a.emissionsTCo2e === null ? null : year, sourceId: source.id, sourceUrl: url, retrievedAt: now };
      await db.refineryAsset.upsert({ where: { provider_externalId: { provider: "climate-trace", externalId: a.externalId } }, create: { provider: "climate-trace", ...data }, update: data });
    }
    items += assets.length;
    if (assets.length < CLIMATE_TRACE_PAGE) break;
  }
  return { status: "OK", message: `${items} refineries checked (emissions year ${year}).`, items } as const;
}

async function ingestNewsLeads(fetchImpl: Fetch, now: Date) {
  await ensureSource("gdelt");
  // Fictional demo companies never get real-world news.
  const companies = await db.company.findMany({ where: { isFictional: false, NOT: { newsQuery: "" } } });
  if (companies.length === 0) return { status: "OK", message: "No company has a news query set.", items: 0 } as const;
  let items = 0;
  const failures: string[] = [];
  for (const c of companies) {
    try {
      const leads = parseGdelt(await getJson(fetchImpl, gdeltUrl(c.newsQuery)));
      const r = await db.newsLead.createMany({ data: leads.map((l) => ({ ...l, companyId: c.id, provider: "gdelt", retrievedAt: now })), skipDuplicates: true });
      items += r.count;
    } catch (e) {
      failures.push(`${c.shortName}: ${(e as Error).message.slice(0, 300)}`);
    }
  }
  const status = failures.length === companies.length ? "FAILED" : "OK";
  return { status, message: failures.length ? failures.join(" | ") : `${items} new leads for ${companies.length} companies.`, items } as const;
}

/**
 * Pulls every available open-data feed once. Each provider runs independently, so one failing API never blocks the
 * others, and every attempt is recorded as an IngestionRun.
 */
export async function runOpenDataIngestion(opts: { providers?: ProviderId[]; fetchImpl?: Fetch; now?: Date; actorId?: string } = {}): Promise<RunSummary[]> {
  const fetchImpl = opts.fetchImpl ?? ((url, init) => fetch(url, init));
  const status = openDataStatus();
  const out: RunSummary[] = [];
  for (const id of PROVIDER_ORDER) {
    if (opts.providers && !opts.providers.includes(id)) continue;
    const now = opts.now ?? new Date();
    const run = await db.ingestionRun.create({ data: { provider: id, status: "RUNNING", startedAt: now } });
    let result: { status: RunSummary["status"]; message: string; items: number };
    if (!status[id].available) {
      result = { status: "SKIPPED", message: status[id].reason, items: 0 };
    } else {
      try {
        result = id === "gdelt" ? await ingestNewsLeads(fetchImpl, now) : id === "climate-trace" ? await ingestRefineries(fetchImpl, now) : await ingestSeriesProvider(id, fetchImpl, now);
      } catch (e) {
        result = { status: "FAILED", message: (e as Error).message.slice(0, 1000), items: 0 };
      }
    }
    await db.ingestionRun.update({ where: { id: run.id }, data: { status: result.status, message: result.message, itemsUpserted: result.items, finishedAt: new Date() } });
    if (result.status !== "SKIPPED") await audit(opts.actorId ?? null, "opendata.ingest", "IngestionRun", run.id, { provider: id, status: result.status, items: result.items });
    out.push({ provider: id, status: result.status, message: result.message, itemsUpserted: result.items });
  }
  return out;
}

/** True when the last attempt for any available feed is older than the interval, so the worker should run again. */
export async function ingestionDue(intervalMs: number, now = new Date()): Promise<boolean> {
  const status = openDataStatus();
  const active = PROVIDER_ORDER.filter((p) => status[p].available);
  if (active.length === 0) return false;
  const last = await db.ingestionRun.findFirst({ where: { provider: { in: active } }, orderBy: { startedAt: "desc" } });
  return !last || now.getTime() - last.startedAt.getTime() >= intervalMs;
}

/** Queues one ingestion job when feeds are due and none is already waiting. Used by the worker loop. */
export async function scheduleIngestionIfDue(intervalMs: number): Promise<boolean> {
  if (!(await ingestionDue(intervalMs))) return false;
  const pending = await db.job.count({ where: { type: "opendata.ingest", status: { in: ["QUEUED", "RUNNING"] } } });
  if (pending > 0) return false;
  await enqueue("opendata.ingest", {});
  return true;
}
