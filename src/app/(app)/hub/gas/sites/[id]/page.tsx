import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { getSite } from "@/server/hub/gas";
import { businessListings } from "@/server/hub/listings";
import { db } from "@/lib/db";
import { confirmSiteAction } from "@/app/actions/hub";
import { gasLabel, isStale, siteKindLabel } from "@/lib/hub/gas";
import { fmtDate } from "@/lib/format";
import { EnquiryForm, ReportForm } from "@/components/hub/forms";
import { DemoTag, ListingCard, RolePills, SafetyNote, VerificationBadge } from "@/components/hub/parts";
import { Notice, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Gas site" };

export default async function GasSitePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { saved } = await searchParams;
  const s = await getSite(user, id);
  const b = s.business;
  const [listings, mine, existing] = await Promise.all([
    businessListings(b.id),
    getMyBusiness(user),
    db.hubThread.findFirst({ where: { starterId: user.id, businessId: b.id, listingId: null }, select: { id: true } }),
  ]);
  const gasListings = listings.filter((l) => l.products.some((p) => p === "lpg" || p === "cng"));
  const stale = isStale(s.lastConfirmedAt);
  return (
    <>
      <p className="mb-2 text-sm"><Link href={`/hub/gas?state=${encodeURIComponent(s.state)}#map`}>← Gas network: {s.state}</Link></p>
      <PageHeader eyebrow={siteKindLabel(s.kind)} title={s.name} subtitle={[s.address, s.town, s.state].filter(Boolean).join(", ")} actions={<div className="flex flex-wrap gap-1.5">{s.gases.map((g) => <Pill key={g} className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{gasLabel(g)}</Pill>)}</div>} />
      {saved && <div className="mb-4"><Notice tone="ok" title="Site saved">It shows on the gas network map{s.status === "CLOSED" ? " only to you, because it is marked closed" : ""}.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h-section">Details</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-600">Status</dt><dd className="font-medium">{s.status === "OPERATING" ? "Operating" : s.status === "PLANNED" ? "Planned or under construction" : "Closed"}</dd></div>
              {s.cylinderSizes.length > 0 && <div><dt className="text-ink-600">Cylinder sizes</dt><dd className="font-medium">{s.cylinderSizes.join(", ")} kg</dd></div>}
              {s.storageTonnes !== null && <div><dt className="text-ink-600">Storage</dt><dd className="font-medium">{s.storageTonnes.toLocaleString("en-GB")} tonnes</dd></div>}
              {s.hours && <div><dt className="text-ink-600">Opening hours</dt><dd>{s.hours}</dd></div>}
              <div><dt className="text-ink-600">Delivery</dt><dd>{s.delivers ? (s.kind === "LOGISTICS_BASE" ? "Takes delivery jobs" : "Delivers from this site") : "Collection only"}</dd></div>
              <div><dt className="text-ink-600">Last confirmed</dt><dd className={stale ? "font-medium text-amber-800" : ""}>{stale ? "⚠ " : ""}{fmtDate(s.lastConfirmedAt)}{stale ? " (may be out of date)" : ""}</dd></div>
            </dl>
            {s.notes && <p className="mt-4 whitespace-pre-line text-sm text-ink-800">{s.notes}</p>}
            <p className="mt-4 text-xs text-ink-600">As stated by {b.name}. RefineryLens has not inspected this site; check licences and safety certificates yourself.</p>
          </section>
          {gasListings.length > 0 && (
            <section aria-labelledby="gl-h">
              <h2 id="gl-h" className="h-section">{b.name}: live gas listings</h2>
              <ul className="mt-3 grid gap-4 md:grid-cols-2">{gasListings.map((l) => <ListingCard key={l.id} l={l} business={b} showBusiness={false} />)}</ul>
            </section>
          )}
        </div>
        <aside className="space-y-4">
          <section className="card">
            <p className="eyebrow">{s.own ? "Your business" : "Run by"}</p>
            <h2 className="mt-1 text-base font-semibold"><Link href={`/hub/businesses/${b.id}`}>{b.name}</Link></h2>
            <div className="mt-2 flex flex-wrap gap-1.5"><VerificationBadge v={b.verification} />{b.isDemo && <DemoTag />}<RolePills roles={b.roles} /></div>
          </section>
          {s.own ? (
            <section className="card space-y-3">
              <h2 className="h-section">Manage</h2>
              <Link href={`/hub/gas/sites/new?edit=${s.id}`} className="btn-secondary btn-sm no-underline">Edit site</Link>
              <form action={confirmSiteAction}><input type="hidden" name="id" value={s.id} /><button className="btn-primary btn-sm">Details are still correct</button></form>
              <p className="text-xs text-ink-600">Confirm at least every 90 days so buyers can trust the map.</p>
            </section>
          ) : (
            <section className="card space-y-3">
              <h2 className="h-section">Contact {b.name}</h2>
              {existing ? (
                <p className="text-sm">You already have a conversation with this business. <Link href={`/hub/inbox/${existing.id}`}>Open it</Link></p>
              ) : mine ? (
                <EnquiryForm businessId={b.id} placeholder={`Ask about ${s.name}: availability, price per kg, minimum order, delivery.`} />
              ) : (
                <p className="text-sm">Set up your <Link href="/hub/me">business profile</Link> first, so {b.name} knows who is asking.</p>
              )}
              <SafetyNote />
              <ReportForm businessId={b.id} />
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
