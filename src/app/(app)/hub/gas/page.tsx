import Link from "next/link";
import { Sponsored } from "@/components/Sponsored";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { nearestSupply, networkData } from "@/server/hub/gas";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { allowedSiteKinds, GASES, isSupplyKind, LAYERS, type GasId, type NetworkLayer } from "@/lib/hub/gas";
import { GasMap } from "@/components/hub/GasMap";
import { SiteRow } from "@/components/hub/SiteRow";
import { SafetyNote } from "@/components/hub/parts";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Gas network" };

type Search = Promise<{ gas?: string; layer?: string; state?: string }>;

export default async function GasNetworkPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser();
  const sp = await searchParams;
  const gas = (GASES.some((g) => g.id === sp.gas) ? sp.gas : null) as GasId | null;
  const layer = (LAYERS.some((l) => l.id === sp.layer) ? sp.layer : "supply") as NetworkLayer;
  const state = (NIGERIAN_STATES as readonly string[]).includes(sp.state ?? "") ? sp.state! : "";
  const [{ sites, summary }, mine] = await Promise.all([networkData(user, gas), getMyBusiness(user)]);
  const canAdd = !!mine && allowedSiteKinds(mine.roles).length > 0;

  const href = (p: { gas?: string | null; layer?: string; state?: string }) => {
    const q = new URLSearchParams();
    const g = p.gas === undefined ? gas : p.gas;
    const l = p.layer ?? layer;
    const s = p.state === undefined ? state : p.state;
    if (g) q.set("gas", g);
    if (l !== "supply") q.set("layer", l);
    if (s) q.set("state", s);
    const str = q.toString();
    return `/hub/gas${str ? `?${str}` : ""}#map`;
  };

  const supplySites = sites.filter((s) => s.status === "OPERATING" && isSupplyKind(s.kind));
  const statesWithSupply = summary.filter((r) => r.supply > 0).length;
  const gaps = summary.filter((r) => r.gap);
  const row = summary.find((r) => r.state === state);
  const inState = state ? sites.filter((s) => s.state === state) : [];
  const nearby = state ? nearestSupply(sites, state) : [];
  const product = gas ? GASES.find((g) => g.id === gas)!.hubProduct : "lpg";
  const gasName = gas ? GASES.find((g) => g.id === gas)!.label : "LPG and CNG";
  const gasPhrase = gas ? GASES.find((g) => g.id === gas)!.inSentence : "LPG or CNG";

  return (
    <>
      <PageHeader
        eyebrow="Trade hub"
        title="Gas network"
        subtitle="LPG and CNG supply across Nigeria: terminals, depots, refill plants, retail points and CNG stations run by businesses on the hub, with the hauliers who move gas and the buyers who need it. Find the nearest supply, or see where demand is not being met."
        actions={canAdd ? <Link href="/hub/gas/sites/new" className="btn-primary btn-sm no-underline">Add a site</Link> : <Link href="/hub/me" className="btn-secondary btn-sm no-underline">{mine ? "Add a seller or delivery role to list sites" : "Set up your business"}</Link>}
      />

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Operating supply points", supplySites.length],
          ["States with supply", `${statesWithSupply} of 37`],
          ["Gas truck bases", sites.filter((s) => s.kind === "LOGISTICS_BASE" && s.status === "OPERATING").length],
          ["States with unmet demand", gaps.length],
        ].map(([k, v]) => (
          <div key={k as string} className="card">
            <dt className="text-xs text-ink-600">{k}</dt>
            <dd className="num mt-1 text-2xl font-semibold text-ink-950">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-3 mb-6 text-xs text-ink-600">{gasName} · counts are what businesses on RefineryLens have listed, not the whole Nigerian market.</p>

      <div id="map" className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Gas" className="flex flex-wrap gap-2">
          {[null, ...GASES.map((g) => g.id)].map((g) => (
            <Link key={g ?? "all"} href={href({ gas: g })} aria-current={gas === g ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-sm font-medium no-underline hover:no-underline ${gas === g ? "bg-ink-950 text-white" : "bg-white text-ink-800 ring-1 ring-inset ring-ink-100 hover:bg-ink-50"}`}>
              {g ? GASES.find((x) => x.id === g)!.label : "All gas"}
            </Link>
          ))}
        </nav>
        <nav aria-label="Map layer" className="flex flex-wrap gap-1 rounded-lg bg-ink-50 p-1 ring-1 ring-inset ring-ink-100">
          {LAYERS.map((l) => (
            <Link key={l.id} href={href({ layer: l.id })} aria-current={layer === l.id ? "page" : undefined} title={l.help} className={`rounded-md px-3 py-1 text-sm no-underline hover:no-underline ${layer === l.id ? "bg-white font-semibold text-ink-950 shadow-card" : "text-ink-700 hover:text-ink-950"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="card min-w-0" aria-labelledby="map-h">
          <h2 id="map-h" className="sr-only">Map</h2>
          <GasMap summary={summary} layer={layer} selected={state} hrefFor={(s) => href({ state: s === state ? "" : s })} />
        </section>

        <aside className="space-y-4" aria-labelledby="state-h">
          {!row ? (
            <section className="card">
              <h2 id="state-h" className="h-section">Pick a state</h2>
              <p className="muted">Select a state on the map to see its supply points, the nearest supply in other states, and buyers and hauliers there.</p>
              {gaps.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-ink-900">Unmet demand</p>
                  <ul className="mt-1 flex flex-wrap gap-1.5 text-sm">{gaps.map((g) => <li key={g.state}><Link href={href({ state: g.state, layer: "gaps" })}>{g.state}</Link></li>)}</ul>
                </div>
              )}
            </section>
          ) : (
            <section className="card space-y-4">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="state-h" className="h-section">{row.state}</h2>
                <Link href={href({ state: "" })} className="text-xs">Clear</Link>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[["Supply", row.supply], ["Delivery", row.delivery], ["Buyer requests", row.demand]].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg bg-ink-50 p-2"><dt className="text-[11px] text-ink-600">{k}</dt><dd className="num text-lg font-semibold">{v}</dd></div>
                ))}
              </dl>
              {row.gap && <Notice tone="warn" title="! Gap">Buyers want {gasPhrase} delivered to {row.state}, and no supply point or delivery partner is listed here yet.</Notice>}
              <div className="flex flex-wrap gap-2 text-sm">
                <Link href={`/hub?kind=REQUEST&product=${product}&state=${encodeURIComponent(row.state)}`} className="btn-secondary btn-sm no-underline">Buyer requests here</Link>
                <Link href={`/hub?kind=DELIVERY&product=${product}&state=${encodeURIComponent(row.state)}`} className="btn-secondary btn-sm no-underline">Hauliers serving {row.state}</Link>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Sites in {row.state} ({inState.length})</h3>
                {inState.length === 0 ? <p className="mt-1 text-sm text-ink-600">None listed yet.</p> : <ul className="mt-2 space-y-2">{inState.map((s) => <SiteRow key={s.id} site={s} business={s.business} />)}</ul>}
              </div>
              <div>
                <h3 className="text-sm font-semibold">Nearest supply in other states</h3>
                <p className="text-[11px] text-ink-600">Straight-line distance between state capitals; road distance is longer.{gas ? "" : " Choose a gas above to see only matching supply."}</p>
                {nearby.length === 0 ? <p className="mt-1 text-sm text-ink-600">None listed yet.</p> : <ul className="mt-2 space-y-2">{nearby.map(({ site, km }) => <SiteRow key={site.id} site={site} business={site.business} km={km} />)}</ul>}
              </div>
            </section>
          )}
          <section className="card"><SafetyNote /></section>
        </aside>
      </div>

      <details className="mt-6 rounded-xl border border-ink-100 bg-white">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Table view: every state</summary>
        <div className="table-wrap border-t border-ink-100">
          <table className="tbl">
            <caption className="sr-only">{gasName} network by state</caption>
            <thead><tr><th>State</th><th className="text-right">Supply points</th><th className="text-right">Delivery</th><th className="text-right">Buyer requests</th><th>Gap</th></tr></thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.state}>
                  <td><Link href={href({ state: r.state })}>{r.state}</Link></td>
                  <td className="num text-right">{r.supply}</td>
                  <td className="num text-right">{r.delivery}</td>
                  <td className="num text-right">{r.demand}</td>
                  <td>{r.gap ? "! Unmet demand" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {sites.length === 0 && <div className="mt-6"><EmptyState title="No gas sites listed yet">Sellers, refineries and hauliers add their sites from the trade hub.</EmptyState></div>}
      <div className="mt-6"><Sponsored placement="gas-network" state={state || null} /></div>
    </>
  );
}
