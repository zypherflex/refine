import Link from "next/link";
import { requireUser } from "@/server/auth";
import { myBusiness } from "@/server/hub/business";
import { listJobs, myJobs } from "@/server/hub/jobs";
import { isState, PRODUCTS, productLabel, stateName } from "@/lib/hub/catalog";
import { postJobAction } from "@/app/actions/hub";
import { EmptyState, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { BusinessName, JOB_STATUS, ProductSelect, StateSelect, UnitSelect, day, isoDay, qty } from "@/components/hub/bits";

export const metadata = { title: "Delivery jobs" };


export default async function JobsPage({ searchParams }: { searchParams: Promise<{ state?: string; product?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const state = sp.state && isState(sp.state) ? sp.state : "";
  const product = PRODUCTS.some((p) => p.id === sp.product) ? sp.product! : "";
  const [jobs, me, mine] = await Promise.all([listJobs({ state, product }), myBusiness(user), myJobs(user)]);

  return (
    <>
      <PageHeader eyebrow="Trade hub" title="Delivery jobs" subtitle="Post a load and collect quotes from hauliers. Accept one, and once the product arrives both sides confirm delivery. Confirmed deliveries build each business's record." actions={me ? <a href="#post" className="btn-primary btn-sm no-underline">Post a load</a> : <Link href="/hub/my" className="btn-primary btn-sm no-underline">Add your business to post</Link>} />

      {(mine.posted.length > 0 || mine.quoted.length > 0) && (
        <section aria-labelledby="mine-h" className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-ink-100 bg-ink-50 p-4">
            <h2 id="mine-h" className="h-section">Loads you posted</h2>
            <ul className="mt-2 space-y-1 text-sm">{mine.posted.map((j) => <li key={j.id}><Link href={`/hub/jobs/${j.id}`}>{productLabel(j.product)}, {stateName(j.fromState)} to {stateName(j.toState)}</Link> · {JOB_STATUS[j.status]} · {j._count.quotes} quotes</li>)}{!mine.posted.length && <li className="text-ink-600">None yet.</li>}</ul>
          </div>
          <div className="rounded-xl border border-ink-100 bg-ink-50 p-4">
            <h2 className="h-section">Your quotes</h2>
            <ul className="mt-2 space-y-1 text-sm">{mine.quoted.map((q) => <li key={q.id}><Link href={`/hub/jobs/${q.jobId}`}>{productLabel(q.job.product)}, {stateName(q.job.fromState)} to {stateName(q.job.toState)}</Link> · {q.status.toLowerCase()}</li>)}{!mine.quoted.length && <li className="text-ink-600">None yet.</li>}</ul>
          </div>
        </section>
      )}

      <form method="get" role="search" aria-label="Filter jobs" className="mb-5 grid gap-3 rounded-xl border border-ink-100 bg-ink-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <StateSelect value={state} any="Any state (from or to)" />
        <ProductSelect value={product} any="All products" />
        <button className="btn-primary">Show</button>
      </form>

      <SectionHeader title="Loads taking quotes" note={`${jobs.length} open`} />
      {jobs.length === 0 ? <EmptyState title="No open loads match" /> : (
        <ul className="space-y-3">
          {jobs.map((j) => (
            <li key={j.id} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold"><Link href={`/hub/jobs/${j.id}`}>{productLabel(j.product)} · <span className="num">{qty(j.quantity)}</span> {j.unit}</Link></h3>
                <Pill className="bg-ink-100 text-ink-900">{j._count.quotes} quotes</Pill>
              </div>
              <p className="mt-1 text-sm text-ink-800">{j.fromPlace}, {stateName(j.fromState)} → {j.toPlace}, {stateName(j.toState)}</p>
              <p className="mt-1 text-xs text-ink-600">Ready by {day(j.readyBy)} · posted by <BusinessName b={j.poster} /></p>
            </li>
          ))}
        </ul>
      )}

      {me && (
        <section id="post" aria-labelledby="post-h" className="mt-10">
          <SectionHeader id="post-h" title="Post a load" />
          <HubForm action={postJobAction} submit="Post load" className="card space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <ProductSelect value="LPG" />
              <div><label htmlFor="quantity" className="label">Quantity</label><input id="quantity" name="quantity" type="number" min="0" step="any" className="input num" required /></div>
              <UnitSelect value="kg" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StateSelect name="fromState" label="Collect from (state)" value={me.state} />
              <div><label htmlFor="fromPlace" className="label">Collection point</label><input id="fromPlace" name="fromPlace" className="input" required maxLength={120} placeholder="Depot or plant and town" /></div>
              <StateSelect name="toState" label="Deliver to (state)" />
              <div><label htmlFor="toPlace" className="label">Delivery point</label><input id="toPlace" name="toPlace" className="input" required maxLength={120} placeholder="Town or site" /></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <div><label htmlFor="readyBy" className="label">Load ready by</label><input id="readyBy" name="readyBy" type="date" className="input" min={isoDay(new Date())} required /></div>
              <div><label htmlFor="notes" className="label">Notes for hauliers</label><input id="notes" name="notes" className="input" maxLength={1000} placeholder="Truck type, loading hours, documents" /></div>
            </div>
            <p className="text-xs text-ink-600">Insurance in transit through a licensed insurer is coming. Until then, agree cover directly with your haulier.</p>
          </HubForm>
        </section>
      )}
    </>
  );
}
