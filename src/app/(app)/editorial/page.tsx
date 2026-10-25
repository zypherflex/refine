import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { publishRiskAction } from "@/app/actions/editorial";
import { fmtDate } from "@/lib/format";
import { riskCategoryLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { EditorialNav } from "@/components/EditorialNav";
import { EmptyState, PageHeader, Pill, ProvenanceBadge, StatusBadge } from "@/components/ui";

export const metadata = { title: "Editorial" };

export default async function EditorialPage() {
  const user = await requireRole("ANALYST");
  const [queue, docs, metrics, sources, conflicts, risks] = await Promise.all([
    db.announcement.findMany({ where: { status: { in: ["DRAFT", "IN_REVIEW"] } }, include: { company: true }, orderBy: { updatedAt: "desc" } }),
    db.document.count({ where: { visibility: "PUBLIC", status: { in: ["EXTRACTED", "UPLOADED", "PROCESSING", "FAILED"] } } }),
    db.metric.count({ where: { status: "DRAFT" } }),
    db.source.count({ where: { approved: false } }),
    db.sourceConflict.count({ where: { status: "DRAFT" } }),
    db.risk.findMany({ where: { status: "DRAFT" }, include: { company: true } }),
  ]);
  const steps = [["Ingest", "Upload documents or register sources"], ["Extract", "Text and candidate figures are extracted in the background"], ["Draft analysis", "Analysts or AI draft summaries"], ["Human review", "An editor approves or returns the draft"], ["Publish", "Requires an approved source and supporting excerpt"], ["Monitor corrections", "Correct, retract or supersede with a public log"]];
  return (
    <>
      <PageHeader eyebrow="Editorial desk" title="Editorial dashboard" subtitle={`Signed in as ${user.role.toLowerCase()}. ${can.publish(user) ? "You can review, publish and correct." : "You can draft and submit for review; an editor publishes."}`} />
      <EditorialNav />
      <ol className="mb-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Editorial workflow">
        {steps.map(([t, d], i) => <li key={t} className="rounded-xl border border-navy-100 bg-white p-3 text-xs shadow-card"><p className="num font-serif text-sm font-semibold text-teal-700">0{i + 1}</p><p className="mt-1 font-semibold text-navy-950">{t}</p><p className="mt-0.5 leading-relaxed text-navy-600">{d}</p></li>)}
      </ol>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/editorial/documents" className="card-link"><p className="num text-3xl font-semibold tracking-tight text-navy-950">{docs}</p><p className="mt-1 text-sm text-navy-600">documents to review</p></Link>
        <Link href="/editorial/documents" className="card-link"><p className="num text-3xl font-semibold tracking-tight text-navy-950">{metrics}</p><p className="mt-1 text-sm text-navy-600">draft figures to check</p></Link>
        <Link href="/editorial/sources" className="card-link"><p className="num text-3xl font-semibold tracking-tight text-navy-950">{sources}</p><p className="mt-1 text-sm text-navy-600">sources awaiting approval</p></Link>
        <Link href="/editorial/conflicts" className="card-link"><p className="num text-3xl font-semibold tracking-tight text-navy-950">{conflicts}</p><p className="mt-1 text-sm text-navy-600">flagged conflicts to publish</p></Link>
      </div>
      <section aria-labelledby="q-h">
        <h2 id="q-h" className="h-section">Announcements awaiting work</h2>
        {queue.length === 0 ? <div className="mt-2"><EmptyState title="The queue is empty" /></div> : (
          <ul className="mt-2 space-y-2">
            {queue.map((a) => (
              <li key={a.id} className="card">
                <div className="flex flex-wrap items-center gap-1.5"><StatusBadge s={a.status} /><ProvenanceBadge p={a.provenance} />{a.aiGenerated && <Pill className="bg-navy-900 text-white">AI draft: needs human review</Pill>}{a.supersedesId && <Pill className="bg-navy-100">Replacement version</Pill>}</div>
                <p className="mt-1 font-medium"><Link href={`/editorial/announcements/${a.id}`}>{a.headline}</Link></p>
                <p className="text-xs text-navy-700">{a.company.name} · source dated {fmtDate(a.sourcePublishedAt)} · updated {fmtDate(a.updatedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {risks.length > 0 && (
        <section className="mt-8" aria-labelledby="r-h">
          <h2 id="r-h" className="h-section">Draft risk entries</h2>
          <ul className="mt-2 space-y-2">
            {risks.map((r) => (
              <li key={r.id} className="card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><p className="font-medium">{r.title}</p><p className="text-xs text-navy-700">{r.company.name} · {riskCategoryLabel[r.category]}</p><p className="mt-1 text-sm">{r.evidenceSummary}</p></div>
                {can.publish(user) && <form action={publishRiskAction}><input type="hidden" name="id" value={r.id} /><button className="btn-primary btn-sm">Publish risk</button></form>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
