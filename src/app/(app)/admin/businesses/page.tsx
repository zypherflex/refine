import Link from "next/link";
import { requireRole } from "@/server/auth";
import { listBusinesses } from "@/server/admin/hub";
import { PAGE_SIZE, pageOf } from "@/server/admin/guard";
import { grantBusinessPlanAction, reinstateBusinessAction } from "@/app/actions/hub";
import { NIGERIAN_STATES, roleLabel } from "@/lib/hub/catalog";
import { fmtDate } from "@/lib/format";
import { SuspendForm } from "@/components/hub/forms";
import { Badge, Field, FilterBar, Pager, Select } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Businesses · Administration" };
export const dynamic = "force-dynamic";

type SP = { q?: string; verification?: string; role?: string; state?: string; delivery?: string; plan?: string; page?: string };
const vTone = { VERIFIED: "good", SUSPENDED: "bad", PENDING_REVIEW: "warn", UNVERIFIED: "plain" } as const;

export default async function AdminBusinesses({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { total, rows } = await listBusinesses(admin, { ...sp, page });
  const now = new Date();
  return (
    <>
      <PageHeader eyebrow="Trade hub" title="Businesses" subtitle="Every business on the hub. Suspend or reinstate, grant the Business plan, and find who delivers gas to homes." actions={<Link href="/admin/hub" className="btn-secondary btn-sm no-underline">Verification queue</Link>} />
      <FilterBar action="/admin/businesses">
        <Field label="Search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Name, CAC number or owner email" className="input w-60 py-1.5 text-sm" /></Field>
        <Field label="Status"><Select name="verification" value={sp.verification} options={[["VERIFIED", "Verified"], ["PENDING_REVIEW", "Waiting for review"], ["UNVERIFIED", "Not verified"], ["SUSPENDED", "Suspended"]]} /></Field>
        <Field label="Role"><Select name="role" value={sp.role} options={[["SELLER", "Seller"], ["BUYER", "Buyer"], ["DELIVERY", "Delivery partner"], ["REFINERY", "Refinery"]]} /></Field>
        <Field label="State"><Select name="state" value={sp.state} options={NIGERIAN_STATES} /></Field>
        <Field label="Home delivery"><Select name="delivery" value={sp.delivery} options={[["yes", "Delivers to homes"]]} all="Any" /></Field>
        <Field label="Business plan"><Select name="plan" value={sp.plan} options={[["active", "On the plan"], ["expiring", "Ends within 14 days"]]} all="Any" /></Field>
      </FilterBar>
      <ul className="space-y-3">
        {rows.map((b) => (
          <li key={b.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="flex flex-wrap items-center gap-1.5"><Link href={`/hub/businesses/${b.id}`} className="font-semibold">{b.name}</Link><Badge tone={vTone[b.verification]}>{b.verification.toLowerCase().replace("_", " ")}</Badge>{b.isDemo && <Badge>demo</Badge>}{b.homeDelivery && <Badge tone="navy">home delivery</Badge>}{b.planUntil && b.planUntil > now && <Badge tone="good">plan to {fmtDate(b.planUntil)}</Badge>}</p>
                <p className="mt-0.5 text-xs text-ink-600">{b.roles.map(roleLabel).join(", ")} · {[b.city, b.state].filter(Boolean).join(", ")} · owner <Link href={`/admin/users/${b.owner.id}`}>{b.owner.name}</Link> ({b.owner.email}) · since {fmtDate(b.createdAt)}</p>
                <p className="mt-0.5 text-xs text-ink-600">{b._count.listings} listings · {b._count.gasOrders} gas orders · {b._count.priceReports} price reports · {b._count.reports} reports against it{b.registrationNumber ? ` · CAC ${b.registrationNumber}` : ""}</p>
                {b.verificationNote && <p className="mt-1 text-xs text-amber-800">Note: {b.verificationNote}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {b.verification === "VERIFIED" && <form action={grantBusinessPlanAction}><input type="hidden" name="businessId" value={b.id} /><button className="btn-secondary btn-sm">Grant 30 days of plan</button></form>}
                {b.verification === "SUSPENDED" && <form action={reinstateBusinessAction}><input type="hidden" name="businessId" value={b.id} /><button className="btn-secondary btn-sm">Reinstate</button></form>}
              </div>
            </div>
            {b.verification !== "SUSPENDED" && <details className="mt-2 text-xs"><summary className="cursor-pointer font-medium text-risk-700">Suspend…</summary><div className="mt-2"><SuspendForm businessId={b.id} name={b.name} /></div></details>}
          </li>
        ))}
      </ul>
      <Pager base="/admin/businesses" params={{ ...sp, page: undefined }} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
