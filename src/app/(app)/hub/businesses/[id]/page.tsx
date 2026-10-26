import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getBusiness, getMyBusiness } from "@/server/hub/business";
import { businessListings } from "@/server/hub/listings";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { EnquiryForm, ReportForm } from "@/components/hub/forms";
import { DemoTag, ListingCard, RolePills, SafetyNote, VerificationBadge } from "@/components/hub/parts";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Business" };

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const b = await getBusiness(user, id);
  const own = b.ownerId === user.id;
  const [listings, mine, existing] = await Promise.all([
    businessListings(b.id),
    getMyBusiness(user),
    db.hubThread.findFirst({ where: { starterId: user.id, businessId: b.id, listingId: null }, select: { id: true } }),
  ]);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub">← Trade hub</Link></p>
      <PageHeader
        eyebrow={b.roles.includes("REFINERY") ? "Refinery" : "Business"}
        title={b.name}
        subtitle={[b.city, b.state].filter(Boolean).join(", ")}
        actions={<div className="flex flex-wrap gap-1.5"><VerificationBadge v={b.verification} />{b.isDemo && <DemoTag />}<RolePills roles={b.roles} /></div>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h-section">About</h2>
            {b.about ? <p className="mt-2 whitespace-pre-line text-sm text-ink-800">{b.about}</p> : <p className="mt-2 text-sm text-ink-600">No description yet.</p>}
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {b.capacityBpd && <div><dt className="text-ink-600">Stated refining capacity</dt><dd className="font-medium">{b.capacityBpd.toLocaleString("en-GB")} barrels per day <span className="font-normal text-ink-600">(as stated by the business)</span></dd></div>}
              {b.licences && <div><dt className="text-ink-600">Licences it says it holds</dt><dd>{b.licences}</dd></div>}
              {b.website && <div><dt className="text-ink-600">Website</dt><dd><a href={b.website} target="_blank" rel="noopener noreferrer nofollow">{b.website.replace(/^https?:\/\//, "")} ↗</a></dd></div>}
              <div><dt className="text-ink-600">On RefineryLens since</dt><dd>{fmtDate(b.createdAt)}</dd></div>
              {b.verification === "VERIFIED" && b.verifiedAt && <div><dt className="text-ink-600">Verified</dt><dd>{fmtDate(b.verifiedAt)}: registration and licence details checked</dd></div>}
            </dl>
          </section>
          <section aria-labelledby="bl-h">
            <h2 id="bl-h" className="h-section">Live listings ({listings.length})</h2>
            {listings.length === 0 ? (
              <EmptyState title="No live listings">{own ? <Link href="/hub/post">Post a listing</Link> : "Send a message to ask what is available."}</EmptyState>
            ) : (
              <ul className="mt-3 grid gap-4 md:grid-cols-2">{listings.map((l) => <ListingCard key={l.id} l={l} business={b} showBusiness={false} />)}</ul>
            )}
          </section>
        </div>
        <aside className="space-y-4">
          {own ? (
            <section className="card text-sm">This is your business. <Link href="/hub/me">Edit your profile</Link>.</section>
          ) : (
            <section className="card space-y-3">
              <h2 className="h-section">Message {b.name}</h2>
              {existing ? (
                <p className="text-sm">You already have a conversation with this business. <Link href={`/hub/inbox/${existing.id}`}>Open it</Link></p>
              ) : mine ? (
                <EnquiryForm businessId={b.id} placeholder="Introduce your business and say what you are looking for." />
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
