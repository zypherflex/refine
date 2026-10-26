import Link from "next/link";
import type { Announcement, Company, LegalEntity } from "@prisma/client";
import { fmtDate } from "@/lib/format";
import { documentTypeLabel } from "@/lib/labels";
import { FictionTag, ProvenanceBadge, SourceLink, StatusBadge } from "./ui";

type A = Announcement & { legalEntity?: LegalEntity | null; company?: Company; supersededBy?: { id: string; headline: string } | null };

export function AnnouncementCard({ a, compact = false }: { a: A; compact?: boolean }) {
  const inactive = a.status === "RETRACTED" || a.status === "SUPERSEDED";
  return (
    <article className={`card ${inactive ? "opacity-80" : ""}`} aria-labelledby={`ann-${a.id}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <ProvenanceBadge p={a.provenance} />
        <StatusBadge s={a.status} />
        {a.isFictional && <FictionTag />}
        {a.revision > 1 && a.status === "PUBLISHED" && <span className="text-xs text-amber-800">Corrected (revision {a.revision})</span>}
      </div>
      <h3 id={`ann-${a.id}`} className="mt-2 text-base font-semibold leading-snug">
        <Link href={`/announcements/${a.id}`} className="text-ink-950">{a.headline}</Link>
      </h3>
      <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-700">
        <div><dt className="inline">Event date: </dt><dd className="inline">{fmtDate(a.eventDate)}</dd></div>
        <div><dt className="inline">Published by source: </dt><dd className="inline">{fmtDate(a.sourcePublishedAt)}</dd></div>
        <div><dt className="inline">Source: </dt><dd className="inline"><SourceLink href={a.sourceUrl}>{a.publisher}</SourceLink> · {documentTypeLabel[a.documentType]}</dd></div>
        {a.legalEntity && <div><dt className="inline">Entity: </dt><dd className="inline">{a.legalEntity.name}</dd></div>}
      </dl>
      {a.status === "RETRACTED" && <p className="mt-2 rounded bg-risk-50 px-2 py-1 text-sm text-risk-800"><strong>Retracted:</strong> {a.retractionReason}</p>}
      {a.status === "SUPERSEDED" && <p className="mt-2 rounded bg-ink-50 px-2 py-1 text-sm">Superseded{a.supersededBy ? <> by <Link href={`/announcements/${a.supersededBy.id}`}>{a.supersededBy.headline}</Link></> : ""}.</p>}
      <p className="mt-2 text-sm">{a.summary}</p>
      {!compact && (
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Why it could matter</p>
            <p className="mt-0.5">{a.whyItMatters}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">What remains uncertain</p>
            <p className="mt-0.5">{a.uncertainties}</p>
          </div>
        </div>
      )}
      <p className="mt-3 text-sm"><Link href={`/announcements/${a.id}`}>Full analysis and evidence →</Link></p>
    </article>
  );
}
