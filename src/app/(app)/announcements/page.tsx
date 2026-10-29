import Link from "next/link";
import type { Provenance } from "@prisma/client";
import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { listAnnouncements } from "@/server/services/announcements";
import { openConflicts } from "@/server/views";
import { provenanceLabel, topicLabel, TOPICS } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { EmptyState, PageHeader, ProvenanceBadge, SourceLink } from "@/components/ui";

export const metadata = { title: "Announcements and news" };

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ topic?: string; provenance?: string; q?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const company = await selectedCompany();
  if (!company) return <EmptyState title="No company selected" />;
  const provenance = sp.provenance && sp.provenance in provenanceLabel ? (sp.provenance as Provenance) : undefined;
  const [items, conflicts] = await Promise.all([
    listAnnouncements(user, { companyId: company.id, topic: sp.topic || undefined, provenance, q: sp.q || undefined, take: 100 }),
    openConflicts(company.id),
  ]);
  return (
    <>
      <PageHeader eyebrow="Research" title="Announcements and news" subtitle="Company disclosures, exchange and regulator publications, and independent reporting. Every item has been reviewed by an editor before publication. Retracted and superseded items stay visible with a notice." />
      <form className="card mb-5 grid gap-3 sm:grid-cols-4" role="search">
        <div className="sm:col-span-2">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={sp.q} className="input" placeholder="Headline, summary or publisher" />
        </div>
        <div>
          <label htmlFor="topic" className="label">Topic</label>
          <select id="topic" name="topic" defaultValue={sp.topic ?? ""} className="input">
            <option value="">All topics</option>
            {TOPICS.map((t) => <option key={t} value={t}>{topicLabel[t]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="provenance" className="label">Provenance</label>
          <select id="provenance" name="provenance" defaultValue={sp.provenance ?? ""} className="input">
            <option value="">All</option>
            {Object.entries(provenanceLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex gap-2 sm:col-span-4">
          <button className="btn-primary">Apply filters</button>
          <Link href="/announcements" className="btn-secondary">Clear</Link>
        </div>
      </form>

      {conflicts.length > 0 && (
        <section id="conflicts" aria-labelledby="conflicts-h" className="mb-6">
          <h2 id="conflicts-h" className="h-section">Conflicting sources</h2>
          <p className="muted">When sources disagree, both claims are shown with their dates. RefineryLens does not pick the convenient value.</p>
          {conflicts.map((c) => (
            <div key={c.id} className="card mt-2 border-amber-600/40">
              <p className="font-medium">{c.topic}</p>
              <p className="text-sm text-ink-700">{c.description}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {c.claims.map((x) => (
                  <div key={x.id} className="rounded-md bg-ink-50 p-3 text-sm">
                    <ProvenanceBadge p={x.provenance} />
                    <p className="mt-1 font-semibold">{x.claim}</p>
                    <p className="text-xs text-ink-700">{x.sourceLabel} · {fmtDate(x.sourceDate)}</p>
                    {x.announcement && <p className="mt-1 text-xs"><Link href={`/announcements/${x.announcement.id}`}>Related announcement</Link></p>}
                    {x.metric?.documentId && <p className="text-xs"><SourceLink href={`/documents/${x.metric.documentId}?page=${x.metric.page ?? 1}`}>Source page {x.metric.page ?? 1}</SourceLink></p>}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-amber-800">Status: unresolved difference</p>
            </div>
          ))}
        </section>
      )}

      <section aria-label="Announcements" className="space-y-3">
        {items.length === 0 ? <EmptyState title="No announcements match these filters" /> : items.map((a) => <AnnouncementCard key={a.id} a={a} />)}
      </section>
    </>
  );
}
