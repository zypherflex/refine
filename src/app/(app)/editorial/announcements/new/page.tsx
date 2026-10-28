import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { editorialOptions } from "@/server/editorial-options";
import { selectedCompany } from "@/server/services/companies";
import { AnnouncementForm } from "@/components/EditorialForms";
import { EditorialNav } from "@/components/EditorialNav";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "New announcement" };

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export default async function NewAnnouncement({ searchParams }: { searchParams: Promise<{ supersedes?: string; document?: string; lead?: string }> }) {
  const sp = await searchParams;
  await requireRole("ANALYST");
  const [opts, company] = await Promise.all([editorialOptions(), selectedCompany()]);
  const old = sp.supersedes ? await db.announcement.findUnique({ where: { id: sp.supersedes }, include: { excerpts: true } }) : null;
  const doc = sp.document ? await db.document.findUnique({ where: { id: sp.document } }) : null;
  const lead = sp.lead ? await db.newsLead.findUnique({ where: { id: sp.lead } }) : null;
  const d = old
    ? { ...Object.fromEntries(Object.entries(old).map(([k, v]) => [k, v instanceof Date ? iso(v) : v ?? ""])), id: "", supersedesId: old.id, topics: old.topics, excerpts: old.excerpts.map((e) => ({ quote: e.quote, documentId: e.documentId ?? "", page: e.page ? String(e.page) : "" })) }
    : doc
      ? { companyId: doc.companyId ?? company?.id ?? "", sourceId: doc.sourceId ?? "", originalTitle: doc.title, publisher: doc.publisher, sourceUrl: doc.url, documentType: doc.documentType, provenance: doc.provenance, sourcePublishedAt: iso(doc.publishedAt), topics: doc.topics, isFictional: doc.isFictional, excerpts: [{ quote: "", documentId: doc.id, page: "1" }] }
      : lead
        ? { companyId: lead.companyId, originalTitle: lead.title, publisher: lead.domain, sourceUrl: lead.url, documentType: "NEWS_REPORT", provenance: "INDEPENDENT_REPORT", sourcePublishedAt: iso(lead.seenAt) }
        : { companyId: company?.id ?? "", provenance: "COMPANY_DISCLOSED" };
  return (
    <>
      <PageHeader eyebrow="Editorial desk" title={old ? "Supersede announcement" : "New announcement"} subtitle="Drafts are only visible to editorial staff until an editor reviews and publishes them." />
      <EditorialNav />
      {lead && <div className="mb-4"><Notice tone="warn">Started from a news lead. Read the article, write the summary in your own words, and confirm the publication date: the date filled in is when news monitoring first saw it.</Notice></div>}
      {old && <div className="mb-4"><Notice tone="warn">This draft will replace “{old.headline}”. When it is published, the earlier item is marked superseded and readers are alerted.</Notice></div>}
      <AnnouncementForm d={d as any} {...opts} />
    </>
  );
}
