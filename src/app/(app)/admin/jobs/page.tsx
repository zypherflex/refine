import Link from "next/link";
import { requireRole } from "@/server/auth";
import { listJobs } from "@/server/admin/hub";
import { PAGE_SIZE, pageOf } from "@/server/admin/guard";
import { cancelJobAction } from "@/app/actions/admin-tools";
import { naira } from "@/lib/hub/prices";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ReasonAction } from "@/components/admin/forms";
import { Badge, Field, FilterBar, Pager, Select } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Delivery jobs · Administration" };
export const dynamic = "force-dynamic";

type SP = { q?: string; status?: string; stale?: string; page?: string };
const tone = { OPEN: "navy", AWARDED: "warn", DELIVERED: "good", CANCELLED: "plain" } as const;

export default async function AdminJobs({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { total, rows } = await listJobs(admin, { ...sp, page });
  return (
    <>
      <PageHeader eyebrow="Trade hub" title="Delivery jobs" subtitle="Loads posted by businesses, the quotes they received and whether the truck is being tracked. Cancel abandoned or fraudulent jobs." />
      <FilterBar action="/admin/jobs">
        <Field label="Search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Title or business" className="input w-56 py-1.5 text-sm" /></Field>
        <Field label="Status"><Select name="status" value={sp.status} options={[["OPEN", "Taking quotes"], ["AWARDED", "Awarded"], ["DELIVERED", "Delivered"], ["CANCELLED", "Cancelled"]]} /></Field>
        <Field label="Stale"><Select name="stale" value={sp.stale} options={[["yes", "Awarded over 2 weeks, not confirmed"]]} all="Any" /></Field>
      </FilterBar>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Job</th><th>Poster</th><th>Status</th><th>Quotes</th><th>Tracking</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((j) => {
              const accepted = j.quotes.find((q) => q.status === "ACCEPTED");
              return (
                <tr key={j.id}>
                  <td><Link href={`/hub/jobs/${j.id}`} className="font-medium">{j.title}</Link><p className="text-xs text-ink-600">{j.fromState} → {j.toState} · pickup {fmtDate(j.pickupDate)}</p></td>
                  <td className="text-sm">{j.poster.name}</td>
                  <td><Badge tone={tone[j.status]}>{j.status.toLowerCase()}</Badge></td>
                  <td className="text-xs">{j.quotes.length} quote{j.quotes.length === 1 ? "" : "s"}{accepted ? ` · ${accepted.carrier.name} at ${naira(accepted.priceNaira)}` : ""}</td>
                  <td className="text-xs">{j.trip ? `${j.trip.status.toLowerCase()}${j.trip.lastAt ? `, last ${fmtDateTime(j.trip.lastAt)}` : ""}` : "–"}</td>
                  <td>{(j.status === "OPEN" || j.status === "AWARDED") ? <ReasonAction action={cancelJobAction} id={j.id} label="Cancel job" placeholder="Why, e.g. poster unreachable" /> : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/jobs" params={{ ...sp, page: undefined }} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
