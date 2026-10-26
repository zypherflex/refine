import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SERIES } from "@/server/opendata/catalog";
import { climateTraceUrl, eiaUrl, gdeltUrl, parseClimateTrace, parseEia, parseFx, parseGdelt, parsePeriod, parseWorldBank, redactUrl, ProviderError } from "@/server/opendata/providers";
import { crack321, latestChange } from "@/lib/market";
import { openDataStatus } from "@/server/integrations";

const fixture = (name: string) => JSON.parse(readFileSync(path.join(__dirname, "../fixtures/opendata", name), "utf8"));
const def = (key: string) => SERIES.find((s) => s.key === key)!;

describe("open-data parsers", () => {
  it("reads EIA spot prices and skips missing values instead of inventing them", () => {
    const obs = parseEia(fixture("eia-spot.json"));
    expect(obs.map((o) => [o.period, o.value])).toEqual([["2026-10-20", 70.1], ["2026-10-17", 69.5], ["2026-10-15", 68.9]]);
    expect(obs[0].periodStart.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  it("reads EIA monthly international data and drops placeholder values", () => {
    const obs = parseEia(fixture("eia-intl.json"));
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({ period: "2026-06", value: 1550.2 });
    expect(obs[0].periodEnd.toISOString().slice(0, 10)).toBe("2026-06-30");
  });

  it("surfaces EIA errors", () => {
    expect(() => parseEia({ error: "invalid api_key" })).toThrow(ProviderError);
  });

  it("reads World Bank annual indicators and reports API errors", () => {
    expect(parseWorldBank(fixture("worldbank.json")).map((o) => [o.period, o.value])).toEqual([["2025", 1500.5], ["2024", 1450.25]]);
    expect(() => parseWorldBank(fixture("worldbank-error.json"))).toThrow(/not valid/);
  });

  it("dates the exchange rate by the provider's update time", () => {
    const [o] = parseFx(fixture("fx.json"), "NGN");
    expect(o).toMatchObject({ period: "2026-10-22", value: 1525.75 });
    expect(() => parseFx({ result: "error", "error-type": "unsupported-code" }, "NGN")).toThrow(/unsupported-code/);
  });

  it("keeps refinery capacity only when stated in barrels per day, and de-duplicates owners", () => {
    const [a, b, ...rest] = parseClimateTrace(fixture("climatetrace.json"));
    expect(rest).toHaveLength(0);
    expect(a).toMatchObject({ externalId: "1001", countryCode: "NGA", assetType: "Medium Conversion", capacityBpd: 500000, owners: ["Test Owner Ltd"], lat: 6.45, lon: 3.99, emissionsTCo2e: 2000000.5 });
    expect(b).toMatchObject({ capacityBpd: null, owners: [], emissionsTCo2e: 80000 });
  });

  it("keeps only well-formed news leads", () => {
    const leads = parseGdelt(fixture("gdelt.json"));
    expect(leads.map((l) => l.url)).toEqual(["https://news.example.org/a", "https://news.example.org/b"]);
    expect(leads[0].seenAt.toISOString()).toBe("2026-10-20T10:15:00.000Z");
    expect(parseGdelt({})).toEqual([]);
  });

  it("parses publisher period labels", () => {
    expect(parsePeriod("2025")?.periodEnd.toISOString().slice(0, 10)).toBe("2025-12-31");
    expect(parsePeriod("2024-02")?.periodEnd.toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(parsePeriod("Q3 2025")).toBeNull();
  });
});

describe("open-data requests", () => {
  it("builds EIA requests for the spot and international routes and never stores the key", () => {
    const now = new Date("2026-10-26T00:00:00Z");
    const spot = new URL(eiaUrl(def("eia.brent_spot"), "secret", now));
    expect(spot.pathname).toBe("/v2/petroleum/pri/spt/data/");
    expect(spot.searchParams.get("facets[series][]")).toBe("RBRTE");
    expect(spot.searchParams.get("frequency")).toBe("daily");
    expect(new URL(eiaUrl(def("eia.us_refinery_utilization"), "k", now)).searchParams.get("frequency")).toBe("weekly");
    const intl = new URL(eiaUrl(def("eia.nigeria_crude_production"), "k", now));
    expect(intl.searchParams.get("facets[countryRegionId][]")).toBe("NGA");
    expect(intl.searchParams.get("start")).toBe("2023-10");
    expect(redactUrl(spot.toString())).not.toContain("secret");
    expect(redactUrl("https://x.test/?a=1&api_key=abc&b=2")).toBe("https://x.test/?a=1&api_key=REDACTED&b=2");
  });

  it("asks Climate TRACE for refining assets only, page by page", () => {
    const u = new URL(climateTraceUrl(2024, 200, ["NGA"]));
    expect(u.searchParams.get("subsectors")).toBe("oil-and-gas-refining");
    expect(u.searchParams.get("offset")).toBe("200");
    expect(u.searchParams.get("countries")).toBe("NGA");
    expect(new URL(gdeltUrl('"Test Co refinery"')).searchParams.get("mode")).toBe("artlist");
  });
});

describe("market calculations", () => {
  it("computes the indicative 3-2-1 crack only on dates with all three prices", () => {
    const brent = [{ period: "2026-10-19", value: 70 }, { period: "2026-10-20", value: 72 }];
    const gas = [{ period: "2026-10-20", value: 2.1 }];
    const ulsd = [{ period: "2026-10-20", value: 2.4 }, { period: "2026-10-19", value: 2.3 }];
    // (2 × 2.1 × 42 + 2.4 × 42 − 3 × 72) / 3 = (176.4 + 100.8 − 216) / 3 = 20.4
    expect(crack321(brent, gas, ulsd)).toEqual([{ period: "2026-10-20", value: 20.4 }]);
  });

  it("reports the change from the previous observation", () => {
    const c = latestChange([{ period: "2026-10-20", value: 110 }, { period: "2026-10-19", value: 100 }]);
    expect(c).toMatchObject({ diff: 10, pct: 10, previous: { period: "2026-10-19" } });
    expect(latestChange([])).toBeNull();
  });
});

describe("open-data status", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it("turns keyless feeds on by default and needs a key for EIA", () => {
    delete process.env.OPEN_DATA_FEEDS;
    delete process.env.EIA_API_KEY;
    const s = openDataStatus();
    expect(s.worldbank.available).toBe(true);
    expect(s["climate-trace"].available).toBe(true);
    expect(s.eia).toEqual({ enabled: true, available: false, reason: "Needs EIA_API_KEY" });
    process.env.EIA_API_KEY = "k";
    expect(openDataStatus().eia.available).toBe(true);
  });

  it("honours OPEN_DATA_FEEDS", () => {
    process.env.OPEN_DATA_FEEDS = "worldbank, gdelt";
    const s = openDataStatus();
    expect(s.worldbank.available).toBe(true);
    expect(s["exchangerate-api"]).toMatchObject({ enabled: false, available: false });
    process.env.OPEN_DATA_FEEDS = "none";
    expect(Object.values(openDataStatus()).some((p) => p.enabled)).toBe(false);
  });
});
