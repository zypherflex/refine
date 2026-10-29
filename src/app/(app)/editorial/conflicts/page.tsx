import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { conflictAction } from "@/app/actions/editorial";
import { selectedCompany } from "@/server/services/companies";
import { provenanceLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fmtDate } from "@/lib/format";
import { EditorialNav } from "@/components/EditorialNav";
import { EmptyState, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Conflicts" };

export default async function ConflictsPage() {
  const user = await requireRole("ANALYST");
  const company = await selectedCompany();
  const [conflicts, anns] = await Promise.all([
    db.sourceConflict.findMany({ include: { claims: true, company: true }, orderBy: { createdAt: "desc" } }),
    company ? db.announcement.findMany({ where: { companyId: company.id }, select: { id: true, headline: true } }) : [],
  ]);
  const editor = can.publish(user);
  const provOpts = Object.entries(provenanceLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>);
  return (
    <>
      <PageHeader eyebrow="Editorial desk" title="Conflicting disclosures" subtitle="Flag sources that disagree. Published conflicts show both claims and dates to readers until resolved; resolving requires a note." />
      <EditorialNav />
      {conflicts.length === 0 ? <EmptyState title="No conflicts flagged" /> : (
        <ul className="space-y-3">
          {conflicts.map((c) => (
            <li key={c.id} className="card">
              <div className="flex items-center gap-2"><Pill className={c.status === "UNRESOLVED" ? "bg-amber-100 text-amber-800" : c.status === "DRAFT" ? "bg-ink-100" : "bg-brand-100 text-brand-800"}>{c.status === "DRAFT" ? "Flagged, not yet public" : c.status.toLowerCase()}</Pill><span className="text-xs text-ink-700">{c.company.name}</span></div>
              <p className="mt-1 font-medium">{c.topic}</p>
              <p className="text-sm text-ink-700">{c.description}</p>
              <ul className="mt-2 text-sm">{c.claims.map((x) => <li key={x.id}>“{x.claim}” — {x.sourceLabel}, {fmtDate(x.sourceDate)} ({provenanceLabel[x.provenance]})</li>)}</ul>
              {c.resolution && <p className="mt-1 text-sm"><strong>Resolution:</strong> {c.resolution}</p>}
              {editor && c.status !== "RESOLVED" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.status === "DRAFT" && <form action={conflictAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="publish" /><button className="btn-primary btn-sm">Publish conflict</button></form>}
                  <form action={conflictAction} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={c.id} /><input type="hidden" name="op" value="resolve" /><input name="resolution" required minLength={10} className="input" placeholder="How it was resolved, with source" aria-label="Resolution note" /><button className="btn-secondary btn-sm">Mark resolved</button></form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {editor && company && (
        <form action={conflictAction} className="card mt-6 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="op" value="create" />
          <input type="hidden" name="companyId" value={company.id} />
          <h2 className="h-section sm:col-span-2">Flag a new conflict for {company.name}</h2>
          <div><label className="label" htmlFor="topic">Topic</label><input id="topic" name="topic" required className="input" /></div>
          <div><label className="label" htmlFor="description">Description</label><input id="description" name="description" className="input" /></div>
          {(["A", "B"] as const).map((k) => (
            <fieldset key={k} className="space-y-2 rounded-md border border-ink-100 p-3">
              <legend className="text-sm font-semibold">Claim {k}</legend>
              <input name={`claim${k}`} required className="input" placeholder="What this source says" aria-label={`Claim ${k}`} />
              <input name={`source${k}`} required className="input" placeholder="Source and location" aria-label={`Source ${k}`} />
              <input name={`date${k}`} type="date" className="input" aria-label={`Date ${k}`} />
              <select name={`prov${k}`} className="input" aria-label={`Provenance ${k}`}>{provOpts}</select>
              <select name={`ann${k}`} className="input" aria-label={`Related announcement ${k}`}><option value="">No linked announcement</option>{anns.map((a) => <option key={a.id} value={a.id}>{a.headline}</option>)}</select>
            </fieldset>
          ))}
          <div><button className="btn-primary">Flag and publish conflict</button></div>
        </form>
      )}
    </>
  );
}
