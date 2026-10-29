import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { editorialOptions } from "@/server/editorial-options";
import { publicationBlockers } from "@/server/services/announcements";
import { can } from "@/lib/permissions";
import { fmtDateTime } from "@/lib/format";
import { AnnouncementForm, CorrectionForm, WorkflowButton } from "@/components/EditorialForms";
import { EditorialNav } from "@/components/EditorialNav";
import { Notice, PageHeader, StatusBadge } from "@/components/ui";

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function EditAnnouncement({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireRole("ANALYST");
  const a = await db.announcement.findUnique({ where: { id }, include: { excerpts: true, reviews: { include: { reviewer: true }, orderBy: { createdAt: "desc" } }, supersededBy: true } });
  if (!a) notFound();
  const editable = a.status === "DRAFT" || a.status === "IN_REVIEW";
  const [opts, blockers, others] = await Promise.all([
    editorialOptions(),
    publicationBlockers(id),
    db.announcement.findMany({ where: { companyId: a.companyId, id: { not: id }, status: { in: ["PUBLISHED", "DRAFT", "IN_REVIEW"] } }, select: { id: true, headline: true }, orderBy: { sourcePublishedAt: "desc" } }),
  ]);
  const editor = can.publish(user);
  const d = { ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v instanceof Date ? iso(v) : v ?? ""])), topics: a.topics, excerpts: a.excerpts.map((e) => ({ quote: e.quote, documentId: e.documentId ?? "", page: e.page ? String(e.page) : "" })) };
  return (
    <>
      <PageHeader eyebrow="Editorial desk" title={a.headline} subtitle={<span className="flex items-center gap-2"><StatusBadge s={a.status} /> revision {a.revision} · <Link href={`/announcements/${a.id}`}>Reader view</Link></span>} />
      <EditorialNav />
      {sp.saved && <div className="mb-4"><Notice tone="ok">Draft saved.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {editable ? <AnnouncementForm d={d as any} {...opts} /> : a.status === "PUBLISHED" && editor ? (
            <section className="card">
              <h2 className="h-section">Correct this published item</h2>
              <p className="hint mb-3">Corrections are logged publicly with the previous values. Watchers and any thesis that uses this item are alerted.</p>
              <CorrectionForm id={a.id} d={{ headline: a.headline, summary: a.summary, whatChanged: a.whatChanged, whyItMatters: a.whyItMatters, uncertainties: a.uncertainties, eventDate: iso(a.eventDate), sourcePublishedAt: iso(a.sourcePublishedAt) }} />
            </section>
          ) : <Notice>This item is {a.status.toLowerCase()} and can no longer be edited.</Notice>}
        </div>
        <aside className="space-y-4">
          <section className="card space-y-3">
            <h2 className="h-section">Workflow</h2>
            {a.aiGenerated && editable && <Notice tone="warn">AI-generated draft. It must be checked against the source by a human editor before publication.</Notice>}
            {a.status === "DRAFT" && <WorkflowButton id={a.id} op="submit" label="Submit for review" />}
            {a.status === "IN_REVIEW" && editor && (
              <>
                <WorkflowButton id={a.id} op="approve" label={a.reviewerId ? "Approved ✓ (approve again)" : "Approve after checking sources"} fields={<textarea name="notes" className="input min-h-14" placeholder="Review notes (optional)" aria-label="Review notes" />} />
                <WorkflowButton id={a.id} op="request_changes" label="Request changes" tone="secondary" fields={<textarea name="notes" className="input min-h-14" placeholder="What needs to change" aria-label="Requested changes" required />} />
              </>
            )}
            {a.status === "IN_REVIEW" && editor && (
              <div>
                {blockers.length > 0 ? <Notice tone="warn" title="Not ready to publish"><ul className="list-disc pl-4">{blockers.map((b) => <li key={b}>{b}</li>)}</ul></Notice> : <WorkflowButton id={a.id} op="publish" label="Publish" />}
              </div>
            )}
            {a.status === "IN_REVIEW" && !editor && <p className="text-sm text-ink-700">Waiting for an editor to review.</p>}
            {a.status === "PUBLISHED" && editor && (
              <>
                {a.supersededBy ? <p className="text-sm">Replacement draft: <Link href={`/editorial/announcements/${a.supersededBy.id}`}>{a.supersededBy.headline}</Link></p> : <Link href={`/editorial/announcements/new?supersedes=${a.id}`} className="btn-secondary w-full">Supersede with a new version</Link>}
                <WorkflowButton id={a.id} op="retract" label="Retract" tone="danger" fields={<textarea name="reason" className="input min-h-14" required minLength={10} placeholder="Public reason for retraction" aria-label="Retraction reason" />} />
              </>
            )}
            {editor && (a.status === "PUBLISHED" || editable) && others.length > 0 && (
              <WorkflowButton id={a.id} op="duplicate" label="Mark as duplicate" tone="secondary" fields={<select name="duplicateOfId" className="input" aria-label="Duplicate of">{others.map((o) => <option key={o.id} value={o.id}>{o.headline}</option>)}</select>} />
            )}
          </section>
          <section className="card text-sm">
            <h2 className="h-section">Review history</h2>
            {a.reviews.length === 0 ? <p className="muted">No reviews yet.</p> : <ul className="mt-1 space-y-1">{a.reviews.map((r) => <li key={r.id}>{fmtDateTime(r.createdAt)}: <strong>{r.decision}</strong> by {r.reviewer.name}{r.notes && ` — ${r.notes}`}</li>)}</ul>}
          </section>
        </aside>
      </div>
    </>
  );
}
