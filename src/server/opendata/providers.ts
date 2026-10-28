import type { SeriesDef } from "./catalog";

/**
 * Request builders and response parsers for each open-data API. Parsers are pure so they can be tested against
 * recorded responses; network access goes through an injectable fetch.
 */
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export type Observation = { period: string; periodStart: Date; periodEnd: Date; value: number };
export type SeriesResult = { observations: Observation[]; requestUrl: string };
export type Asset = { externalId: string; name: string; countryCode: string; assetType: string; capacityBpd: number | null; owners: string[]; lat: number | null; lon: number | null; emissionsTCo2e: number | null };

export class ProviderError extends Error {}

/** Removes API keys from a URL before it is stored or shown. */
export function redactUrl(url: string): string {
  return url.replace(/([?&](?:api_key|apikey|key|token)=)[^&]*/gi, "$1REDACTED");
}

export async function getJson(fetchImpl: Fetch, url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "RefineryLens/0.1 (open-data ingestion)" }, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new ProviderError(`Request failed: ${(e as Error).message}`);
  }
  const text = await res.text();
  if (!res.ok) throw new ProviderError(`HTTP ${res.status} from ${new URL(url).host}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError(`Unexpected non-JSON response from ${new URL(url).host}: ${text.slice(0, 200)}`);
  }
}

// --- Periods ---

const DAY = 86_400_000;

/** Turns a publisher period label into an inclusive UTC date range. Returns null for labels it does not recognise. */
export function parsePeriod(period: string): { periodStart: Date; periodEnd: Date } | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return { periodStart: d, periodEnd: d };
  }
  m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) return { periodStart: new Date(Date.UTC(+m[1], +m[2] - 1, 1)), periodEnd: new Date(Date.UTC(+m[1], +m[2], 1) - DAY) };
  m = /^(\d{4})$/.exec(period);
  if (m) return { periodStart: new Date(Date.UTC(+m[1], 0, 1)), periodEnd: new Date(Date.UTC(+m[1], 11, 31)) };
  return null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function observation(period: unknown, value: unknown): Observation | null {
  const p = String(period ?? "");
  const range = parsePeriod(p);
  const n = toNumber(value);
  if (!range || n === null) return null;
  return { period: p, ...range, value: n };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

// --- EIA ---

export function eiaUrl(def: SeriesDef, apiKey: string, now: Date): string {
  const p = def.params;
  const q = new URLSearchParams();
  q.set("frequency", def.frequency.toLowerCase());
  q.append("data[0]", "value");
  if (p.route === "international") {
    for (const f of ["productId", "activityId", "countryRegionId", "unit"]) q.append(`facets[${f}][]`, p[f]);
    q.set("start", iso(new Date(now.getTime() - 3 * 365 * DAY)).slice(0, 7));
  } else {
    q.append(`facets[${p.facet}][]`, p.value);
    q.set("start", iso(new Date(now.getTime() - 400 * DAY)));
  }
  q.append("sort[0][column]", "period");
  q.append("sort[0][direction]", "desc");
  q.set("length", "500");
  q.set("api_key", apiKey);
  return `https://api.eia.gov/v2/${p.route}/data/?${q.toString()}`;
}

export function parseEia(json: unknown): Observation[] {
  const j = json as { error?: unknown; response?: { data?: { period?: unknown; value?: unknown }[] } };
  if (j?.error) throw new ProviderError(`EIA error: ${typeof j.error === "string" ? j.error : JSON.stringify(j.error)}`);
  const rows = j?.response?.data;
  if (!Array.isArray(rows)) throw new ProviderError("EIA response had no data array");
  return rows.map((r) => observation(r.period, r.value)).filter((o): o is Observation => o !== null);
}

// --- World Bank ---

export function worldBankUrl(def: SeriesDef): string {
  return `https://api.worldbank.org/v2/country/${def.params.country}/indicator/${def.params.indicator}?format=json&per_page=40&mrv=25`;
}

export function parseWorldBank(json: unknown): Observation[] {
  if (!Array.isArray(json)) throw new ProviderError("World Bank response was not an array");
  const [meta, rows] = json as [{ message?: { value?: string }[] }, { date?: unknown; value?: unknown }[] | null];
  if (meta?.message) throw new ProviderError(`World Bank error: ${meta.message.map((m) => m.value).join("; ")}`);
  if (!rows) return [];
  return rows.map((r) => observation(r.date, r.value)).filter((o): o is Observation => o !== null);
}

// --- ExchangeRate-API ---

export function fxUrl(def: SeriesDef): string {
  return `https://open.er-api.com/v6/latest/${def.params.base}`;
}

export function parseFx(json: unknown, quote: string): Observation[] {
  const j = json as { result?: string; "error-type"?: string; time_last_update_unix?: number; rates?: Record<string, number> };
  if (j?.result !== "success") throw new ProviderError(`ExchangeRate-API error: ${j?.["error-type"] ?? "unknown"}`);
  const rate = j.rates?.[quote];
  if (typeof rate !== "number" || !j.time_last_update_unix) throw new ProviderError(`ExchangeRate-API response had no ${quote} rate`);
  const o = observation(iso(new Date(j.time_last_update_unix * 1000)), rate);
  return o ? [o] : [];
}

// --- Climate TRACE ---

export const CLIMATE_TRACE_PAGE = 100;

export function climateTraceUrl(year: number, offset: number, countries?: string[]): string {
  const q = new URLSearchParams({ subsectors: "oil-and-gas-refining", year: String(year), limit: String(CLIMATE_TRACE_PAGE), offset: String(offset) });
  if (countries?.length) q.set("countries", countries.join(","));
  return `https://api.climatetrace.org/v6/assets?${q.toString()}`;
}

/** Capacity is only kept when the inventory states it in barrels per day, so units are never mixed. */
export function parseClimateTrace(json: unknown): Asset[] {
  const assets = (json as { assets?: Record<string, any>[] })?.assets;
  if (!Array.isArray(assets)) throw new ProviderError("Climate TRACE response had no assets array");
  const out: Asset[] = [];
  for (const a of assets) {
    if (a.Id === undefined || !a.Name) continue;
    const summary: Record<string, any>[] = Array.isArray(a.EmissionsSummary) ? a.EmissionsSummary : [];
    const co2e = summary.find((e) => e.Gas === "co2e_100yr");
    const withCapacity = summary.find((e) => /bbl per day/i.test(String(e.CapacityUnits ?? "")) && toNumber(e.Capacity) !== null);
    const owners = [...new Set(((a.Owners as { CompanyName?: string | null }[] | null) ?? []).map((o) => o?.CompanyName).filter((n): n is string => !!n))];
    const [lon, lat] = Array.isArray(a.Centroid?.Geometry) ? a.Centroid.Geometry : [null, null];
    out.push({
      externalId: String(a.Id),
      name: String(a.Name).slice(0, 300),
      countryCode: String(a.Country ?? ""),
      assetType: String(a.AssetType ?? ""),
      capacityBpd: withCapacity ? toNumber(withCapacity.Capacity) : null,
      owners,
      lat: toNumber(lat),
      lon: toNumber(lon),
      emissionsTCo2e: co2e ? toNumber(co2e.EmissionsQuantity) : null,
    });
  }
  return out;
}
