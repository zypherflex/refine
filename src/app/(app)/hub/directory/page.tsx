import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listDirectory } from "@/server/hub/business";
import { isState, PRODUCTS, productLabel, ROLES, roleLabel, stateName } from "@/lib/hub/catalog";
import { EmptyState, PageHeader } from "@/components/ui";
import { AdvanceWarning, BusinessName, ProductSelect, StateSelect } from "@/components/hub/bits";

export const metadata = { title: "Business directory" };

type Search = Promise<{ role?: string; state?: string; product?: string; q?: string; verified?: string }>;

export default async function DirectoryPage({ searchParams }: { searchParams: Search }) {
  await requireUser();
  const sp = await searchParams;
  const role = ROLES.some((r) => r.id === sp.role) ? sp.role! : "";
  const state = sp.state && isState(sp.state) ? sp.state : "";
  const product = PRODUCTS.some((p) => p.id === sp.product) ? sp.product! : "";
  const q = (sp.q ?? "").slice(0, 80);
  const verifiedOnly = sp.verified === "1";
  const rows = await listDirectory({ role, state, product, q, verifiedOnly });

  return (
    <>
      <PageHeader eyebrow="Trade hub" title="Business directory" subtitle="Every business states its own details. The Verified badge means a RefineryLens reviewer checked its CAC registration, licences and phone. Names of well-known companies stay hidden until verified, so nobody can borrow them." />
      <form method="get" role="search" aria-label="Filter businesses" className="mb-5 grid gap-3 rounded-xl border border-ink-100 bg-ink-50 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto] lg:items-end">
        <div>
          <label htmlFor="role" className="label">Role</label>
          <select id="role" name="role" className="input" defaultValue={role}><option value="">All roles</option>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
        </div>
        <StateSelect value={state} any="All states" />
        <ProductSelect value={product} any="All products" />
        <div>
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} maxLength={80} placeholder="Name or town" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="verified" value="1" defaultChecked={verifiedOnly} /> Verified only</label>
          <button className="btn-primary">Show</button>
        </div>
      </form>
      <p className="mb-3 text-sm text-ink-600" role="status">{rows.length} businesses{state ? ` in ${stateName(state)}` : ""}.</p>
      {rows.length === 0 ? (
        <EmptyState title="No businesses match" action={<Link href="/hub/directory" className="btn-secondary btn-sm no-underline">Clear filters</Link>}>Try another state or role.</EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((b) => (
            <li key={b.id} className="card">
              <p className="font-semibold"><BusinessName b={b} /></p>
              <p className="mt-1 text-xs text-ink-600">{b.roles.map(roleLabel).join(" · ")} · {b.town ? `${b.town}, ` : ""}{stateName(b.state)}</p>
              {b.products.length > 0 && <p className="mt-1 text-xs text-ink-700">{b.products.map(productLabel).join(", ")}</p>}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8"><AdvanceWarning /></div>
    </>
  );
}
