import Link from "next/link";
import type { DocumentType, Provenance } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { listLibrary, listPrivateDocuments } from "@/server/services/documents";
import { deletePrivateAction } from "@/app/actions/documents";
import { maxUploadBytes } from "@/server/upload-validation";
import { can } from "@/lib/permissions";
import { documentTypeLabel, provenanceLabel, topicLabel, TOPICS } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { PrivateUploadForm } from "@/components/UploadForms";
import { EmptyState, FictionTag, PageHeader, Pill, ProvenanceBadge } from "@/components/ui";

export const metadata = { title: "Source library" };

type SP = { company?: string; topic?: string; source?: string; type?: string; status?: string; provenance?: string; from?: string; to?: string; q?: string };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const staff = can.viewEditorial(user);
  const [companies, sources] = await Promise.all([db.company.findMany({ orderBy: { name: "asc" } }), db.source.findMany({ orderBy: { name: "asc" } })]);
  const date = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s) : undefined);
  const docs = await listLibrary(user, {
    companyId: sp.company || undefined,
    topic: sp.topic || undefined,
    sourceId: sp.source || undefined,
    documentType: sp.type && sp.type in documentTypeLabel ? (sp.type as DocumentType) : undefined,
    status: staff ? sp.status || undefined : undefined,
    provenance: sp.provenance && sp.provenance in provenanceLabel ? (sp.provenance as Provenance) : undefined,
    from: date(sp.from),
    to: date(sp.to),
    q: sp.q || undefined,
  });
  const mine = await listPrivateDocuments(user);
  return (
    <>
      <PageHeader eyebrow="Sources" title="Source library" subtitle="Approved documents behind every figure and announcement. Pages are text-only for low-data reading; the original file is an optional download." />
      <form className="card mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filter documents">
        <div className="lg:col-span-2"><label htmlFor="q" className="label">Search titles and publishers</label><input id="q" name="q" defaultValue={sp.q} className="input" /></div>
        <div><label htmlFor="company" className="label">Company</label><select id="company" name="company" defaultValue={sp.company ?? ""} className="input"><option value="">All</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="topic" className="label">Topic</label><select id="topic" name="topic" defaultValue={sp.topic ?? ""} className="input"><option value="">All</option>{TOPICS.map((t) => <option key={t} value={t}>{topicLabel[t]}</option>)}</select></div>
        <div><label htmlFor="source" className="label">Source</label><select id="source" name="source" defaultValue={sp.source ?? ""} className="input"><option value="">All</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div><label htmlFor="type" className="label">Document type</label><select id="type" name="type" defaultValue={sp.type ?? ""} className="input"><option value="">All</option>{Object.entries(documentTypeLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label htmlFor="provenance" className="label">Provenance</label><select id="provenance" name="provenance" defaultValue={sp.provenance ?? ""} className="input"><option value="">All</option>{Object.entries(provenanceLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        {staff && <div><label htmlFor="status" className="label">Review status</label><select id="status" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option><option value="APPROVED">Approved</option><option value="EXTRACTED">Awaiting approval</option><option value="PROCESSING">Processing</option><option value="FAILED">Failed</option></select></div>}
        <div><label htmlFor="from" className="label">Published from</label><input id="from" name="from" type="date" defaultValue={sp.from} className="input" /></div>
        <div><label htmlFor="to" className="label">Published to</label><input id="to" name="to" type="date" defaultValue={sp.to} className="input" /></div>
        <div className="flex items-end gap-2"><button className="btn-primary">Filter</button><Link href="/library" className="btn-secondary">Clear</Link></div>
      </form>

      <section aria-labelledby="lib-h">
        <h2 id="lib-h" className="sr-only">Documents</h2>
        {docs.length === 0 ? <EmptyState title="No documents match these filters" /> : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="card">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ProvenanceBadge p={d.provenance} />
                  <Pill className={d.status === "APPROVED" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}>{d.status === "APPROVED" ? "Approved source" : `${d.status.toLowerCase()} (staff only)`}</Pill>
                  {d.isFictional && <FictionTag />}
                </div>
                <p className="mt-1 font-medium"><Link href={`/documents/${d.id}`} className="text-navy-950">{d.title}</Link></p>
                <p className="text-xs text-navy-700">{d.publisher} · {documentTypeLabel[d.documentType]} · published {fmtDate(d.publishedAt)} · retrieved {fmtDate(d.retrievedAt)} · {d.pageCount} page(s){d.company && ` · ${d.company.name}`}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-8" aria-labelledby="private-h">
        <h2 id="private-h" className="h-section">My private documents</h2>
        <p className="muted">Upload your own reports or notes to analyse with the research assistant. Private files are stored outside the public library and only you can open them. Not even administrators can view them.</p>
        <div className="mt-3"><PrivateUploadForm companies={companies.map((c) => ({ id: c.id, name: c.name }))} maxMb={maxUploadBytes() / 1024 / 1024} /></div>
        {mine.length > 0 && (
          <ul className="mt-4 divide-y divide-navy-50">
            {mine.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><Link href={`/documents/${d.id}`}>{d.title}</Link> <span className="text-xs text-navy-700">· {d.status === "EXTRACTED" ? `${d.pageCount} page(s) ready` : d.status.toLowerCase()} · {(d.sizeBytes / 1024).toFixed(0)} KB</span></span>
                <span className="flex gap-2">
                  <Link href={`/assistant?document=${d.id}`} className="btn-secondary btn-sm">Ask about it</Link>
                  <details className="text-xs"><summary className="btn btn-sm text-risk-700">Delete</summary><form action={deletePrivateAction} className="mt-1"><input type="hidden" name="id" value={d.id} /><button className="btn-danger btn-sm">Confirm delete</button></form></details>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
