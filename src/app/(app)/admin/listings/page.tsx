import Link from "next/link";
import { requireRole } from "@/server/auth";
import { listListings } from "@/server/admin/hub";
import { PAGE_SIZE, pageOf } from "@/server/admin/guard";
import { closeListingAction } from "@/app/actions/admin-tools";
import { kindLabel, NIGERIAN_STATES, productLabel } from "@/lib/hub/catalog";
import { fmtDate } from "@/lib/format";
import { ReasonAction } from "@/components/admin/forms";
import { Badge, Field, FilterBar, Pager, Select } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Listings · Administration" };
export const dynamic = "force-dynamic";

type SP = { q?: string; kind?: string; status?: string; state?: string; page?: string };

export default async function AdminListings({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { total, rows } = await listListings(admin, { ...sp, page });
  const now = new Date();
  return (
    <>
      <PageHeader eyebrow="Trade hub" title="Listings" subtitle="Offers, buy requests and delivery capacity. Take down a listing that breaks the rules; the business is told why." />
      <FilterBar action="/admin/listings">
        <Field label="Search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Title or business" className="input w-56 py-1.5 text-sm" /></Field>
        <Field label="Kind"><Select name="kind" value={sp.kind} options={[["OFFER", "Selling"], ["REQUEST", "Buying"], ["DELIVERY", "Delivery capacity"]]} /></Field>
        <Field label="Status"><Select name="status" value={sp.status} options={[["LIVE", "Live"], ["EXPIRED", "Expired"], ["CLOSED", "Closed"]]} /></Field>
        <Field label="State"><Select name="state" value={sp.state} options={NIGERIAN_STATES} /></Field>
      </FilterBar>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Listing</th><th>Business</th><th>Kind</th><th>State</th><th>Status</th><th className="text-right">Enquiries</th><th>Action</th></tr></thead>
          <tbody>
            {rows.map((l) => {
              const live = l.status === "ACTIVE" && l.expiresAt > now;
              return (
                <tr key={l.id}>
                  <td><Link href={`/hub/listings/${l.id}`} className="font-medium">{l.title}</Link><p className="text-xs text-ink-600">{l.products.map(productLabel).join(", ")} · posted {fmtDate(l.createdAt)}</p></td>
                  <td className="text-sm">{l.business.name}</td>
                  <td>{kindLabel(l.kind)}</td>
                  <td>{l.state}</td>
                  <td>{live ? <Badge tone="good">live to {fmtDate(l.expiresAt)}</Badge> : l.status === "CLOSED" ? <Badge>closed</Badge> : <Badge tone="warn">expired</Badge>}</td>
                  <td className="num text-right">{l._count.threads}</td>
                  <td>{l.status === "ACTIVE" ? <ReasonAction action={closeListingAction} id={l.id} label="Take down" placeholder="Why, e.g. misleading price" /> : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/listings" params={{ ...sp, page: undefined }} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
