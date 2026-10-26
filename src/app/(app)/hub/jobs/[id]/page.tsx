import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { getJob } from "@/server/hub/jobs";
import { acceptQuoteAction, cancelJobAction, confirmJobAction, withdrawQuoteAction } from "@/app/actions/hub";
import { productLabel } from "@/lib/hub/catalog";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { QuoteForm } from "@/components/hub/opsForms";
import { DemoTag, SafetyNote, VerificationBadge } from "@/components/hub/parts";
import { Notice, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Delivery job" };

const statusLabel = { OPEN: "Taking quotes", AWARDED: "Awarded", DELIVERED: "Delivered", CANCELLED: "Cancelled" } as const;

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [{ job, isPoster, isCarrier, myQuote, accepted, quotes }, business] = await Promise.all([getJob(user, id), getMyBusiness(user)]);
  const canQuote = !isPoster && job.status === "OPEN" && !!business?.roles.includes("DELIVERY") && business.verification !== "SUSPENDED";
  const naira = (n: number) => `₦${n.toLocaleString("en-GB")}`;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/jobs">← Delivery jobs</Link></p>
      <PageHeader
        eyebrow={statusLabel[job.status]}
        title={job.title}
        subtitle={`${[job.fromTown, job.fromState].filter(Boolean).join(", ")} → ${[job.toTown, job.toState].filter(Boolean).join(", ")}`}
        actions={<div className="flex flex-wrap gap-1.5">{job.products.map((p) => <Pill key={p} className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{productLabel(p)}</Pill>)}</div>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h-section">The load</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt className="text-ink-600">Quantity</dt><dd className="num font-medium">{job.quantity.toLocaleString("en-GB")} {job.unit}</dd></div>
              <div><dt className="text-ink-600">Pickup</dt><dd className="font-medium">{fmtDate(job.pickupDate)}</dd></div>
              <div><dt className="text-ink-600">Posted</dt><dd>{fmtDate(job.createdAt)}</dd></div>
            </dl>
            {job.details && <p className="mt-4 whitespace-pre-line text-sm text-ink-800">{job.details}</p>}
          </section>

          {job.status === "AWARDED" && accepted && (isPoster || isCarrier) && (
            <section className="card space-y-3" aria-labelledby="awarded-h">
              <h2 id="awarded-h" className="h-section">Awarded to {accepted.carrier.name} for <span className="num">{naira(accepted.priceNaira)}</span></h2>
              <ul className="space-y-1 text-sm">
                <li>{job.posterConfirmedAt ? `✓ ${job.poster.name} confirmed delivery ${fmtDateTime(job.posterConfirmedAt)}` : `○ Waiting for ${job.poster.name} to confirm`}</li>
                <li>{job.carrierConfirmedAt ? `✓ ${accepted.carrier.name} confirmed delivery ${fmtDateTime(job.carrierConfirmedAt)}` : `○ Waiting for ${accepted.carrier.name} to confirm`}</li>
              </ul>
              {((isPoster && !job.posterConfirmedAt) || (isCarrier && !job.carrierConfirmedAt)) && (
                <form action={confirmJobAction}><input type="hidden" name="jobId" value={job.id} /><button className="btn-primary btn-sm">{isPoster ? "Confirm the load arrived" : "Confirm I delivered the load"}</button></form>
              )}
              <p className="text-xs text-ink-600">Message each other from the <Link href={`/hub/businesses/${isPoster ? accepted.carrier.id : job.poster.id}`}>business profile</Link> to arrange pickup.</p>
            </section>
          )}
          {job.status === "DELIVERED" && <Notice tone="ok" title="Delivered">Both sides confirmed this delivery. It counts towards the carrier&apos;s record.</Notice>}
          {job.status === "CANCELLED" && <Notice title="Cancelled">The business cancelled this job.</Notice>}

          {isPoster && (
            <section aria-labelledby="quotes-h">
              <h2 id="quotes-h" className="h-section">Quotes ({quotes.length})</h2>
              {quotes.length === 0 ? <p className="muted">No quotes yet. Delivery partners serving this route are notified when they open the jobs board.</p> : (
                <ul className="mt-2 space-y-3">
                  {quotes.map((q) => (
                    <li key={q.id} className={`card flex flex-wrap items-start justify-between gap-3 ${q.status === "ACCEPTED" ? "ring-2 ring-brand-600" : ""}`}>
                      <div className="min-w-0 text-sm">
                        <p className="flex flex-wrap items-center gap-1.5"><Link href={`/hub/businesses/${q.carrier.id}`} className="font-medium">{q.carrier.name}</Link><VerificationBadge v={q.carrier.verification} />{q.carrier.isDemo && <DemoTag />}</p>
                        {q.note && <p className="mt-1 whitespace-pre-line text-ink-800">{q.note}</p>}
                        <p className="mt-1 text-xs text-ink-500">{q.status === "PENDING" ? `Sent ${fmtDateTime(q.updatedAt)}` : q.status.toLowerCase()}</p>
                      </div>
                      <div className="text-right">
                        <p className="num text-xl font-semibold">{naira(q.priceNaira)}</p>
                        {job.status === "OPEN" && q.status === "PENDING" && (
                          <form action={acceptQuoteAction} className="mt-1"><input type="hidden" name="jobId" value={job.id} /><input type="hidden" name="quoteId" value={q.id} /><button className="btn-primary btn-sm">Accept this quote</button></form>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="card">
            <p className="eyebrow">Posted by</p>
            <p className="mt-1 flex flex-wrap items-center gap-1.5"><Link href={`/hub/businesses/${job.poster.id}`} className="font-semibold">{job.poster.name}</Link><VerificationBadge v={job.poster.verification} />{job.poster.isDemo && <DemoTag />}</p>
          </section>
          {isPoster && (job.status === "OPEN" || job.status === "AWARDED") && (
            <section className="card"><form action={cancelJobAction}><input type="hidden" name="jobId" value={job.id} /><button className="btn-ghost btn-sm">Cancel this job</button></form></section>
          )}
          {canQuote && (
            <section className="card space-y-3">
              <h2 className="h-section">{myQuote && myQuote.status !== "WITHDRAWN" ? "Your quote" : "Quote for this job"}</h2>
              <QuoteForm jobId={job.id} current={myQuote && myQuote.status !== "WITHDRAWN" ? myQuote : undefined} />
              {myQuote?.status === "PENDING" && <form action={withdrawQuoteAction}><input type="hidden" name="jobId" value={job.id} /><button className="text-xs text-ink-600 hover:text-risk-800">Withdraw quote</button></form>}
            </section>
          )}
          {!isPoster && !canQuote && job.status === "OPEN" && !myQuote && <section className="card text-sm">Delivery partners can quote on this job. <Link href="/hub/me">Add the delivery partner role</Link> to your business to quote.</section>}
          {myQuote && !canQuote && <section className="card text-sm">Your quote: <span className="num font-semibold">{naira(myQuote.priceNaira)}</span> ({myQuote.status.toLowerCase()}).</section>}
          <section className="card"><SafetyNote /></section>
        </aside>
      </div>
    </>
  );
}
