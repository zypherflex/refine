import Link from "next/link";
import type { HubListingKind } from "@prisma/client";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { browseListings } from "@/server/hub/listings";
import { HUB_ROLES, LISTING_KINDS, LOCATIONS, NIGERIAN_STATES, OTHER_LOCATIONS, PRODUCTS, kindLabel, productLabel } from "@/lib/hub/catalog";
import { ListingCard, SafetyNote } from "@/components/hub/parts";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Trade hub" };

type Search = Promise<{ kind?: string; product?: string; state?: string; verified?: string; q?: string }>;

export default async function HubPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser();
  const sp = await searchParams;
  const kind = LISTING_KINDS.some((k) => k.id === sp.kind) ? (sp.kind as HubListingKind) : null;
  const product = PRODUCTS.some((p) => p.id === sp.product) ? sp.product! : "";
  const state = LOCATIONS.includes(sp.state ?? "") ? sp.state! : "";
  const verifiedOnly = sp.verified === "1";
  const q = (sp.q ?? "").slice(0, 80);
  const [listings, mine] = await Promise.all([browseListings(user, { kind, product, state, verifiedOnly, q }), getMyBusiness(user)]);
  const qs = (k: string | null) => {
    const p = new URLSearchParams({ ...(k ? { kind: k } : {}), ...(product ? { product } : {}), ...(state ? { state } : {}), ...(verifiedOnly ? { verified: "1" } : {}), ...(q ? { q } : {}) });
    const s = p.toString();
    return s ? `/hub?${s}` : "/hub";
  };

  return (
    <>
      <PageHeader
        eyebrow="Trade hub"
        title="Sellers, buyers, delivery partners and refineries"
        subtitle="Find product, find buyers, book trucks and vessels, and reach refineries. Every business shows whether RefineryLens has checked its registration and licences. Deals are agreed directly between the businesses."
        actions={
          mine ? (
            <><Link href="/hub/inbox" className="btn-secondary btn-sm no-underline">Inbox</Link><Link href="/hub/me" className="btn-secondary btn-sm no-underline">My business</Link><Link href="/hub/post" className="btn-primary btn-sm no-underline">Post a listing</Link></>
          ) : (
            <Link href="/hub/me" className="btn-primary btn-sm no-underline">Set up your business</Link>
          )
        }
      />
      {!mine && (
        <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {HUB_ROLES.map((r) => (
            <Link key={r.id} href="/hub/me" className="card-link block rounded-xl border border-ink-100 bg-white p-3 no-underline hover:no-underline">
              <p className="font-semibold text-ink-950">{r.label}</p>
              <p className="mt-1 text-xs text-ink-600">{r.who}</p>
            </Link>
          ))}
        </div>
      )}

      <nav aria-label="Listing type" className="mb-4 flex flex-wrap gap-2">
        {[null, ...LISTING_KINDS.map((k) => k.id)].map((k) => (
          <Link key={k ?? "all"} href={qs(k)} aria-current={kind === k ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-sm font-medium no-underline hover:no-underline ${kind === k ? "bg-ink-950 text-white" : "bg-white text-ink-800 ring-1 ring-inset ring-ink-100 hover:bg-ink-50"}`}>
            {k ? kindLabel(k) : "All listings"}
          </Link>
        ))}
        <Link href="/hub/refineries" className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink-800 no-underline ring-1 ring-inset ring-ink-100 hover:bg-ink-50 hover:no-underline">Refineries</Link>
      </nav>

      <form method="get" className="mb-5 grid gap-3 rounded-xl border border-ink-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_auto_auto] lg:items-end" role="search" aria-label="Filter listings">
        {kind && <input type="hidden" name="kind" value={kind} />}
        <div>
          <label htmlFor="product" className="label">Product</label>
          <select id="product" name="product" className="input" defaultValue={product}>
            <option value="">All products</option>
            {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="state" className="label">Location</label>
          <select id="state" name="state" className="input" defaultValue={state}>
            <option value="">Anywhere</option>
            <optgroup label="Nigeria">{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</optgroup>
            <optgroup label="Outside Nigeria">{OTHER_LOCATIONS.map((s) => <option key={s}>{s}</option>)}</optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} maxLength={80} placeholder="e.g. tanker, Kano, resin" />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="verified" value="1" defaultChecked={verifiedOnly} /> Verified only</label>
        <button className="btn-primary">Show</button>
      </form>

      <section aria-labelledby="results-h">
        <h2 id="results-h" className="sr-only">Listings</h2>
        <p className="mb-3 text-sm text-ink-600" role="status">
          {listings.length} live listing{listings.length === 1 ? "" : "s"}
          {kind ? ` · ${kindLabel(kind).toLowerCase()}` : ""}
          {product ? ` · ${productLabel(product)}` : ""}
          {state ? ` · ${state}` : ""}
          {verifiedOnly ? " · verified businesses only" : ""}
        </p>
        {listings.length === 0 ? (
          <EmptyState title="No live listings match" action={<Link href="/hub" className="btn-secondary btn-sm no-underline">Clear filters</Link>}>
            Try another product or location{mine ? ", or post what you are looking for so sellers can find you." : "."}
          </EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {listings.map((l) => <ListingCard key={l.id} l={l} business={l.business} />)}
          </ul>
        )}
      </section>

      <div className="mt-8">
        <Notice title="How the hub works">
          <SafetyNote />
        </Notice>
      </div>
    </>
  );
}
