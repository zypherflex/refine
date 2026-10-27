import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getOutlet } from "@/server/everyday/outlets";
import { NotFoundError } from "@/lib/errors";
import { naira, priceItem } from "@/lib/hub/prices";
import { EVERYDAY_LABEL, itemsSoldAt, outletKindLabel, problemLabel, queueLabel } from "@/lib/everyday";
import { fmtDateTime } from "@/lib/format";
import { Notice, PageHeader } from "@/components/ui";
import { ReportForm } from "@/components/everyday/forms";
import { ShareButton } from "@/components/native/ShareButton";

export const dynamic = "force-dynamic";

export default async function StationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string }> }) {
  const { id } = await params;
  const { added } = await searchParams;
  const user = await getCurrentUser();
  const data = await getOutlet(id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const { card: o, recent, problems } = data;

  return (
    <>
      <p className="mb-2 text-sm"><Link href={`/stations?state=${encodeURIComponent(o.state)}`}>← Stations in {o.state}</Link></p>
      <PageHeader eyebrow={outletKindLabel(o.kind)} title={o.name} subtitle={[o.brand, o.address, o.area, o.state].filter(Boolean).join(" · ")} actions={<ShareButton title={o.name} text={`${o.name}, ${o.area}: prices and queues on RefineryLens`} path={`/stations/${o.id}`} />} />
      {added && <div className="mb-4"><Notice tone="ok" title="Place added">Now report what you paid or whether they are selling.</Notice></div>}
      {o.isDemo && <div className="mb-4"><Notice tone="warn" title="Demo place">This station and its reports are sample data seeded for this installation.</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section aria-labelledby="now-h" className="card">
            <h2 id="now-h" className="h-section">Latest prices (last 3 days)</h2>
            {o.prices.length ? (
              <ul className="mt-2 divide-y divide-ink-100">
                {o.prices.map((p) => <li key={p.item} className="flex items-baseline justify-between py-2"><span>{EVERYDAY_LABEL[p.item]} <span className="text-xs text-ink-500">{priceItem(p.item)!.unit}</span></span><span className="text-right"><span className="num text-lg font-semibold">{naira(p.priceNaira)}</span><span className="block text-xs text-ink-500">{fmtDateTime(p.at)} · {p.reporters} {p.reporters === 1 ? "person" : "people"}</span></span></li>)}
              </ul>
            ) : <p className="muted mt-2">Nobody has reported a price here in the last 3 days.</p>}
            {o.availability.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-ink-100 pt-3 text-sm">
                {o.availability.map((a) => <li key={a.item}><strong>{EVERYDAY_LABEL[a.item]}:</strong> {a.available ? `selling${a.queue ? `, ${queueLabel(a.queue).toLowerCase()}` : ""}` : "not selling"} <span className="text-xs text-ink-500">({fmtDateTime(a.at)})</span></li>)}
              </ul>
            )}
          </section>

          {problems.length > 0 && (
            <section aria-labelledby="prob-h" className="card border-risk-100">
              <h2 id="prob-h" className="h-section">Problems reported in the last 30 days</h2>
              <ul className="mt-2 space-y-1 text-sm">{problems.map(([p, n]) => <li key={p}><span className="num font-semibold">{n}×</span> {problemLabel(p)}</li>)}</ul>
              <p className="mt-3 text-xs text-ink-600">Reports from members of the public, not findings. To complain formally, contact the Nigerian Midstream and Downstream Petroleum Regulatory Authority (NMDPRA) or the Federal Competition and Consumer Protection Commission (FCCPC).</p>
            </section>
          )}

          <section aria-labelledby="recent-h">
            <h2 id="recent-h" className="h-section">Recent reports</h2>
            {recent.length ? (
              <ul className="mt-2 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
                {recent.map((r) => (
                  <li key={r.id} className="px-4 py-2.5 text-sm">
                    <span className="font-medium">{r.kind === "PRICE" ? `${EVERYDAY_LABEL[r.item as keyof typeof EVERYDAY_LABEL]}: ${naira(r.priceNaira!)}` : r.kind === "AVAILABILITY" ? `${EVERYDAY_LABEL[r.item as keyof typeof EVERYDAY_LABEL]}: ${r.available ? `selling${r.queue ? `, ${queueLabel(r.queue).toLowerCase()}` : ""}` : "not selling"}` : problemLabel(r.problem)}</span>
                    {r.note && <span className="text-ink-700"> · “{r.note}”</span>}
                    <span className="block text-xs text-ink-500">{fmtDateTime(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="muted mt-2">No reports yet. Be the first.</p>}
          </section>
        </div>

        <aside aria-labelledby="report-h" className="card h-fit lg:sticky lg:top-24">
          <h2 id="report-h" className="h-section">Report what you found</h2>
          {user ? (
            <div className="mt-3"><ReportForm outletId={o.id} items={itemsSoldAt(o.kind)} /></div>
          ) : (
            <p className="mt-2 text-sm text-ink-700"><Link href={`/login?next=/stations/${o.id}`}>Sign in</Link> or <Link href={`/register?next=/stations/${o.id}`}>join free</Link> to report. Reports are tied to an account so one person cannot flood a station with fake prices; your name is never shown.</p>
          )}
        </aside>
      </div>
    </>
  );
}
