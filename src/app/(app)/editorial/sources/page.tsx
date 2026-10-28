import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { approveSourceAction, createSourceAction } from "@/app/actions/editorial";
import { provenanceLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { fmtDate } from "@/lib/format";
import { EditorialNav } from "@/components/EditorialNav";
import { PageHeader, Pill, ProvenanceBadge, SourceLink } from "@/components/ui";

export const metadata = { title: "Sources" };

export default async function SourcesPage() {
  const user = await requireRole("ANALYST");
  const sources = await db.source.findMany({ orderBy: [{ approved: "asc" }, { name: "asc" }], include: { _count: { select: { documents: true, announcements: true } } } });
  const editor = can.publish(user);
  return (
    <>
      <PageHeader eyebrow="Editorial desk" title="Sources" subtitle="Only approved sources can back published announcements. Record licence and permission notes; do not ingest content you are not permitted to use." />
      <EditorialNav />
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.id} className="card">
            <div className="flex flex-wrap items-center gap-1.5"><ProvenanceBadge p={s.provenance} /><Pill className={s.approved ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-800"}>{s.approved ? `Approved ${fmtDate(s.approvedAt)}` : "Awaiting approval"}</Pill>{s.isFictional && <Pill className="bg-amber-100 text-amber-800">Fictional</Pill>}</div>
            <p className="mt-1 font-medium">{s.name}</p>
            <p className="text-xs text-navy-700">{s.publisher} · {s.homepageUrl && <SourceLink href={s.homepageUrl}>{s.homepageUrl}</SourceLink>} · {s._count.documents} documents · {s._count.announcements} announcements</p>
            {s.licenseNotes && <p className="mt-1 text-sm"><span className="font-medium">Licence and permissions:</span> {s.licenseNotes}</p>}
            {editor && <form action={approveSourceAction} className="mt-2"><input type="hidden" name="id" value={s.id} /><button name="approve" value={s.approved ? "0" : "1"} className={s.approved ? "btn-secondary btn-sm" : "btn-primary btn-sm"}>{s.approved ? "Revoke approval" : "Approve source"}</button></form>}
          </li>
        ))}
      </ul>
      {editor && (
        <form action={createSourceAction} className="card mt-6 grid gap-3 sm:grid-cols-2">
          <h2 className="h-section sm:col-span-2">Register a source</h2>
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required className="input" /></div>
          <div><label className="label" htmlFor="publisher">Publisher</label><input id="publisher" name="publisher" className="input" /></div>
          <div><label className="label" htmlFor="homepageUrl">Homepage</label><input id="homepageUrl" name="homepageUrl" type="url" className="input" /></div>
          <div><label className="label" htmlFor="provenance">Provenance</label><select id="provenance" name="provenance" className="input">{Object.entries(provenanceLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="licenseNotes">Licence and permission notes</label><textarea id="licenseNotes" name="licenseNotes" className="input" /></div>
          <div><button className="btn-primary">Add source</button></div>
        </form>
      )}
    </>
  );
}
