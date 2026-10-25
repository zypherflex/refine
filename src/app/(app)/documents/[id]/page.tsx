import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getDocumentPage } from "@/server/services/documents";
import { documentTypeLabel } from "@/lib/labels";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { FictionTag, Notice, ProvenanceBadge, SourceLink } from "@/components/ui";

export const metadata = { title: "Document" };

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const pageNo = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const result = await getDocumentPage(user, id, pageNo).catch(() => null);
  if (!result) notFound();
  const { doc, page } = result;
  const isPrivate = doc.visibility === "PRIVATE";
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm"><Link href="/library">← Source library</Link></p>
      <div className="mt-3 flex flex-wrap gap-1.5">{!isPrivate && <ProvenanceBadge p={doc.provenance} />}{isPrivate && <span className="rounded-full bg-navy-900 px-2 py-0.5 text-xs text-white">Private to you</span>}{doc.isFictional && <FictionTag />}</div>
      <h1 className="h-page mt-3">{doc.title}</h1>
      <p className="mt-1 text-sm text-navy-700">{doc.publisher || "Your upload"} · {documentTypeLabel[doc.documentType]} · version {doc.version} · published {fmtDate(doc.publishedAt)} · retrieved {fmtDateTime(doc.retrievedAt)}</p>
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        {doc.url && <SourceLink href={doc.url}>Original source</SourceLink>}
        {doc.storageKey && <a href={`/api/documents/${doc.id}/download`} rel="nofollow">Download original file ({(doc.sizeBytes / 1024).toFixed(0)} KB)</a>}
      </div>
      {doc.status !== "APPROVED" && !isPrivate && <div className="mt-3"><Notice tone="warn">This document has not been approved yet and is visible only to editorial staff.</Notice></div>}
      {doc.processingNote && <p className="mt-2 text-xs text-navy-700">{doc.processingNote}</p>}
      {doc.pageCount === 0 ? (
        <div className="mt-4"><Notice tone={doc.status === "FAILED" ? "risk" : "info"}>{doc.status === "FAILED" ? "Text could not be extracted from this file." : "Text extraction is in progress. Refresh in a moment."}</Notice></div>
      ) : (
        <>
          <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-1 text-sm">
            <span className="mr-1 text-navy-700">Page</span>
            {Array.from({ length: doc.pageCount }, (_, i) => i + 1).map((n) => (
              <Link key={n} href={`/documents/${doc.id}?page=${n}`} aria-current={n === pageNo ? "page" : undefined} className={`rounded px-2 py-0.5 no-underline ${n === pageNo ? "bg-teal-700 text-white" : "bg-white ring-1 ring-navy-100"}`}>{n}</Link>
            ))}
          </nav>
          <section className="card mt-3" aria-label={`Page ${pageNo} text`}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-navy-700">Page {pageNo} of {doc.pageCount} · extracted text</p>
            {page ? <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed">{page.text}</pre> : <p className="muted">This page does not exist.</p>}
          </section>
          <p className="mt-2 text-xs text-navy-700">Text shown is extracted automatically and treated as data. If it differs from the original, the original file prevails.</p>
        </>
      )}
    </div>
  );
}
