import Link from "next/link";
import { requireUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { crack321, CRACK_321_FORMULA, latestChange, type DatedValue } from "@/lib/market";
import { integrationStatus } from "@/server/integrations";
import { listMarketSeries, type MarketSeriesView } from "@/server/services/market";
import { PROVIDERS, SERIES, type SeriesDef } from "@/server/opendata/catalog";
import { MarketChart } from "@/components/MarketChart";
import { Explainer, Notice, PageHeader, Pill, ProvenanceBadge, SourceLink, Unavailable } from "@/components/ui";

export const metadata = { title: "Market & macro context" };

const points = (s: MarketSeriesView): DatedValue[] => s.observations.map((o) => ({ period: o.period, value: Number(o.value) }));

function fmtValue(v: number, unit: string) {
  if (unit === "current USD") return `USD ${fmtNumber(v / 1e9, 1)} bn`;
  return `${fmtNumber(v, 2)} ${unit}`;
}

function Change({ pts, unit }: { pts: DatedValue[]; unit: string }) {
  const c = latestChange(pts);
  if (!c?.previous || c.diff === null) return null;
  const sign = c.diff > 0 ? "+" : c.diff < 0 ? "−" : "±";
  return <span className="text-xs text-ink-600">{sign}{fmtNumber(Math.abs(c.diff), 2)}{unit.startsWith("%") ? " pts" : ""}{c.pct !== null && !unit.startsWith("%") ? ` (${sign}${fmtNumber(Math.abs(c.pct), 1)}%)` : ""} vs {c.previous.period}</span>;
}

function SeriesCard({ def, s, staff, available, reason }: { def: SeriesDef; s?: MarketSeriesView; staff: boolean; available: boolean; reason: string }) {
  const provider = PROVIDERS[def.provider];
  const pts = s ? points(s) : [];
  const last = pts[pts.length - 1];
  // Values written by the demo seed are never credited to the real publisher.
  const demo = !!s?.source.name.startsWith("Demo market data");
  return (
    <section className="card" aria-labelledby={`h-${def.key}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill className="bg-ink-100 text-ink-800">{def.geography}</Pill>
        <Pill className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{def.frequency.toLowerCase()}</Pill>
        {s && <ProvenanceBadge p={s.source.provenance} />}
        {demo && <Pill className="bg-amber-100 text-amber-800">Demo values, not real data</Pill>}
        {s && !s.source.approved && <Pill className="bg-amber-100 text-amber-800">Source awaiting editorial approval: hidden from readers</Pill>}
      </div>
      <h3 id={`h-${def.key}`} className="mt-2 font-semibold text-ink-950">{def.label}</h3>
      <p className="muted mt-0.5">{def.description}</p>
      {last ? (
        <>
          <p className="mt-3 flex flex-wrap items-baseline gap-x-3"><span className="num text-2xl font-semibold tracking-tight text-ink-950">{fmtValue(last.value, def.unit)}</span><span className="text-xs text-ink-700">{last.period}</span><Change pts={pts} unit={def.unit} /></p>
          <MarketChart title={def.label} unit={def.unit} points={pts} />
          {demo ? (
            <p className="mt-2 text-xs text-amber-800">Sample values written by the demo seed, not published by {provider.publisher}. Real values replace them once the feed runs.</p>
          ) : (
            <p className="mt-2 text-xs text-ink-700">
              <SourceLink href={s!.sourcePageUrl || provider.homepageUrl}>{provider.publisher}</SourceLink> · retrieved {fmtDateTime(s!.lastRetrievedAt)} · <a href={provider.attributionUrl} target="_blank" rel="noopener noreferrer">{provider.attribution}</a>
            </p>
          )}
          {staff && s!.lastError && <p className="mt-1 text-xs text-risk-800">Last refresh failed: {s!.lastError}</p>}
        </>
      ) : (
        <div className="mt-3">
          {!available ? (
            <Unavailable title="Feed not connected">{staff ? `${provider.name}: ${reason}.` : "This data feed is not connected in this installation."}</Unavailable>
          ) : s ? (
            <Unavailable title="No data retrieved yet">{staff && s.lastError ? `Last attempt failed: ${s.lastError}` : "The feed is connected but has not returned values for this series yet."}</Unavailable>
          ) : (
            <Unavailable title="Not available yet">{staff ? "No data has been retrieved. Run the ingestion from Administration or with npm run ingest." : "Not yet retrieved, or its source is still being reviewed by an editor."}</Unavailable>
          )}
        </div>
      )}
    </section>
  );
}

export default async function MarketPage() {
  const user = await requireUser();
  const staff = can.viewEditorial(user);
  const [series, st] = [await listMarketSeries(user), integrationStatus().openData];
  const byKey = new Map(series.map((s) => [s.key, s]));
  const card = (def: SeriesDef) => <SeriesCard key={def.key} def={def} s={byKey.get(def.key)} staff={staff} available={st[def.provider].available} reason={st[def.provider].reason} />;
  const global = SERIES.filter((d) => d.contextScope === "GLOBAL_MARKET");
  const nigeria = SERIES.filter((d) => d.contextScope === "NIGERIA_MACRO");

  const brent = byKey.get("eia.brent_spot");
  const gas = byKey.get("eia.gulf_gasoline_spot");
  const ulsd = byKey.get("eia.gulf_ulsd_spot");
  const crack = brent && gas && ulsd ? crack321(points(brent), points(gas), points(ulsd)) : [];
  const crackLast = crack[crack.length - 1];

  return (
    <>
      <PageHeader eyebrow="Research" title="Market & macro context" subtitle="Oil benchmarks, product prices and Nigerian macro data from free public sources, each with its publisher, period, units and retrieval time." />
      <div className="mb-6"><Notice title="Context, not company data">This page is the same whichever company you are researching. Benchmark prices, national statistics and exchange rates describe the market a refinery operates in. They are not disclosures by any company and are never mixed into company figures.</Notice></div>

      <h2 className="h-section mb-3">Global oil market</h2>
      <section className="card mb-4" aria-labelledby="h-crack">
        <div className="flex flex-wrap items-center gap-1.5"><Pill className="bg-ink-100 text-ink-800">Atlantic basin benchmark</Pill><ProvenanceBadge p="ANALYST_ESTIMATE" /></div>
        <h3 id="h-crack" className="mt-2 font-semibold text-ink-950">Indicative 3-2-1 crack spread</h3>
        <p className="muted mt-0.5">The gross value of turning three barrels of Brent into two of gasoline and one of diesel at US Gulf Coast prices. A benchmark for refining economics, not any refiner&apos;s realised margin.</p>
        {crackLast ? (
          <>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3"><span className="num text-2xl font-semibold tracking-tight text-ink-950">{fmtNumber(crackLast.value, 2)} USD/bbl</span><span className="text-xs text-ink-700">{crackLast.period}</span><Change pts={crack} unit="USD/bbl" /></p>
            <MarketChart title="Indicative 3-2-1 crack spread" unit="USD/bbl" points={crack} />
          </>
        ) : (
          <div className="mt-3"><Unavailable title="Not available yet">Needs Brent, Gulf Coast gasoline and Gulf Coast diesel prices for the same days.</Unavailable></div>
        )}
        <Explainer title="How this is calculated">
          <p>Formula: {CRACK_321_FORMULA}. Calculated by RefineryLens from EIA spot prices on dates where all three are published.</p>
          <p>A real refinery&apos;s margin also depends on its product yields, the discount or premium it pays for crude, freight, and operating costs. Treat this as a direction-of-travel indicator for the sector.</p>
        </Explainer>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">{global.map(card)}</div>

      <h2 className="h-section mb-3 mt-8">Nigeria macro context</h2>
      <p className="muted -mt-2 mb-3">National statistics and exchange rates. Useful for reading a Nigerian refiner&apos;s naira revenues, dollar costs and the import market it competes with.</p>
      <div className="grid gap-4 lg:grid-cols-2">{nigeria.map(card)}</div>

      <section className="card mt-8">
        <h2 className="h-section">About these feeds</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {(["eia", "worldbank", "exchangerate-api"] as const).map((id) => (
            <li key={id}><span className="font-medium">{PROVIDERS[id].publisher}.</span> {PROVIDERS[id].licenseNotes} <SourceLink href={PROVIDERS[id].homepageUrl}>Source</SourceLink></li>
          ))}
        </ul>
        <p className="mt-3 text-sm">For refinery capacities and emissions around the world, see the <Link href="/refineries">global refinery directory</Link>.</p>
      </section>
    </>
  );
}
