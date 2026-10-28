import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { runOpenDataIngestion, scheduleIngestionIfDue } from "@/server/opendata/ingest";
import { getMarketSignals, listRefineryAssets, CRACK_KEY } from "@/server/opendata";
import { listMarketSeries } from "@/server/services/market";
import { SERIES } from "@/server/opendata/catalog";
import { company, resetDb, user } from "../helpers";

const text = (name: string) => readFileSync(path.join(__dirname, "../fixtures/opendata", name), "utf8");

/** Routes requests to recorded fixtures by host; `fail` makes a host return an HTTP error. */
function fakeFetch(fail: string[] = [], overrides: Record<string, string> = {}) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const u = new URL(url);
    if (fail.includes(u.host)) return new Response("upstream down", { status: 503 });
    const body =
      u.host === "api.eia.gov" ? (u.pathname.startsWith("/v2/international") ? text("eia-intl.json") : text("eia-spot.json"))
      : u.host === "api.worldbank.org" ? overrides.worldbank ?? text("worldbank.json")
      : u.host === "open.er-api.com" ? text("fx.json")
      : u.host === "api.climatetrace.org" ? text("climatetrace.json")
      : "{}";
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  };
  return { impl, calls };
}

const now = new Date("2026-10-26T06:00:00Z");
const saved = { ...process.env };

describe("open-data ingestion", () => {
  beforeEach(async () => {
    await resetDb();
    process.env = { ...saved, EIA_API_KEY: "test-key" };
    delete process.env.OPEN_DATA_FEEDS;
  });
  afterAll(() => { process.env = { ...saved }; });

  it("stores every series with provenance, behind an unapproved source until an editor approves it", async () => {
    const { impl, calls } = fakeFetch();
    const runs = await runOpenDataIngestion({ fetchImpl: impl, now });
    expect(runs.map((r) => [r.provider, r.status])).toEqual([["eia", "OK"], ["worldbank", "OK"], ["exchangerate-api", "OK"], ["climate-trace", "OK"]]);
    expect(await db.marketSeries.count()).toBe(SERIES.length);

    const obs = await db.marketObservation.findFirst({ where: { series: { key: "eia.brent_spot" }, period: "2026-10-20" }, include: { series: { include: { source: true } } } });
    expect(Number(obs!.value)).toBe(70.1);
    expect(obs!.retrievedAt.toISOString()).toBe(now.toISOString());
    expect(obs!.requestUrl).toContain("api_key=REDACTED");
    expect(obs!.series.unit).toBe("USD/bbl");
    expect(obs!.series.source).toMatchObject({ publisher: "U.S. Energy Information Administration", approved: false, provenance: "REGULATOR_EXCHANGE" });
    expect(calls.every((c) => !c.includes("REDACTED"))).toBe(true);

    const reader = await user("USER");
    const editor = await user("EDITOR");
    expect(await getMarketSignals(["eia.brent_spot"], reader)).toEqual([]);
    expect(await listMarketSeries(reader)).toEqual([]);
    const [staffView] = await getMarketSignals(["eia.brent_spot"], editor);
    expect(staffView).toMatchObject({ value: 70.1, period: "2026-10-20", approved: false, scope: "GLOBAL_MARKET" });

    await db.source.updateMany({ data: { approved: true, approvedAt: now } });
    const signals = await getMarketSignals(["eia.brent_spot", "fx.usd_ngn", "wb.ngn_official_fx", CRACK_KEY, "not.a.series"], reader);
    expect(signals.map((s) => s.key)).toEqual(["eia.brent_spot", "fx.usd_ngn", "wb.ngn_official_fx", CRACK_KEY]);
    expect(signals.find((s) => s.key === "fx.usd_ngn")).toMatchObject({ value: 1525.75, unit: "NGN per USD", scope: "NIGERIA_MACRO", attribution: "Rates by Exchange Rate API" });
    expect(signals.find((s) => s.key === CRACK_KEY)).toMatchObject({ provenance: "ANALYST_ESTIMATE", unit: "USD/bbl" });

    const assets = await listRefineryAssets({ countries: ["nga"] }, reader);
    expect(assets.map((a) => a.name)).toEqual(["Test Coastal Refinery", "Test Modular Refinery"]);
    expect(assets[0]).toMatchObject({ capacityBpd: 500000, emissionsYear: 2024, owners: ["Test Owner Ltd"] });
    expect(await listRefineryAssets({ countries: ["GHA"] }, reader)).toEqual([]);
  });

  it("is idempotent and applies publisher revisions", async () => {
    await runOpenDataIngestion({ fetchImpl: fakeFetch().impl, now, providers: ["worldbank"] });
    const again = await runOpenDataIngestion({ fetchImpl: fakeFetch().impl, now, providers: ["worldbank"] });
    expect(again[0].itemsUpserted).toBe(0);
    const revised = text("worldbank.json").replace("1500.5", "1510");
    const r = await runOpenDataIngestion({ fetchImpl: fakeFetch([], { worldbank: revised }).impl, now, providers: ["worldbank"] });
    expect(r[0].itemsUpserted).toBe(5); // one revised value in each of the five indicators
    const o = await db.marketObservation.findFirst({ where: { series: { key: "wb.ngn_official_fx" }, period: "2025" } });
    expect(Number(o!.value)).toBe(1510);
  });

  it("skips EIA without a key and keeps going when one provider fails", async () => {
    delete process.env.EIA_API_KEY;
    const runs = await runOpenDataIngestion({ fetchImpl: fakeFetch(["api.worldbank.org"]).impl, now });
    expect(runs.find((r) => r.provider === "eia")).toMatchObject({ status: "SKIPPED", message: "Needs EIA_API_KEY" });
    expect(runs.find((r) => r.provider === "worldbank")?.status).toBe("FAILED");
    expect(runs.find((r) => r.provider === "exchangerate-api")?.status).toBe("OK");
    expect(await db.ingestionRun.count({ where: { status: "FAILED" } })).toBe(1);
  });

  it("schedules one refresh job when feeds are due", async () => {
    expect(await scheduleIngestionIfDue(3_600_000)).toBe(true);
    expect(await scheduleIngestionIfDue(3_600_000)).toBe(false);
    expect(await db.job.count({ where: { type: "opendata.ingest" } })).toBe(1);
  });
});
