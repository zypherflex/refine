import Link from "next/link";
import { Sponsored } from "@/components/Sponsored";
import { Plus, Search } from "lucide-react";
import type { OutletKind } from "@prisma/client";
import { getCurrentUser } from "@/server/auth";
import { listOutlets } from "@/server/everyday/outlets";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { naira } from "@/lib/hub/prices";
import { EVERYDAY_LABEL, OUTLET_KINDS, outletKindLabel, queueLabel } from "@/lib/everyday";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Stations and gas shops", description: "Filling stations, gas shops and CNG stations with prices and queues reported by people nearby." };

function ago(d: Date, now = Date.now()) {
  const m = Math.round((now - d.getTime()) / 60_000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} days ago`;
}

export default async function StationsPage({ searchParams }: { searchParams: Promise<{ state?: string; kind?: string; q?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const state = (NIGERIAN_STATES as readonly string[]).includes(sp.state ?? "") ? sp.state! : user?.homeState ?? "Lagos";
  const kind = OUTLET_KINDS.some((k) => k.id === sp.kind) ? (sp.kind as OutletKind) : undefined;
  const outlets = await listOutlets({ state, kind, q: sp.q });
  const qs = (k?: string) => `/stations?${new URLSearchParams({ state, ...(k ? { kind: k } : {}), ...(sp.q ? { q: sp.q } : {}) })}`;

  return (
    <>
      <PageHeader eyebrow="Everyday" title="Stations and gas shops" subtitle={`Prices, queues and problems people reported in ${state}. Tap a place to see more or report what you found.`} actions={<Link href={user ? `/stations/new?state=${encodeURIComponent(state)}` : "/login?next=/stations/new"} className="btn-primary btn-sm no-underline"><Plus size={16} aria-hidden /> Add a place</Link>} />
      <form className="mb-4 flex flex-wrap gap-2" action="/stations">
        <label htmlFor="s-state" className="sr-only">State</label>
        <select id="s-state" name="state" defaultValue={state} className="input w-auto">{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select>
        {kind && <input type="hidden" name="kind" value={kind} />}
        <label htmlFor="s-q" className="sr-only">Search</label>
        <input id="s-q" name="q" defaultValue={sp.q ?? ""} placeholder="Area, name or brand" className="input w-auto flex-1" />
        <button className="btn-secondary"><Search size={16} aria-hidden /> Search</button>
      </form>
      <nav aria-label="Kind" className="mb-5 flex flex-wrap gap-2">
        {[{ id: "", label: "All" }, ...OUTLET_KINDS].map((k) => (
          <Link key={k.id} href={qs(k.id || undefined)} aria-current={(kind ?? "") === k.id ? "page" : undefined} className={`rounded-full px-3 py-1 text-sm no-underline hover:no-underline ${(kind ?? "") === k.id ? "bg-ink-950 font-medium text-white" : "bg-white text-ink-800 ring-1 ring-inset ring-ink-100"}`}>{k.label}</Link>
        ))}
      </nav>
      {outlets.length === 0 ? (
        <EmptyState title="No places listed here yet" action={<Link href={user ? `/stations/new?state=${encodeURIComponent(state)}` : "/login?next=/stations/new"} className="btn-primary btn-sm no-underline">Add the first one</Link>}>Add the station or gas shop you use, then report what you paid.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {outlets.map((o) => (
            <li key={o.id}>
              <Link href={`/stations/${o.id}`} className="card block h-full no-underline transition hover:shadow-lg hover:no-underline">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink-950">{o.name}</p>
                    <p className="text-xs text-ink-600">{outletKindLabel(o.kind)} · {o.area}{o.brand ? ` · ${o.brand}` : ""}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {o.isDemo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">Demo</span>}
                    {o.problems30d > 0 && <span className="rounded-full bg-risk-50 px-2 py-0.5 text-[11px] font-medium text-risk-700">{o.problems30d} problem{o.problems30d === 1 ? "" : "s"} reported</span>}
                  </div>
                </div>
                {o.prices.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {o.prices.map((p) => <li key={p.item} className="rounded-lg bg-ink-50 px-2.5 py-1.5 text-xs"><span className="text-ink-600">{EVERYDAY_LABEL[p.item]}</span> <span className="num font-semibold text-ink-950">{naira(p.priceNaira)}</span> <span className="text-ink-500">{ago(p.at)}</span></li>)}
                  </ul>
                ) : <p className="mt-3 text-xs text-ink-500">No prices in the last 3 days</p>}
                {o.availability.length > 0 && (
                  <p className="mt-2 text-xs text-ink-700">{o.availability.map((a) => `${EVERYDAY_LABEL[a.item]}: ${a.available ? `selling${a.queue ? `, ${queueLabel(a.queue).toLowerCase()}` : ""}` : "not selling"} (${ago(a.at)})`).join(" · ")}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6"><Sponsored placement="stations" state={state} /></div>
    </>
  );
}
