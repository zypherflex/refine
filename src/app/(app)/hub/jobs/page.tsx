import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { myJobs, openJobs } from "@/server/hub/jobs";
import { LOCATIONS, NIGERIAN_STATES, OTHER_LOCATIONS, PRODUCTS, productLabel } from "@/lib/hub/catalog";
import { fmtDate } from "@/lib/format";
import { DemoTag, VerificationBadge } from "@/components/hub/parts";
import { EmptyState, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Delivery jobs" };

const statusLabel = { OPEN: "Taking quotes", AWARDED: "Awarded", DELIVERED: "Delivered", CANCELLED: "Cancelled" } as const;
const statusStyle = { OPEN: "bg-teal-100 text-teal-800", AWARDED: "bg-navy-100 text-navy-800", DELIVERED: "bg-navy-100 text-navy-800", CANCELLED: "bg-navy-50 text-navy-500 line-through" } as const;

function LocationSelect({ id, name, label, value }: { id: string; name: string; label: string; value: string }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <select id={id} name={name} className="input" defaultValue={value}>
        <option value="">Anywhere</option>
        <optgroup label="Nigeria">{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</optgroup>
        <optgroup label="Outside Nigeria">{OTHER_LOCATIONS.map((s) => <option key={s}>{s}</option>)}</optgroup>
      </select>
    </div>
  );
}

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; product?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const from = LOCATIONS.includes(sp.from ?? "") ? sp.from! : "";
  const to = LOCATIONS.includes(sp.to ?? "") ? sp.to! : "";
  const product = PRODUCTS.some((p) => p.id === sp.product) ? sp.product! : "";
  const [jobs, mine, business] = await Promise.all([openJobs(user, { fromState: from, toState: to, product }), myJobs(user), getMyBusiness(user)]);
  const isCarrier = !!business?.roles.includes("DELIVERY");

  return (
    <>
      <PageHeader
        eyebrow="Trade hub"
        title="Delivery jobs"
        subtitle="Post a load and collect quotes from delivery partners, or find loads to carry. Accept one quote, then both sides confirm the delivery. Payment is agreed between you."
        actions={business ? <Link href="/hub/jobs/new" className="btn-primary btn-sm no-underline">Post a job</Link> : <Link href="/hub/me" className="btn-secondary btn-sm no-underline">Set up your business</Link>}
      />

      {(mine.posted.length > 0 || mine.quoted.length > 0) && (
        <section aria-labelledby="mine-h" className="mb-8 grid gap-4 lg:grid-cols-2">
          <div className="card">
            <h2 id="mine-h" className="h-section">Jobs you posted ({mine.posted.length})</h2>
            {mine.posted.length === 0 ? <p className="muted">None yet.</p> : (
              <ul className="mt-2 divide-y divide-navy-100 text-sm">
                {mine.posted.slice(0, 8).map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/hub/jobs/${j.id}`} className="font-medium">{j.title}</Link>
                    <span className="flex items-center gap-2"><Pill className={statusStyle[j.status]}>{statusLabel[j.status]}</Pill><span className="text-xs text-navy-600">{j._count.quotes} quote{j._count.quotes === 1 ? "" : "s"}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2 className="h-section">Your quotes ({mine.quoted.length})</h2>
            {mine.quoted.length === 0 ? <p className="muted">{isCarrier ? "Quote on an open job below." : "Delivery partners quote on jobs here."}</p> : (
              <ul className="mt-2 divide-y divide-navy-100 text-sm">
                {mine.quoted.slice(0, 8).map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`/hub/jobs/${q.jobId}`} className="font-medium">{q.job.title}</Link>
                    <span className="num text-xs text-navy-700">₦{q.priceNaira.toLocaleString("en-GB")} · {q.status.toLowerCase()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <form method="get" className="mb-5 grid gap-3 rounded-xl border border-navy-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end" role="search" aria-label="Filter jobs">
        <LocationSelect id="from" name="from" label="From" value={from} />
        <LocationSelect id="to" name="to" label="To" value={to} />
        <div>
          <label htmlFor="product" className="label">Product</label>
          <select id="product" name="product" className="input" defaultValue={product}><option value="">Any</option>{PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        </div>
        <button className="btn-primary">Show</button>
      </form>

      <section aria-labelledby="open-h">
        <h2 id="open-h" className="h-section">Open jobs ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <EmptyState title="No open jobs match">Try another route, or post your own load.</EmptyState>
        ) : (
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {jobs.map((j) => (
              <li key={j.id} className="card flex flex-col">
                <div className="flex flex-wrap gap-1.5">{j.products.map((p) => <Pill key={p} className="bg-navy-50 text-navy-700 ring-1 ring-inset ring-navy-100">{productLabel(p)}</Pill>)}</div>
                <h3 className="mt-2 text-base font-semibold"><Link href={`/hub/jobs/${j.id}`}>{j.title}</Link></h3>
                <p className="mt-1 text-sm text-navy-800"><span className="font-medium">{[j.fromTown, j.fromState].filter(Boolean).join(", ")}</span> → <span className="font-medium">{[j.toTown, j.toState].filter(Boolean).join(", ")}</span></p>
                <p className="num text-sm text-navy-700">{j.quantity.toLocaleString("en-GB")} {j.unit} · pickup {fmtDate(j.pickupDate)}</p>
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-xs text-navy-700">
                  <Link href={`/hub/businesses/${j.poster.id}`}>{j.poster.name}</Link><VerificationBadge v={j.poster.verification} />{j.poster.isDemo && <DemoTag />}
                  <span className="ml-auto">{j._count.quotes} quote{j._count.quotes === 1 ? "" : "s"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
