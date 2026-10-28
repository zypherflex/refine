import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { myListings } from "@/server/hub/listings";
import { closeListingAction, renewListingAction } from "@/app/actions/hub";
import { isProtectedName, isPubliclyVisible, kindLabel } from "@/lib/hub/catalog";
import { fmtDate } from "@/lib/format";
import { BusinessForm, RequestVerificationForm } from "@/components/hub/forms";
import { DemoTag, VerificationBadge } from "@/components/hub/parts";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "My business" };

export default async function MyBusinessPage() {
  const user = await requireUser();
  const business = await getMyBusiness(user);
  const listings = business ? await myListings(user) : [];
  const now = new Date();
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub">← Trade hub</Link></p>
      <PageHeader
        eyebrow="Trade hub"
        title={business ? business.name : "Set up your business"}
        subtitle={business ? "Your public trading profile, verification and listings." : "One profile lets you post offers, buy requests or delivery capacity, and message other businesses. You can post straight away; a Verified badge follows once RefineryLens has checked your registration and licences."}
        actions={business ? <><Link href={`/hub/businesses/${business.id}`} className="btn-secondary btn-sm no-underline">View public profile</Link><Link href="/hub/post" className="btn-primary btn-sm no-underline">Post a listing</Link></> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2" aria-labelledby="profile-h">
          <h2 id="profile-h" className="h-section">Business profile</h2>
          <div className="mt-3"><BusinessForm business={business} /></div>
        </section>
        <aside className="space-y-4">
          {business && (
            <section className="card space-y-3" aria-labelledby="ver-h">
              <h2 id="ver-h" className="h-section">Verification</h2>
              <div className="flex flex-wrap gap-1.5"><VerificationBadge v={business.verification} />{business.isDemo && <DemoTag />}</div>
              {business.verification === "VERIFIED" && <p className="text-sm text-navy-700">Verified on {fmtDate(business.verifiedAt)}. Buyers and sellers see the badge on your profile and listings.</p>}
              {business.verification === "PENDING_REVIEW" && <p className="text-sm text-navy-700">An administrator will check your CAC registration and licences. You can keep posting meanwhile.</p>}
              {business.verification === "SUSPENDED" && <Notice tone="risk" title="Suspended">{business.verificationNote || "Your business is hidden from the hub."} Contact RefineryLens to resolve it.</Notice>}
              {business.verification === "UNVERIFIED" && (
                <>
                  <p className="text-sm text-navy-700">An administrator checks your CAC registration number and the licences you list against public registers. Add them to your profile, then request a check.</p>
                  <RequestVerificationForm />
                </>
              )}
              {business.verificationNote && business.verification !== "SUSPENDED" && <p className="rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-800"><span className="font-medium">Note from RefineryLens:</span> {business.verificationNote}</p>}
              {!isPubliclyVisible(business) && isProtectedName(business.name) && <Notice tone="warn" title="Hidden until verified">Your business name matches a well-known refiner, so your profile and listings stay hidden from other users until RefineryLens verifies you.</Notice>}
            </section>
          )}
          {business && (
            <section className="card" aria-labelledby="ml-h">
              <h2 id="ml-h" className="h-section">My listings ({listings.length})</h2>
              {listings.length === 0 ? (
                <p className="mt-2 text-sm text-navy-600">None yet. <Link href="/hub/post">Post your first listing</Link>.</p>
              ) : (
                <ul className="mt-2 divide-y divide-navy-100 text-sm">
                  {listings.map((l) => {
                    const live = l.status === "ACTIVE" && l.expiresAt > now;
                    return (
                      <li key={l.id} className="py-2">
                        <p className="font-medium"><Link href={`/hub/listings/${l.id}`}>{l.title}</Link></p>
                        <p className="text-xs text-navy-600">{kindLabel(l.kind)} · {live ? `live until ${fmtDate(l.expiresAt)}` : l.status === "CLOSED" ? "closed" : `expired ${fmtDate(l.expiresAt)}`} · {l._count.threads} conversation{l._count.threads === 1 ? "" : "s"}</p>
                        <form action={live ? closeListingAction : renewListingAction} className="mt-1"><input type="hidden" name="id" value={l.id} /><button className="text-xs text-navy-700 hover:text-navy-950">{live ? "Close" : "Renew for 30 days"}</button></form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
