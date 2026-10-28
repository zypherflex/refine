import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { can } from "@/lib/permissions";
import { fmtDateTime, fmtNumber } from "@/lib/format";
import { integrationStatus } from "@/server/integrations";
import { listRefineryAssets } from "@/server/opendata";
import { PROVIDERS } from "@/server/opendata/catalog";
import { EmptyState, Notice, PageHeader, Pill, SourceLink, Unavailable } from "@/components/ui";

export const metadata = { title: "Global refinery directory" };

/** ECOWAS members plus Cameroon: the regional market a Nigerian refinery can supply by sea or road. */
const WEST_AFRICA = ["NGA", "GHA", "CIV", "SEN", "BEN", "TGO", "NER", "BFA", "MLI", "GIN", "SLE", "LBR", "GMB", "GNB", "CPV", "CMR"];

export default async function RefineriesPage({ searchParams }: { searchParams: Promise<{ region?: string; country?: string; q?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const staff = can.viewEditorial(user);
  const region = sp.region ?? "west-africa";
  const countries = sp.country ? [sp.country] : region === "west-africa" ? WEST_AFRICA : undefined;
  const [assets, countryRows] = await Promise.all([
    listRefineryAssets({ countries, q: sp.q?.trim() || undefined }, user),
    db.refineryAsset.groupBy({ by: ["countryCode"], _count: true, where: staff ? {} : { source: { approved: true } }, orderBy: { countryCode: "asc" } }),
  ]);
  const status = integrationStatus().openData["climate-trace"];
  const p = PROVIDERS["climate-trace"];
  const totalCapacity = assets.reduce((t, a) => t + (a.capacityBpd ?? 0), 0);
  const withCapacity = assets.filter((a) => a.capacityBpd !== null).length;
  const latest = assets.reduce<Date | null>((d, a) => (!d || a.retrievedAt > d ? a.retrievedAt : d), null);
  const unapproved = assets.some((a) => !a.approved);

  return (
    <>
      <PageHeader eyebrow="Markets" title="Global refinery directory" subtitle="Refineries worldwide with type, capacity, owners and estimated emissions, from the Climate TRACE open inventory. Use it to size markets, competitors and partners." />
      <div className="mb-5"><Notice title="Modelled inventory, not company disclosures">Capacities and emissions are Climate TRACE estimates built from satellite and public data. They can differ from what a company reports, and a refinery&apos;s nameplate capacity is not its throughput.</Notice></div>
      {staff && unapproved && <div className="mb-5"><Notice tone="warn">The Climate TRACE source is awaiting editorial approval, so readers do not see this directory yet. <Link href="/editorial/sources">Review sources</Link>.</Notice></div>}

      <form className="card mb-5 grid gap-3 sm:grid-cols-4" method="get">
        <div><label htmlFor="region" className="label">Region</label><select id="region" name="region" defaultValue={region} className="input"><option value="west-africa">West Africa</option><option value="world">World</option></select></div>
        <div><label htmlFor="country" className="label">Country</label><select id="country" name="country" defaultValue={sp.country ?? ""} className="input"><option value="">Any in region</option>{countryRows.map((c) => <option key={c.countryCode} value={c.countryCode}>{c.countryCode} ({c._count})</option>)}</select></div>
        <div><label htmlFor="q" className="label">Name or owner</label><input id="q" name="q" defaultValue={sp.q ?? ""} className="input" /></div>
        <div className="flex items-end"><button className="btn-primary">Show refineries</button></div>
      </form>

      {assets.length === 0 ? (
        !status.available ? (
          <Unavailable title="Feed not connected">{staff ? `${p.name}: ${status.reason}.` : "The refinery inventory is not connected in this installation."}</Unavailable>
        ) : (
          <EmptyState title="No refineries to show">{staff ? "Nothing has been retrieved for this filter. Run the ingestion from Administration or with npm run ingest." : "Not yet retrieved, or the source is still being reviewed by an editor."}</EmptyState>
        )
      ) : (
        <section className="card">
          <p className="text-sm"><span className="num font-semibold">{assets.length}</span> refineries · stated capacity for {withCapacity}, totalling <span className="num font-semibold">{fmtNumber(totalCapacity / 1000, 0)}k bbl/day</span></p>
          <div className="table-wrap mt-3">
            <table className="tbl">
              <thead><tr><th>Refinery</th><th>Country</th><th>Type</th><th className="text-right">Capacity (bbl/day)</th><th>Owners</th><th className="text-right">Emissions (t CO₂e)</th></tr></thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.name}</td>
                    <td>{a.countryCode}</td>
                    <td className="text-xs">{a.assetType || "Not stated"}</td>
                    <td className="num text-right">{a.capacityBpd === null ? <span className="text-ink-500">Not stated</span> : fmtNumber(a.capacityBpd, 0)}</td>
                    <td className="text-xs">{a.owners.length ? a.owners.join(", ") : <span className="text-ink-500">Not stated</span>}</td>
                    <td className="num text-right">{a.emissionsTCo2e === null ? <span className="text-ink-500">Not stated</span> : <>{fmtNumber(a.emissionsTCo2e, 0)}<span className="block text-[11px] text-ink-600">{a.emissionsYear}</span></>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-700"><a href={p.attributionUrl} target="_blank" rel="noopener noreferrer">{p.attribution}</a> · retrieved {fmtDateTime(latest)} · <SourceLink href={p.homepageUrl}>climatetrace.org</SourceLink> · Emissions are 100-year CO₂-equivalent for the year shown.</p>
          <p className="mt-1 text-xs text-ink-600"><Pill className="bg-ink-100 text-ink-800">Changes</Pill> RefineryLens keeps only refining assets, de-duplicates owner names and shows capacity only where it is stated in barrels per day.</p>
        </section>
      )}
    </>
  );
}
