import Link from "next/link";
import { requireRole } from "@/server/auth";
import { listOutletsAdmin } from "@/server/admin/everyday";
import { PAGE_SIZE, pageOf } from "@/server/admin/guard";
import { editOutletAction, mergeOutletAction, toggleOutletAction } from "@/app/actions/admin-tools";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { OUTLET_KINDS, outletKindLabel } from "@/lib/everyday";
import { fmtDate } from "@/lib/format";
import { AdminForm } from "@/components/admin/forms";
import { Badge, Field, FilterBar, Pager, Select } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Stations & shops · Administration" };
export const dynamic = "force-dynamic";

type SP = { q?: string; state?: string; kind?: string; hidden?: string; page?: string };

export default async function AdminOutlets({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { total, rows } = await listOutletsAdmin(admin, { ...sp, page });
  return (
    <>
      <PageHeader eyebrow="Everyday" title="Stations & shops" subtitle="Places people added. Correct details, hide places that closed or never existed, and merge duplicates so their reports count together." actions={<Link href="/admin/everyday" className="btn-secondary btn-sm no-underline">Flagged content</Link>} />
      <FilterBar action="/admin/outlets">
        <Field label="Search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Name, area or brand" className="input w-56 py-1.5 text-sm" /></Field>
        <Field label="State"><Select name="state" value={sp.state} options={NIGERIAN_STATES} /></Field>
        <Field label="Kind"><Select name="kind" value={sp.kind} options={OUTLET_KINDS.map((k) => [k.id, k.label] as const)} /></Field>
        <Field label="Visibility"><Select name="hidden" value={sp.hidden} options={[["no", "Visible"], ["yes", "Hidden"]]} all="Any" /></Field>
      </FilterBar>
      <ul className="space-y-3">
        {rows.map((o) => (
          <li key={o.id} className="card text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="flex flex-wrap items-center gap-1.5"><Link href={`/stations/${o.id}`} className="font-semibold">{o.name}</Link>{o.hidden && <Badge tone="bad">hidden</Badge>}{o.isDemo && <Badge>demo</Badge>}{o._count.contentFlags > 0 && <Badge tone="warn">{o._count.contentFlags} open flag{o._count.contentFlags === 1 ? "" : "s"}</Badge>}</p>
                <p className="text-xs text-ink-600">{outletKindLabel(o.kind)} · {[o.brand, o.area, o.state].filter(Boolean).join(" · ")} · {o._count.reports} reports · added {fmtDate(o.createdAt)}{o.addedBy ? <> by <Link href={`/admin/users/${o.addedBy.id}`}>{o.addedBy.name}</Link></> : ""}</p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-500">ID {o.id}</p>
              </div>
              <form action={toggleOutletAction}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="hidden" value={o.hidden ? "no" : "yes"} /><button className={o.hidden ? "btn-secondary btn-sm" : "btn-ghost btn-sm text-risk-700"}>{o.hidden ? "Show again" : "Hide"}</button></form>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <details className="text-xs"><summary className="cursor-pointer font-medium text-brand-700">Edit details</summary>
                <AdminForm action={editOutletAction} submit="Save" className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="id" value={o.id} />
                  <Field label="Name"><input name="name" defaultValue={o.name} required className="input py-1 text-sm" /></Field>
                  <Field label="Brand"><input name="brand" defaultValue={o.brand} className="input py-1 text-sm" /></Field>
                  <Field label="Kind"><Select name="kind" value={o.kind} options={OUTLET_KINDS.map((k) => [k.id, k.label] as const)} all={null} /></Field>
                  <Field label="Area"><input name="area" defaultValue={o.area} required className="input py-1 text-sm" /></Field>
                  <Field label="Address"><input name="address" defaultValue={o.address} className="input py-1 text-sm" /></Field>
                </AdminForm>
              </details>
              {!o.hidden && (
                <details className="text-xs"><summary className="cursor-pointer font-medium text-brand-700">Merge into another place…</summary>
                  <AdminForm action={mergeOutletAction} submit="Merge and hide this one" className="mt-2">
                    <input type="hidden" name="id" value={o.id} />
                    <Field label="ID of the place to keep (same state)"><input name="intoId" required className="input py-1 font-mono text-xs" placeholder="Copy the ID shown on the other place" /></Field>
                  </AdminForm>
                </details>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Pager base="/admin/outlets" params={{ ...sp, page: undefined }} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
