import Link from "next/link";
import { requireUser } from "@/server/auth";
import { correctionsLog } from "@/server/services/announcements";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, Explainer, FictionTag, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Corrections log" };

const kindStyle: Record<string, string> = { CORRECTION: "bg-amber-100 text-amber-800", RETRACTION: "bg-risk-100 text-risk-800", SUPERSESSION: "bg-navy-100 text-navy-800", EXTRACTION_FIX: "bg-navy-100 text-navy-800" };

export default async function CorrectionsPage() {
  await requireUser();
  const log = await correctionsLog();
  return (
    <>
      <PageHeader eyebrow="Sources" title="Corrections log" subtitle="Every correction, retraction and supersession of published content, with what changed. Earlier values are never silently overwritten." />
      {log.length === 0 ? <EmptyState title="No corrections yet" /> : (
        <ol className="space-y-3">
          {log.map((c) => (
            <li key={c.id} className="card">
              <div className="flex flex-wrap items-center gap-2"><Pill className={kindStyle[c.kind] ?? ""}>{c.kind.toLowerCase().replace("_", " ")}</Pill><span className="text-xs text-navy-700">{fmtDateTime(c.createdAt)}</span>{(c.announcement?.isFictional || c.metric?.isFictional) && <FictionTag />}</div>
              <p className="mt-1 font-medium">{c.announcement ? <Link href={`/announcements/${c.announcement.id}`}>{c.announcement.headline}</Link> : c.metric ? `${c.metric.label} (${c.metric.periodLabel})` : c.entityType}</p>
              <p className="mt-1 text-sm">{c.summary}</p>
              {c.before && <Explainer title="Show previous values">{Object.entries(c.before as Record<string, unknown>).map(([k, v]) => <p key={k}><strong>{k}</strong> was: {String(v)}</p>)}</Explainer>}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
