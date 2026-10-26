import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listListings } from "@/server/hub/market";
import { isState, PRODUCTS, productLabel, stateName } from "@/lib/hub/catalog";
import { EmptyState, PageHeader, Pill } from "@/components/ui";
import { AdvanceWarning, BusinessName, ProductSelect, PromotedTag, StateSelect, day, qty } from "@/components/hub/bits";

export const metadata = { title: "Offers and requests" };

type Search = Promise<{ kind?: string; state?: string; product?: string }>;

export default async function ListingsPage({ searchParams }: { searchParams: Search }) {
  await requireUser();
  const sp = await searchParams;
  const kind = sp.kind === "OFFER" || sp.kind === "REQUEST" ? sp.kind : "";
  const state = sp.state && isState(sp.state) ? sp.state : "";
  const product = PRODUCTS.some((p) => p.id === sp.product) ? sp.product! : "";
  const rows = await listListings({ kind, state, product });
  return (
    <>
      <PageHeader eyebrow="Trade hub" title="Offers and requests" subtitle="Product on offer and product wanted, posted by the businesses themselves. Listings expire after 30 days so the board stays current. Promoted listings are paid placements and are always labelled." actions={<Link href="/hub/my#listings" className="btn-primary btn-sm no-underline">Post a listing</Link>} />
      <form method="get" role="search" aria-label="Filter listings" className="mb-5 grid gap-3 rounded-xl border border-ink-100 bg-ink-50 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="kind" className="label">Type</label>
          <select id="kind" name="kind" className="input" defaultValue={kind}><option value="">Offers and requests</option><option value="OFFER">Offers</option><option value="REQUEST">Requests</option></select>
        </div>
        <StateSelect value={state} any="All states" />
        <ProductSelect value={product} any="All products" />
        <button className="btn-primary">Show</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No live listings match" action={<Link href="/hub/listings" className="btn-secondary btn-sm no-underline">Clear filters</Link>} />
      ) : (
        <ul className="space-y-3">
          {rows.map((l) => (
            <li key={l.id} className="card">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill className={l.kind === "OFFER" ? "bg-ink-950 text-white" : "bg-ink-100 text-ink-900"}>{l.kind === "OFFER" ? "Offer" : "Request"}</Pill>
                {l.promoted && <PromotedTag />}
                <h2 className="text-base font-semibold">{productLabel(l.product)} · <span className="num">{qty(l.quantity)}</span> {l.unit} · {stateName(l.state)}</h2>
              </div>
              {l.details && <p className="mt-2 text-sm text-ink-700">{l.details}</p>}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-600">
                <BusinessName b={l.business} />
                <span>Posted {day(l.createdAt)} · <Link href={`/hub/business/${l.businessId}?listing=${l.id}#contact`}>Message</Link></span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-8"><AdvanceWarning /></div>
    </>
  );
}
