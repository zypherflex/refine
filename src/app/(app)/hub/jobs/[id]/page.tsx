import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getJob } from "@/server/hub/jobs";
import { reliability } from "@/server/hub/reliability";
import { NotFoundError } from "@/lib/errors";
import { productLabel, stateName } from "@/lib/hub/catalog";
import { acceptQuoteAction, cancelJobAction, confirmJobAction, quoteJobAction, withdrawQuoteAction } from "@/app/actions/hub";
import { Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { AdvanceWarning, BusinessName, JOB_STATUS, day, naira, qty } from "@/components/hub/bits";

export const metadata = { title: "Delivery job" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getJob(user, id).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const { job, quotes, quoteCount, accepted, me, isPoster, isHaulier } = data;
  const canQuote = !!me && !isPoster && me.roles.includes("HAULIER") && job.status === "OPEN" && me.verification !== "SUSPENDED";
  const myQuote = quotes.find((q) => q.haulierId === me?.id);
  const scores = new Map(isPoster ? await Promise.all(quotes.map(async (q) => [q.haulierId, (await reliability(q.haulierId)).score] as const)) : []);
  const myConfirm = isPoster ? job.posterConfirmedAt : isHaulier ? job.haulierConfirmedAt : null;

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/jobs">← All delivery jobs</Link></p>
      <PageHeader eyebrow="Delivery job" title={`${productLabel(job.product)}: ${stateName(job.fromState)} to ${stateName(job.toState)}`} subtitle={<><span className="num">{qty(job.quantity)}</span> {job.unit} · ready by {day(job.readyBy)} · posted by <BusinessName b={job.poster} /></>} actions={<Pill className="bg-ink-100 text-ink-900">{JOB_STATUS[job.status]}</Pill>} />

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-8">
          <section className="card">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-600">Collect from</dt><dd className="font-medium">{job.fromPlace}, {stateName(job.fromState)}</dd></div>
              <div><dt className="text-xs text-ink-600">Deliver to</dt><dd className="font-medium">{job.toPlace}, {stateName(job.toState)}</dd></div>
              {job.notes && <div className="sm:col-span-2"><dt className="text-xs text-ink-600">Notes</dt><dd>{job.notes}</dd></div>}
            </dl>
          </section>

          {(isPoster || isHaulier) && accepted && (
            <section aria-labelledby="confirm-h" className="card border-ink-800/30">
              <h2 id="confirm-h" className="h-section">Booked with <BusinessName b={accepted.haulier} /></h2>
              <p className="mt-1 text-sm"><span className="num font-semibold">{naira(accepted.priceNgn)}</span> · {accepted.days} {accepted.days === 1 ? "day" : "days"}</p>
              <ul className="mt-3 space-y-1 text-sm">
                <li>{job.posterConfirmedAt ? "✓" : "○"} Poster confirmed delivery{job.posterConfirmedAt ? ` on ${day(job.posterConfirmedAt)}` : ""}</li>
                <li>{job.haulierConfirmedAt ? "✓" : "○"} Haulier confirmed delivery{job.haulierConfirmedAt ? ` on ${day(job.haulierConfirmedAt)}` : ""}</li>
              </ul>
              {job.status === "AWARDED" && !myConfirm && (
                <div className="mt-3"><HubForm action={confirmJobAction} submit={isPoster ? "Confirm I received it" : "Confirm I delivered it"}><input type="hidden" name="id" value={job.id} /></HubForm></div>
              )}
              {job.status === "DELIVERED" && <div className="mt-3"><Notice tone="ok">Delivered and confirmed by both sides. This now counts in both businesses&apos; delivery records.</Notice></div>}
            </section>
          )}

          <section aria-labelledby="quotes-h">
            <SectionHeader id="quotes-h" title={isPoster ? "Quotes" : "Quotes on this job"} note={`${quoteCount} received`} />
            {isPoster ? (
              quotes.length ? (
                <ul className="space-y-2">
                  {quotes.map((q) => (
                    <li key={q.id} className="flex flex-col gap-2 rounded-xl border border-ink-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm"><BusinessName b={q.haulier} /> <span className="text-xs text-ink-600">· reliability {scores.get(q.haulierId) ?? "not enough data yet"}</span></p>
                        <p className="mt-0.5 text-sm"><span className="num font-semibold">{naira(q.priceNgn)}</span> · {q.days} {q.days === 1 ? "day" : "days"}{q.note ? ` · ${q.note}` : ""}</p>
                      </div>
                      {job.status === "OPEN" && q.status === "PENDING" ? <HubForm action={acceptQuoteAction} submit="Accept quote" inline><input type="hidden" name="id" value={q.id} /></HubForm> : <Pill className="bg-ink-50 text-ink-700">{q.status.toLowerCase()}</Pill>}
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">No quotes yet. Hauliers on RefineryLens see this job in the list.</p>
            ) : <p className="muted">Only the business that posted the load sees every quote. Hauliers see their own.</p>}
            {isPoster && job.status === "OPEN" && <div className="mt-4"><HubForm action={cancelJobAction} submit="Cancel this job" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={job.id} /></HubForm></div>}
          </section>
        </div>

        <aside className="space-y-4">
          {canQuote && (
            <section aria-labelledby="quote-h" className="card">
              <h2 id="quote-h" className="h-section mb-3">{myQuote ? "Update your quote" : "Quote on this job"}</h2>
              <HubForm action={quoteJobAction} submit={myQuote ? "Update quote" : "Send quote"}>
                <input type="hidden" name="jobId" value={job.id} />
                <div><label htmlFor="priceNgn" className="label">Your price for the whole job (₦)</label><input id="priceNgn" name="priceNgn" type="number" min="1" step="any" className="input num" defaultValue={myQuote?.priceNgn} required /></div>
                <div><label htmlFor="days" className="label">Days to deliver</label><input id="days" name="days" type="number" min="0" max="60" className="input num" defaultValue={myQuote?.days ?? 2} required /></div>
                <div><label htmlFor="note" className="label">Note</label><input id="note" name="note" className="input" maxLength={500} defaultValue={myQuote?.note} placeholder="Truck type, availability" /></div>
              </HubForm>
              {myQuote?.status === "PENDING" && <div className="mt-3"><HubForm action={withdrawQuoteAction} submit="Withdraw quote" buttonClass="btn-ghost btn-sm" inline><input type="hidden" name="id" value={myQuote.id} /></HubForm></div>}
            </section>
          )}
          {!me && <Notice title="Want to quote?">Add your business with the Haulier role. <Link href="/hub/my">Add my business</Link></Notice>}
          <AdvanceWarning />
          <Notice title="Coming with licensed partners">Escrow that releases payment when both sides confirm, and insurance in transit, will be offered through licensed partners.</Notice>
        </aside>
      </div>
    </>
  );
}
