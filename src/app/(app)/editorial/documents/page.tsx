import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { approveDocumentAction, reprocessDocumentAction } from "@/app/actions/documents";
import { editorialOptions } from "@/server/editorial-options";
import { can } from "@/lib/permissions";
import { fmtDate } from "@/lib/format";
import { documentTypeLabel } from "@/lib/labels";
import { EditorialNav } from "@/components/EditorialNav";
import { MetricReviewForm } from "@/components/EditorialForms";
import { PublicUploadForm } from "@/components/UploadForms";
import { EmptyState, FictionTag, PageHeader, Pill, ProvenanceBadge } from "@/components/ui";

export const metadata = { title: "Documents and extraction" };
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditorialDocuments() {
  const user = await requireRole("ANALYST");
  const [opts, docs, drafts] = await Promise.all([
    editorialOptions(),
    db.document.findMany({ where: { visibility: "PUBLIC", status: { not: "APPROVED" } }, include: { source: true, company: true }, orderBy: { createdAt: "desc" } }),
    db.metric.findMany({ where: { status: "DRAFT" }, include: { document: { select: { id: true, title: true } }, company: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const editor = can.publish(user);
  return (
    <>
      <PageHeader eyebrow="Editorial desk" title="Documents and extraction" subtitle="Upload reports, check what was extracted against the cited page, fix extraction errors and approve documents for the public library." />
      <EditorialNav />
      {editor && (
        <section className="card mb-6"><h2 className="h-section mb-3">Ingest a document</h2><PublicUploadForm companies={opts.companies} sources={opts.sources} docTypes={opts.docTypes} provenances={opts.provenances} topics={opts.topics} /></section>
      )}
      <section aria-labelledby="d-h">
        <h2 id="d-h" className="h-section">Documents awaiting approval</h2>
        {docs.length === 0 ? <div className="mt-2"><EmptyState title="Nothing awaiting approval" /></div> : (
          <ul className="mt-2 space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="card">
                <div className="flex flex-wrap items-center gap-1.5"><ProvenanceBadge p={d.provenance} /><Pill className={d.status === "FAILED" ? "bg-risk-100 text-risk-800" : "bg-amber-100 text-amber-800"}>{d.status.toLowerCase()}</Pill>{d.isFictional && <FictionTag />}{d.source && !d.source.approved && <Pill className="bg-risk-50 text-risk-800">Source not approved</Pill>}</div>
                <p className="mt-1 font-medium"><Link href={`/documents/${d.id}`}>{d.title}</Link></p>
                <p className="text-xs text-ink-700">{d.company?.name} · {documentTypeLabel[d.documentType]} · {d.publisher} · published {fmtDate(d.publishedAt)} · {d.processingNote}</p>
                {editor && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {d.status === "EXTRACTED" && <form action={approveDocumentAction}><input type="hidden" name="id" value={d.id} /><button className="btn-primary btn-sm">Approve for library</button></form>}
                    {(d.status === "FAILED" || d.status === "UPLOADED") && d.storageKey && <form action={reprocessDocumentAction}><input type="hidden" name="id" value={d.id} /><button className="btn-secondary btn-sm">Run extraction</button></form>}
                    <Link href={`/editorial/announcements/new?document=${d.id}`} className="btn-secondary btn-sm">Draft analysis from this</Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-8" aria-labelledby="m-h">
        <h2 id="m-h" className="h-section">Draft figures to check</h2>
        <p className="muted">Automatically extracted or drafted figures. Compare each with its cited page, fix the period, scope, scale and audit status, then publish.</p>
        {drafts.length === 0 ? <div className="mt-2"><EmptyState title="No draft figures" /></div> : (
          <ul className="mt-2 space-y-3">
            {drafts.map((m) => (
              <li key={m.id}>
                <p className="mb-1 text-xs text-ink-700">{m.company.name} · {m.document ? <Link href={`/documents/${m.document.id}?page=${m.page ?? 1}`}>{m.document.title}, page {m.page ?? 1}</Link> : "no document"} · “{m.excerpt}” {m.disclosureStatus === "NOT_DISCLOSED" && "· records non-disclosure"}</p>
                {editor ? <MetricReviewForm m={{ id: m.id, label: m.label, value: m.value === null ? "" : String(m.value), periodLabel: m.periodLabel, periodType: m.periodType, scope: m.scope, auditStatus: m.auditStatus, page: m.page ? String(m.page) : "", currency: m.currency ?? "", scale: m.scale, periodStart: iso(m.periodStart), periodEnd: iso(m.periodEnd), status: m.status }} /> : <p className="text-sm">{m.label}: {m.value === null ? "not disclosed" : String(m.value)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
