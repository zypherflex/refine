import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { provenanceLabel, scopeLabel } from "@/lib/labels";
import { fmtDate } from "@/lib/format";
import { looksLikeInstructions } from "../extraction";
import type { RetrievedItem } from "./types";

const STOP = new Set(
  "a an and are as at be by can could did do does for from has have how i in is it its me my of on or our should so than that the their them then there these this to was we were what when where which who why will with would you your about into does any explain tell show give".split(" "),
);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => t.replace(/(ies)$/, "y").replace(/(s)$/, ""));
}

/** Simple term-overlap score with title boost; enough for a small, curated corpus. */
export function scoreText(queryTokens: string[], title: string, body: string): number {
  if (queryTokens.length === 0) return 0;
  const t = new Set(tokenize(title));
  const b = tokenize(body);
  const bset = new Map<string, number>();
  for (const w of b) bset.set(w, (bset.get(w) ?? 0) + 1);
  let score = 0;
  for (const q of new Set(queryTokens)) {
    if (t.has(q)) score += 2;
    const tf = bset.get(q) ?? 0;
    if (tf) score += 1 + Math.log(tf);
  }
  return score / Math.sqrt(new Set(queryTokens).size);
}

function snippet(text: string, tokens: string[], len = 320): string {
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    idx = lower.indexOf(t);
    if (idx >= 0) break;
  }
  const start = Math.max(0, (idx < 0 ? 0 : idx) - 80);
  const s = text.slice(start, start + len).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + s + (start + len < text.length ? "…" : "");
}

export type RetrievalOptions = { companyId: string; question: string; includeThesis?: boolean; documentId?: string; limit?: number };

/**
 * Retrieves evidence the actor is allowed to see: published announcements and metrics, approved public
 * documents, and only the actor's own private documents and theses. Nothing else can enter the context.
 */
export async function retrieve(actor: Actor, o: RetrievalOptions) {
  const tokens = tokenize(o.question);
  const items: Omit<RetrievedItem, "ref">[] = [];

  const [announcements, metrics, conflicts] = await Promise.all([
    db.announcement.findMany({ where: { companyId: o.companyId, status: { in: ["PUBLISHED", "RETRACTED", "SUPERSEDED"] } }, include: { excerpts: true }, orderBy: { sourcePublishedAt: "desc" } }),
    db.metric.findMany({ where: { companyId: o.companyId, status: "PUBLISHED" }, include: { document: { select: { title: true } } } }),
    db.sourceConflict.findMany({ where: { companyId: o.companyId, status: "UNRESOLVED" }, include: { claims: true } }),
  ]);

  for (const a of announcements) {
    const body = [a.summary, a.whatChanged, a.whyItMatters, a.uncertainties, a.analysis, a.topics.join(" ")].join("\n");
    const statusNote = a.status === "RETRACTED" ? " [RETRACTED: " + a.retractionReason + "]" : a.status === "SUPERSEDED" ? " [SUPERSEDED by a newer item]" : "";
    items.push({
      kind: "ANNOUNCEMENT",
      title: a.headline + statusNote,
      text: body,
      date: a.sourcePublishedAt,
      provenance: provenanceLabel[a.provenance],
      link: `/announcements/${a.id}`,
      score: scoreText(tokens, a.headline, body) * (a.status === "PUBLISHED" ? 1 : 0.4),
      isPrivate: false,
      isFictional: a.isFictional,
      announcementId: a.id,
      quote: a.excerpts[0]?.quote ?? a.summary,
    });
  }

  for (const m of metrics) {
    const value = m.disclosureStatus === "NOT_DISCLOSED" ? "Not publicly disclosed" : `${m.value === null ? "n/a" : Number(m.value).toLocaleString("en-GB")} ${m.currency ?? m.unit}${m.scale !== "units" ? " " + m.scale : ""}`;
    const text = `${m.label} for ${m.periodLabel} (${scopeLabel[m.scope]}): ${value}. ${m.valueType.toLowerCase()} figure, ${m.auditStatus.toLowerCase().replace("_", " ")}. ${m.methodology} ${m.notes}`;
    items.push({
      kind: "METRIC",
      title: `${m.label} — ${m.periodLabel}`,
      text,
      date: m.periodEnd ?? m.updatedAt,
      provenance: provenanceLabel[m.provenance],
      link: m.documentId ? `/documents/${m.documentId}?page=${m.page ?? 1}` : `/${m.category === "FINANCIAL" ? "financials" : "operations"}#${m.key}`,
      score: scoreText(tokens, m.label + " " + m.key.replace(/_/g, " "), text),
      isPrivate: false,
      isFictional: m.isFictional,
      metricId: m.id,
      documentId: m.documentId ?? undefined,
      page: m.page ?? undefined,
      quote: m.excerpt || text,
    });
  }

  for (const c of conflicts) {
    const text = `${c.description} Claims: ${c.claims.map((x) => `${x.sourceLabel} (${fmtDate(x.sourceDate)}): ${x.claim}`).join(" | ")}`;
    items.push({
      kind: "CONFLICT",
      title: `Unresolved conflict: ${c.topic}`,
      text,
      date: c.createdAt,
      provenance: "Conflicting sources",
      link: `/announcements?conflict=${c.id}#conflicts`,
      score: scoreText(tokens, c.topic, text) + 0.5,
      isPrivate: false,
      isFictional: false,
      quote: text,
    });
  }

  // Document pages: approved public documents for the company, plus the actor's own private files.
  const pages = await db.documentPage.findMany({
    where: {
      ...(o.documentId ? { documentId: o.documentId } : {}),
      document: {
        OR: [
          { visibility: "PUBLIC", status: "APPROVED", companyId: o.companyId },
          { visibility: "PRIVATE", ownerId: actor.id },
        ],
      },
    },
    include: { document: { select: { id: true, title: true, visibility: true, ownerId: true, provenance: true, publishedAt: true, isFictional: true } } },
    take: 2000,
  });
  for (const p of pages) {
    // Defence in depth: never let another user's private page through, whatever the query returned.
    if (p.document.visibility === "PRIVATE" && p.document.ownerId !== actor.id) continue;
    const isPrivate = p.document.visibility === "PRIVATE";
    items.push({
      kind: "DOCUMENT_PAGE",
      title: `${p.document.title}, page ${p.pageNumber}${isPrivate ? " (your private file)" : ""}`,
      text: p.text,
      date: p.document.publishedAt,
      provenance: isPrivate ? "Your uploaded document (unverified)" : provenanceLabel[p.document.provenance],
      link: `/documents/${p.document.id}?page=${p.pageNumber}`,
      score: scoreText(tokens, p.document.title, p.text) + (o.documentId ? 1 : 0),
      isPrivate,
      isFictional: p.document.isFictional,
      documentId: p.document.id,
      page: p.pageNumber,
      quote: snippet(p.text, tokens),
      flaggedInstructions: looksLikeInstructions(p.text),
    });
  }

  const theses = o.includeThesis
    ? await db.thesis.findMany({
        where: { ownerId: actor.id, companyId: o.companyId },
        include: { assumptions: true, evidence: { include: { announcement: { select: { id: true, headline: true } } } } },
      })
    : [];

  const ranked = items.sort((a, b) => b.score - a.score).slice(0, o.limit ?? 8);
  const refd: RetrievedItem[] = ranked.map((x, i) => ({ ...x, ref: `S${i + 1}` }));
  const cutoffDates = [...announcements.map((a) => a.retrievedAt), ...metrics.map((m) => m.updatedAt)];
  const cutoff = cutoffDates.length ? new Date(Math.max(...cutoffDates.map((d) => d.getTime()))) : null;
  return { items: refd, allAnnouncements: announcements, metrics, conflicts, theses, cutoff, tokens };
}
