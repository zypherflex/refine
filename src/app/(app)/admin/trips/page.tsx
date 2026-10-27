import Link from "next/link";
import { requireRole } from "@/server/auth";
import { listTrips } from "@/server/admin/everyday";
import { STALE_TRIP_MS } from "@/server/admin/attention";
import { endTripAction } from "@/app/actions/admin-tools";
import { fmtDateTime } from "@/lib/format";
import { Badge, Field, FilterBar, Select } from "@/components/admin/parts";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Live trips · Administration" };
export const dynamic = "force-dynamic";

export default async function AdminTrips({ searchParams }: { searchParams: Promise<{ status?: string; stale?: string }> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const trips = await listTrips(admin, sp);
  const now = Date.now();
  return (
    <>
      <PageHeader eyebrow="Everyday" title="Live trips" subtitle="Drivers sharing their location for gas orders and delivery jobs. End a trip left running; positions are deleted 7 days after a trip ends. Exact positions are not shown here." />
      <FilterBar action="/admin/trips">
        <Field label="Status"><Select name="status" value={sp.status} options={[["LIVE", "Sharing"], ["WAITING", "Link sent, not sharing"], ["ENDED", "Ended"]]} all="Open trips" /></Field>
        <Field label="Stale"><Select name="stale" value={sp.stale} options={[["yes", `No position for ${STALE_TRIP_MS / 60_000} min`]]} all="Any" /></Field>
      </FilterBar>
      {trips.length === 0 ? <EmptyState title="No trips match" /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Delivery</th><th>Business · driver</th><th>Status</th><th>Last position</th><th className="text-right">Positions</th><th /></tr></thead>
            <tbody>
              {trips.map((t) => {
                const stale = t.status === "LIVE" && t.lastAt && now - t.lastAt.getTime() > STALE_TRIP_MS;
                return (
                  <tr key={t.id}>
                    <td>{t.gasOrder ? <Link href={`/orders/${t.gasOrder.id}`}>Gas order to {t.gasOrder.area}, {t.gasOrder.state}</Link> : t.deliveryJob ? <Link href={`/hub/jobs/${t.deliveryJob.id}`}>{t.deliveryJob.title}</Link> : "–"}</td>
                    <td className="text-sm">{t.business.name} · {t.driverName}</td>
                    <td><Badge tone={t.status === "LIVE" ? (stale ? "warn" : "good") : t.status === "WAITING" ? "navy" : "plain"}>{stale ? "live, silent" : t.status.toLowerCase()}</Badge></td>
                    <td className="text-xs">{t.lastAt ? fmtDateTime(t.lastAt) : "none yet"}</td>
                    <td className="num text-right">{t._count.pings}</td>
                    <td>{t.status !== "ENDED" && <form action={endTripAction}><input type="hidden" name="id" value={t.id} /><button className="btn-ghost btn-sm text-risk-700">End trip</button></form>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
