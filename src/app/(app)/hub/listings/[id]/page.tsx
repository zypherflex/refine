import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { getListing, matchesFor } from "@/server/hub/listings";
import { db } from "@/lib/db";
import { closeListingAction, renewListingAction } from "@/app/actions/hub";
import { kindLabel, productLabel, roleLabel } from "@/lib/hub/catalog";
import { fmtDate } from "@/lib/format";
import { EnquiryForm, ReportForm } from "@/components/hub/forms";
import { DemoTag, KindPill, ListingCard, placesText, quantityText, RolePills, SafetyNote, VerificationBadge } from "@/components/hub/parts";
import { Notice, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Listing" };

const enquiryPrompt = {
  OFFER: "Say how much you need, where it should go, and when. Ask for the product's specification and the loading point.",
  REQUEST: "Say what you can supply, from where, at what price, and how soon.",
  DELIVERY: "Say what needs moving, from where to where, how much and when.",
} as const;

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { saved } = await searchParams;
  const l = await getListing(user, id);
  const [matches, mine, existing] = await Promise.all([
    matchesFor(user, l),
    getMyBusiness(user),
    db.hubThread.findFirst({ where: { starterId: user.id, businessId: l.businessId, listingId: l.id }, select: { id: true } }),
  ]);
  const b = l.business;
  const qty = quantityText(l);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub">← Trade hub</Link></p>
      <PageHeader eyebrow={kindLabel(l.kind)} title={l.title} subtitle={placesText(l)} actions={<div className="flex flex-wrap gap-1.5"><KindPill kind={l.kind} />{l.products.map((p) => <Pill key={p} className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{productLabel(p)}</Pill>)}</div>} />
      {saved && <div className="mb-4"><Notice tone="ok" title="Listing published">It is live until {fmtDate(l.expiresAt)}. Matching listings from other businesses appear below.</Notice></div>}
      {l.own && !l.isLive && <div className="mb-4"><Notice tone="warn" title="Only you can see this listing">{l.status === "CLOSED" ? "You closed it." : l.expiresAt <= new Date() ? `It expired on ${fmtDate(l.expiresAt)}.` : "Your business is hidden until RefineryLens verifies it."} Renew it to put it back on the hub.</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h-section">Details</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {qty && <div><dt className="text-ink-600">{l.kind === "DELIVERY" ? "Capacity" : "Quantity"}</dt><dd className="font-medium">{qty}</dd></div>}
              {l.priceNote && <div><dt className="text-ink-600">{l.kind === "REQUEST" ? "Target price or terms" : "Price or rate"}</dt><dd className="font-medium">{l.priceNote}</dd></div>}
              <div><dt className="text-ink-600">Posted</dt><dd>{fmtDate(l.createdAt)}</dd></div>
              <div><dt className="text-ink-600">Live until</dt><dd>{fmtDate(l.expiresAt)}</dd></div>
            </dl>
            {l.details ? <p className="mt-4 whitespace-pre-line text-sm text-ink-800">{l.details}</p> : <p className="mt-4 text-sm text-ink-600">No further details given. Ask the business.</p>}
            <p className="mt-4 text-xs text-ink-600">Quantities, prices and specifications are as stated by the business. RefineryLens has not checked them.</p>
          </section>

          <section aria-labelledby="matches-h">
            <h2 id="matches-h" className="h-section">{l.own ? "Businesses that match your listing" : "Related listings"}</h2>
            <p className="muted">Live {l.kind === "OFFER" ? "buy requests and delivery capacity" : l.kind === "REQUEST" ? "offers and delivery capacity" : "offers and buy requests"} for the same products in overlapping places. Verified businesses first.</p>
            {matches.length === 0 ? (
              <p className="mt-3 text-sm text-ink-600">None yet. New listings appear here as they are posted.</p>
            ) : (
              <ul className="mt-3 grid gap-4 md:grid-cols-2">{matches.map((m) => <ListingCard key={m.id} l={m} business={m.business} />)}</ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card">
            <p className="eyebrow">{l.own ? "Your business" : "Posted by"}</p>
            <h2 className="mt-1 text-base font-semibold"><Link href={`/hub/businesses/${b.id}`}>{b.name}</Link></h2>
            <p className="mt-1 text-sm text-ink-700">{[b.city, b.state].filter(Boolean).join(", ")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5"><VerificationBadge v={b.verification} />{b.isDemo && <DemoTag />}<RolePills roles={b.roles} /></div>
            {b.roles.includes("REFINERY") && b.capacityBpd && <p className="mt-2 text-xs text-ink-700">{roleLabel("REFINERY")} · stated capacity {b.capacityBpd.toLocaleString("en-GB")} bpd</p>}
          </section>

          {l.own ? (
            <section className="card space-y-3">
              <h2 className="h-section">Manage</h2>
              <Link href={`/hub/post?edit=${l.id}`} className="btn-secondary btn-sm no-underline">Edit and renew</Link>
              <div className="flex flex-wrap gap-2">
                {l.isLive ? (
                  <form action={closeListingAction}><input type="hidden" name="id" value={l.id} /><button className="btn-ghost btn-sm">Close listing</button></form>
                ) : (
                  <form action={renewListingAction}><input type="hidden" name="id" value={l.id} /><button className="btn-primary btn-sm">Renew for 30 days</button></form>
                )}
              </div>
              <p className="text-xs text-ink-600">Messages about this listing arrive in your <Link href="/hub/inbox">inbox</Link>.</p>
            </section>
          ) : (
            <section className="card space-y-3">
              <h2 className="h-section">Contact {b.name}</h2>
              {existing ? (
                <p className="text-sm">You already have a conversation about this listing. <Link href={`/hub/inbox/${existing.id}`}>Open it</Link></p>
              ) : mine ? (
                <EnquiryForm businessId={b.id} listingId={l.id} placeholder={enquiryPrompt[l.kind]} />
              ) : (
                <p className="text-sm">Set up your <Link href="/hub/me">business profile</Link> first, so {b.name} knows who is asking.</p>
              )}
              {b.verification !== "VERIFIED" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">RefineryLens has not verified this business. Do not pay in advance until you have checked its registration and licences yourself.</p>}
              <SafetyNote />
              <ReportForm businessId={b.id} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
