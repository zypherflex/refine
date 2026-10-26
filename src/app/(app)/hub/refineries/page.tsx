import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listRefineries } from "@/server/hub/business";
import { LOCATIONS, NIGERIAN_STATES, OTHER_LOCATIONS } from "@/lib/hub/catalog";
import { DemoTag, VerificationBadge } from "@/components/hub/parts";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Refineries on the hub" };

export default async function HubRefineriesPage({ searchParams }: { searchParams: Promise<{ state?: string; verified?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const state = LOCATIONS.includes(sp.state ?? "") ? sp.state! : "";
  const verifiedOnly = sp.verified === "1";
  const refineries = await listRefineries(user, { state, verifiedOnly });
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub">← Trade hub</Link></p>
      <PageHeader
        eyebrow="Trade hub"
        title="Refineries"
        subtitle="Refineries with their own RefineryLens accounts, from large complexes to modular plants. They post product offers and feedstock needs themselves. A refinery's name appears here only once it has signed up; well-known refiners stay hidden until RefineryLens has verified the account."
        actions={<Link href="/refineries" className="btn-secondary btn-sm no-underline">Global refinery directory</Link>}
      />
      <form method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-ink-100 bg-white p-4" role="search" aria-label="Filter refineries">
        <div>
          <label htmlFor="state" className="label">Location</label>
          <select id="state" name="state" className="input" defaultValue={state}>
            <option value="">Anywhere</option>
            <optgroup label="Nigeria">{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Outside Nigeria">{OTHER_LOCATIONS.map((s) => <option key={s}>{s}</option>)}</optgroup>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="verified" value="1" defaultChecked={verifiedOnly} /> Verified only</label>
        <button className="btn-primary">Show</button>
      </form>
      {refineries.length === 0 ? (
        <EmptyState title="No refineries match">Refineries appear here once they set up a business profile with the refinery role.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {refineries.map((r) => (
            <li key={r.id} className="card">
              <div className="flex flex-wrap items-center gap-1.5"><VerificationBadge v={r.verification} />{r.isDemo && <DemoTag />}</div>
              <h2 className="mt-2 text-base font-semibold"><Link href={`/hub/businesses/${r.id}`}>{r.name}</Link></h2>
              <p className="text-sm text-ink-700">{[r.city, r.state].filter(Boolean).join(", ")}</p>
              {r.capacityBpd && <p className="mt-1 text-sm">Stated capacity {r.capacityBpd.toLocaleString("en-GB")} bpd</p>}
              <p className="mt-2 text-xs text-ink-600">{r._count.listings} live listing{r._count.listings === 1 ? "" : "s"}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8"><Notice title="Not affiliated">RefineryLens is not affiliated with Dangote or any refinery listed here. A refinery's offers are its own; check terms directly with it.</Notice></div>
    </>
  );
}
