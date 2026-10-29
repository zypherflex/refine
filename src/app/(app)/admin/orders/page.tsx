import Link from "next/link";
import { requireRole } from "@/server/auth";
import { listOrdersAdmin } from "@/server/admin/everyday";
import { PAGE_SIZE, pageOf } from "@/server/admin/guard";
import { cancelOrderAdminAction } from "@/app/actions/admin-tools";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { naira } from "@/lib/hub/prices";
import { ORDER_STATUS } from "@/lib/everyday";
import { fmtDateTime } from "@/lib/format";
import { ReasonAction } from "@/components/admin/forms";
import { Field, FilterBar, Pager, Select, Stat } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Gas orders · Administration" };
export const dynamic = "force-dynamic";

type SP = { q?: string; status?: string; view?: string; state?: string; page?: string };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { total, rows, byStatus } = await listOrdersAdmin(admin, { ...sp, page });
  return (
    <>
      <PageHeader eyebrow="Everyday" title="Gas orders" subtitle="Every home delivery order. Stuck orders are ones a seller has not answered for 2 hours, or that have been open for over a day." actions={<Link href="/admin/orders?view=stuck" className="btn-secondary btn-sm no-underline">Show stuck orders</Link>} />
      <section aria-label="Orders by status" className="mb-4 grid grid-cols-3 gap-3 md:grid-cols-6">
        {(Object.keys(ORDER_STATUS) as (keyof typeof ORDER_STATUS)[]).map((st) => <Stat key={st} label={ORDER_STATUS[st].label} value={byStatus[st] ?? 0} href={`/admin/orders?status=${st}`} />)}
      </section>
      <FilterBar action="/admin/orders">
        <Field label="Search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Area, seller or customer email" className="input w-56 py-1.5 text-sm" /></Field>
        <Field label="Status"><Select name="status" value={sp.status} options={Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label] as const)} /></Field>
        <Field label="State"><Select name="state" value={sp.state} options={NIGERIAN_STATES} /></Field>
        <Field label="View"><Select name="view" value={sp.view} options={[["stuck", "Stuck only"]]} all="All orders" /></Field>
      </FilterBar>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Order</th><th>Customer</th><th>Seller</th><th>Where</th><th className="text-right">Price</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td><Link href={`/orders/${o.id}`} className="font-medium">{o.cylinders} × {o.cylinderKg} kg</Link><p className="text-xs text-ink-600">{fmtDateTime(o.createdAt)}</p></td>
                <td className="text-sm"><Link href={`/admin/users/${o.user.id}`}>{o.user.name}</Link></td>
                <td className="text-sm">{o.business.name}</td>
                <td className="text-sm">{o.area}, {o.state}</td>
                <td className="num text-right">{o.priceNaira ? naira(o.priceNaira) : o.estimateNaira ? `~${naira(o.estimateNaira)}` : "–"}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-xs ${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span>{o.trip && <p className="mt-0.5 text-[11px] text-ink-500">driver {o.trip.status.toLowerCase()}</p>}</td>
                <td>{["PLACED", "ACCEPTED", "OUT_FOR_DELIVERY"].includes(o.status) ? <ReasonAction action={cancelOrderAdminAction} id={o.id} label="Cancel" placeholder="Why, e.g. seller unreachable" /> : "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/orders" params={{ ...sp, page: undefined }} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
