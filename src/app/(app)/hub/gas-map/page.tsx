import Link from "next/link";
import { requireUser } from "@/server/auth";
import { gasNetwork } from "@/server/hub/gas";
import { GASES, isState, SITE_KINDS, stateName, STATES_BY_NAME } from "@/lib/hub/catalog";
import { SITE_EXPIRED_DAYS, SITE_STALE_DAYS } from "@/lib/hub/rules";
import { Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { GasGridMap } from "@/components/hub/GasGridMap";
import { BusinessName, day } from "@/components/hub/bits";
import { hubT } from "@/server/hub/lang";
import type { HubKey } from "@/lib/i18n/hub";

export const metadata = { title: "Gas network map" };

export default async function GasMapPage({ searchParams }: { searchParams: Promise<{ gas?: string; state?: string }> }) {
  await requireUser();
  const { t } = await hubT();
  const sp = await searchParams;
  const gas = GASES.some((g) => g.id === sp.gas) ? sp.gas! : "LPG";
  const state = sp.state && isState(sp.state) ? sp.state : "";
  const { sites, cells } = await gasNetwork(gas);
  const gaps = cells.filter((c) => c.status === "GAP");
  const here = state ? sites.filter((s) => s.state === state) : [];
  const kindLabel = Object.fromEntries(SITE_KINDS.map((k) => [k.id, k.label]));
  const listed = cells.filter((c) => c.status !== "NO_DATA");

  return (
    <>
      <PageHeader eyebrow={t("hub.eyebrow")} title={t("gas.title")} subtitle={t("gas.subtitle")} actions={<Link href="/hub/my#sites" className="btn-primary btn-sm no-underline">Add a site</Link>} />
      <nav aria-label="Gas" className="mb-5 flex flex-wrap gap-2">
        {GASES.map((g) => <Link key={g.id} href={`/hub/gas-map?gas=${g.id}`} aria-current={g.id === gas ? "page" : undefined} className={`${g.id === gas ? "btn-primary" : "btn-secondary"} btn-sm no-underline`}>{g.label}</Link>)}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section aria-labelledby="map-h" className="card">
          <h2 id="map-h" className="h-section mb-4">{GASES.find((g) => g.id === gas)!.label} by state</h2>
          <GasGridMap cells={cells} gas={gas} selected={state} labels={Object.fromEntries((["SERVED", "DELIVERY_ONLY", "GAP", "NO_DATA"] as const).map((k) => [k, t(`gas.status.${k}` as HubKey)])) as never} />
          <p className="mt-4 text-xs text-ink-600">A tile map: each square is one state, placed roughly where it sits. Sites not reconfirmed in {SITE_STALE_DAYS} days are flagged; after {SITE_EXPIRED_DAYS} days they drop off.</p>
        </section>

        <section aria-labelledby="gaps-h">
          <h2 id="gaps-h" className="h-section">{t("gas.gaps")}</h2>
          {gaps.length ? (
            <ul className="mt-3 space-y-2">
              {gaps.map((c) => (
                <li key={c.state} className="flex items-center justify-between rounded-lg border border-amber-600/30 bg-amber-50 px-3 py-2 text-sm">
                  <Link href={`/hub/gas-map?gas=${gas}&state=${c.state}#state-sites`} className="font-medium text-ink-950">{stateName(c.state)}</Link>
                  <span className="num text-xs text-amber-800">{c.demand} {c.demand === 1 ? "buyer" : "buyers"} waiting · {c.delivery} delivering</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted mt-2">No gaps on the current listings.</p>}
          <p className="mt-3 text-xs text-ink-600">Gaps are where new refill plants, CNG stations and delivery routes are most needed. They reflect what businesses have listed here, not a full survey.</p>

          <h2 className="h-section mt-8">States with listings</h2>
          <div className="table-wrap mt-2">
            <table className="tbl min-w-0">
              <thead><tr><th scope="col">State</th><th scope="col" className="text-right">Supply</th><th scope="col" className="text-right">Delivery</th><th scope="col" className="text-right">Demand</th></tr></thead>
              <tbody>
                {listed.map((c) => (
                  <tr key={c.state}><td><Link href={`/hub/gas-map?gas=${gas}&state=${c.state}#state-sites`}>{stateName(c.state)}</Link></td><td className="num text-right">{c.supply}</td><td className="num text-right">{c.delivery}</td><td className="num text-right">{c.demand}</td></tr>
                ))}
                {listed.length === 0 && <tr><td colSpan={4} className="text-center text-sm text-ink-600">Nothing listed yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section id="state-sites" aria-labelledby="sites-h" className="mt-10">
        <form method="get" className="mb-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="gas" value={gas} />
          <div>
            <label htmlFor="state" className="label">Sites in</label>
            <select id="state" name="state" className="input" defaultValue={state}><option value="">Choose a state</option>{STATES_BY_NAME.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </div>
          <button className="btn-secondary">Show sites</button>
        </form>
        {state && (
          <>
            <SectionHeader id="sites-h" title={`${stateName(state)}: ${t(`gas.status.${cells.find((c) => c.state === state)!.status}` as HubKey)}`} />
            {here.length ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {here.map((s) => (
                  <li key={s.id} className="card">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill className={s.kind === "SUPPLY" ? "bg-ink-800 text-white" : s.kind === "DEMAND" ? "bg-ink-100 text-ink-900" : "bg-ink-50 text-ink-800 ring-1 ring-inset ring-ink-200"}>{kindLabel[s.kind]}</Pill>
                      {s.stale && <Pill className="bg-amber-100 text-amber-800">Not confirmed for {SITE_STALE_DAYS}+ days</Pill>}
                      <h3 className="font-semibold">{s.name}</h3>
                    </div>
                    <p className="mt-1 text-sm text-ink-700">{s.town ? `${s.town} · ` : ""}{s.capacityNote}</p>
                    <p className="mt-2 text-xs text-ink-600">Stated by <BusinessName b={s.business} t={t} /> · last confirmed {day(s.lastConfirmedAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No {gas} sites listed in {stateName(state)}.</p>}
          </>
        )}
      </section>
      <div className="mt-8"><Notice title="Sellers are responsible for their licences">Sites and capacities are stated by the businesses that list them. Sellers remain responsible for NMDPRA licences, safety and product quality; RefineryLens checks documents only for the Verified badge.</Notice></div>
    </>
  );
}
