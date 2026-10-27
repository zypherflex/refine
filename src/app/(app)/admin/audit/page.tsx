import Link from "next/link";
import { requireRole } from "@/server/auth";
import { searchAudit } from "@/server/admin/system";
import { PAGE_SIZE, pageOf } from "@/server/admin/guard";
import { fmtDateTime } from "@/lib/format";
import { Field, FilterBar, Pager, Select } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Audit log · Administration" };
export const dynamic = "force-dynamic";

type SP = { action?: string; actor?: string; entity?: string; entityId?: string; from?: string; to?: string; page?: string };

export default async function AdminAudit({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { total, rows, entities } = await searchAudit(admin, { ...sp, page });
  return (
    <>
      <PageHeader eyebrow="System" title="Audit log" subtitle="Every important action: sign-ins, publishing, verification, moderation, exports and admin changes. Entries cannot be edited or deleted here." />
      <FilterBar action="/admin/audit">
        <Field label="Action starts with"><input name="action" defaultValue={sp.action ?? ""} placeholder="e.g. admin. or user.login" className="input w-48 py-1.5 font-mono text-xs" /></Field>
        <Field label="Who (email)"><input name="actor" defaultValue={sp.actor ?? ""} className="input w-48 py-1.5 text-sm" /></Field>
        <Field label="Entity"><Select name="entity" value={sp.entity} options={entities} /></Field>
        <Field label="Entity ID"><input name="entityId" defaultValue={sp.entityId ?? ""} className="input w-40 py-1.5 font-mono text-xs" /></Field>
        <Field label="From"><input type="date" name="from" defaultValue={sp.from ?? ""} className="input py-1.5 text-sm" /></Field>
        <Field label="To"><input type="date" name="to" defaultValue={sp.to ?? ""} className="input py-1.5 text-sm" /></Field>
      </FilterBar>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(l.createdAt)}</td>
                <td className="text-sm">{l.actor ? <Link href={`/admin/users/${l.actor.id}`}>{l.actor.name}</Link> : "System"}</td>
                <td><Link href={`/admin/audit?action=${encodeURIComponent(l.action)}`}><code className="text-xs">{l.action}</code></Link></td>
                <td className="text-xs"><Link href={`/admin/audit?entity=${encodeURIComponent(l.entityType)}&entityId=${encodeURIComponent(l.entityId)}`}>{l.entityType} <span className="font-mono">{l.entityId.slice(0, 12)}</span></Link></td>
                <td className="max-w-xs truncate font-mono text-[11px] text-ink-600" title={l.metadata ? JSON.stringify(l.metadata) : ""}>{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/audit" params={{ ...sp, page: undefined }} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
