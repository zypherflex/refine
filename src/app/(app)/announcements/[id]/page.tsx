import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { getAnnouncement } from "@/server/services/announcements";
import { NotFoundError } from "@/lib/errors";
import { documentTypeLabel, topicLabel } from "@/lib/labels";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { Explainer, FictionTag, Notice, ProvenanceBadge, SourceLink, StatusBadge } from "@/components/ui";
import { LinkEvidenceForm } from "@/components/ThesisForms";

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let a;
  try {
    a = await getAnnouncement(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const theses = await db.thesis.findMany({ where: { ownerId: user.id, companyId: a.companyId }, include: { assumptions: true } });
  const reviewer = a.reviewerId ? await db.user.findUnique({ where: { id: a.reviewerId }, select: { name: true } }) : null;
  return (
    <article className="mx-auto max-w-3xl">
      <p className="text-sm"><Link href="/announcements">← Announcements</Link></p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ProvenanceBadge p={a.provenance} />
        <StatusBadge s={a.status} />
        {a.isFictional && <FictionTag />}
        {a.aiGenerated && <span className="text-xs text-ink-700">Summary drafted with AI, reviewed by an editor</span>}
      </div>
      <h1 className="h-page mt-3 max-w-3xl">{a.headline}</h1>
      {a.status === "RETRACTED" && <div className="mt-3"><Notice tone="risk" title={`Retracted ${fmtDate(a.retractedAt)}`}>{a.retractionReason}</Notice></div>}
      {a.status === "SUPERSEDED" && a.supersededBy && <div className="mt-3"><Notice tone="warn" title="Superseded">A newer version replaces this item: <Link href={`/announcements/${a.supersededBy.id}`}>{a.supersededBy.headline}</Link></Notice></div>}
      {a.status === "IN_REVIEW" || a.status === "DRAFT" ? <div className="mt-3"><Notice tone="warn" title="Not published">This item is visible only to editorial staff until it is reviewed and published.</Notice></div> : null}
      {a.supersedes && <p className="mt-2 text-sm">This item replaces an earlier version: <Link href={`/announcements/${a.supersedes.id}`}>{a.supersedes.headline}</Link></p>}

      <section className="card mt-4 space-y-4">
        <div><h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700">Summary</h2><p className="mt-1">{a.summary}</p></div>
        {a.whatChanged && <div><h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700">What changed</h2><p className="mt-1">{a.whatChanged}</p></div>}
        <div><h2 className="text-sm font-semibold uppercase tracking-wide text-brand-800">Why it could matter to investors</h2><p className="mt-1">{a.whyItMatters}</p><p className="hint">Interpretation, not a disclosed fact or a recommendation.</p></div>
        <div><h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Important uncertainties</h2><p className="mt-1">{a.uncertainties}</p></div>
        {a.alternativeExplanations && <div><h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700">Alternative explanations</h2><p className="mt-1">{a.alternativeExplanations}</p></div>}
        {a.openQuestions && <div><h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700">Questions to investigate next</h2><p className="mt-1">{a.openQuestions}</p></div>}
        {a.analysis && <div><h2 className="text-sm font-semibold uppercase tracking-wide text-ink-700">Analysis</h2><p className="mt-1">{a.analysis}</p></div>}
      </section>

      <section className="card mt-4">
        <h2 className="h-section">Supporting evidence</h2>
        <ul className="mt-2 space-y-3">
          {a.excerpts.map((e) => (
            <li key={e.id} className="border-l-4 border-brand-600 pl-3 text-sm">
              <blockquote className="italic">“{e.quote}”</blockquote>
              {e.document ? <SourceLink href={`/documents/${e.document.id}?page=${e.page ?? 1}`}>{e.document.title}{e.page ? `, page ${e.page}` : ""}</SourceLink> : <span className="text-xs text-ink-700">Excerpt from the original source (no stored document)</span>}
            </li>
          ))}
        </ul>
        {a.conflictClaims.length > 0 && (
          <div className="mt-4"><Notice tone="warn" title="Part of an unresolved conflict">{a.conflictClaims.map((c) => <span key={c.id}>{c.conflict.topic}: {c.conflict.claims.map((x) => `${x.sourceLabel} says “${x.claim}”`).join(" vs ")}. </span>)}</Notice></div>
        )}
      </section>

      <section className="card mt-4 text-sm">
        <h2 className="h-section">Source record</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div><dt className="text-xs text-ink-700">Company</dt><dd>{a.company.name}</dd></div>
          <div><dt className="text-xs text-ink-700">Legal entity</dt><dd>{a.legalEntity?.name ?? "Not specified"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-ink-700">Original title</dt><dd>{a.originalTitle}</dd></div>
          <div><dt className="text-xs text-ink-700">Publisher</dt><dd>{a.publisher}</dd></div>
          <div><dt className="text-xs text-ink-700">Original URL</dt><dd className="break-all"><SourceLink href={a.sourceUrl}>{a.sourceUrl}</SourceLink></dd></div>
          <div><dt className="text-xs text-ink-700">Source publication date</dt><dd>{fmtDate(a.sourcePublishedAt)}</dd></div>
          <div><dt className="text-xs text-ink-700">Event date</dt><dd>{fmtDate(a.eventDate)}</dd></div>
          <div><dt className="text-xs text-ink-700">Retrieved</dt><dd>{fmtDateTime(a.retrievedAt)}</dd></div>
          <div><dt className="text-xs text-ink-700">Document type and version</dt><dd>{documentTypeLabel[a.documentType]}, version {a.sourceVersion}</dd></div>
          <div><dt className="text-xs text-ink-700">Review</dt><dd>{reviewer ? `Reviewed by ${reviewer.name}, ${fmtDate(a.reviewedAt)}` : "Not yet reviewed"}</dd></div>
          <div><dt className="text-xs text-ink-700">Published on RefineryLens</dt><dd>{fmtDateTime(a.publishedAt)}</dd></div>
          <div><dt className="text-xs text-ink-700">Topics</dt><dd>{a.topics.map((t) => topicLabel[t] ?? t).join(", ")}</dd></div>
          <div><dt className="text-xs text-ink-700">Revision</dt><dd>{a.revision}</dd></div>
        </dl>
        <Explainer title="What the provenance label means">
          <p>Provenance labels describe who published the information: the company, a regulator or exchange, an independent reporter, an analyst estimate, a user assumption, or unverified. They are not guarantees that the information is accurate.</p>
        </Explainer>
      </section>

      <section className="card mt-4">
        <h2 className="h-section">Correction and supersession history</h2>
        {a.corrections.length === 0 ? <p className="muted mt-1">No corrections have been made to this item.</p> : (
          <ol className="mt-2 space-y-3 text-sm">
            {a.corrections.map((c) => (
              <li key={c.id}>
                <p><span className="font-medium">{c.kind.toLowerCase().replace("_", " ")}</span> · {fmtDateTime(c.createdAt)}</p>
                <p>{c.summary}</p>
                {c.before && (
                  <Explainer title="Show previous values">
                    {Object.entries(c.before as Record<string, unknown>).map(([k, v]) => <p key={k}><strong>{k}</strong> was: {String(v)}</p>)}
                  </Explainer>
                )}
              </li>
            ))}
          </ol>
        )}
        {a.reviews.length > 0 && can.viewEditorial(user) && (
          <div className="mt-4 border-t border-ink-50 pt-3 text-sm">
            <p className="font-medium">Editorial reviews (staff only)</p>
            <ul className="mt-1 space-y-1">{a.reviews.map((r) => <li key={r.id}>{fmtDateTime(r.createdAt)}: {r.decision} by {r.reviewer.name}{r.notes && ` — ${r.notes}`}</li>)}</ul>
          </div>
        )}
        {can.publish(user) && <p className="mt-3 text-sm"><Link href={`/editorial/announcements/${a.id}`}>Open in editorial workspace →</Link></p>}
      </section>

      {a.status === "PUBLISHED" && (
        <section className="card mt-4">
          <h2 className="h-section">Add to my thesis</h2>
          {theses.length === 0 ? (
            <p className="muted mt-1">You have no thesis for this company. <Link href="/thesis/new">Create one</Link> to record how this disclosure affects your assumptions.</p>
          ) : (
            <LinkEvidenceForm announcementId={a.id} theses={theses.map((t) => ({ id: t.id, title: t.title, assumptions: t.assumptions.map((x) => ({ id: x.id, statement: x.statement })) }))} />
          )}
        </section>
      )}
    </article>
  );
}
