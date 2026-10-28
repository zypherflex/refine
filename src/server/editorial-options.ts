import { db } from "@/lib/db";
import { documentTypeLabel, provenanceLabel, topicLabel, TOPICS } from "@/lib/labels";

export async function editorialOptions() {
  const [companies, entities, sources, documents] = await Promise.all([
    db.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.legalEntity.findMany({ select: { id: true, name: true, companyId: true } }),
    db.source.findMany({ select: { id: true, name: true, approved: true }, orderBy: { name: "asc" } }),
    db.document.findMany({ where: { visibility: "PUBLIC" }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    companies,
    entities,
    sources,
    documents: documents.map((d) => ({ id: d.id, name: d.title })),
    docTypes: Object.entries(documentTypeLabel) as [string, string][],
    provenances: Object.entries(provenanceLabel) as [string, string][],
    topics: TOPICS.map((t) => [t, topicLabel[t]] as [string, string]),
  };
}
