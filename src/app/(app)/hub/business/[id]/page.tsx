import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { deliveryRecord, getBusiness, myBusiness, REPORT_REASONS } from "@/server/hub/business";
import { businessListings } from "@/server/hub/market";
import { NotFoundError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { productLabel, roleLabel, stateName } from "@/lib/hub/catalog";
import { displayName } from "@/lib/hub/rules";
import { db } from "@/lib/db";
import { reportBusinessAction, sendEnquiryAction } from "@/app/actions/hub";
import { Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { AdvanceWarning, BusinessName, PromotedTag, day, qty } from "@/components/hub/bits";

export const metadata = { title: "Business" };

export default async function BusinessPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ listing?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const b = await getBusiness(user, id).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const [listings, record, sites, me] = await Promise.all([businessListings(b.id), deliveryRecord(b.id), db.gasSite.findMany({ where: { businessId: b.id }, orderBy: { state: "asc" } }), myBusiness(user)]);
  const own = me?.id === b.id;
  const verified = b.verification === "VERIFIED";

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/directory">← Directory</Link></p>
      <PageHeader eyebrow={b.roles.map(roleLabel).join(" · ")} title={displayName(b)} subtitle={<BusinessName b={b} link={false} />} actions={!own && me ? <Link href={`/hub/supply?with=${b.id}#propose`} className="btn-secondary btn-sm no-underline">Propose recurring supply</Link> : undefined} />

      {!verified && <div className="mb-6"><Notice tone="warn" title="Not verified by RefineryLens">Everything on this page is stated by the business itself and has not been checked. Do not pay in advance. {displayName(b) !== b.name && "Its name is hidden because it matches a well-known company."}</Notice></div>}
      {b.verification === "SUSPENDED" && <div className="mb-6"><Notice tone="risk" title="Suspended">This business is hidden from the hub. {can.reviewHub(user) && b.verificationNote}</Notice></div>}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <section className="card">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-600">Location</dt><dd>{b.town ? `${b.town}, ` : ""}{stateName(b.state)}</dd></div>
              <div><dt className="text-xs text-ink-600">Products</dt><dd>{b.products.map(productLabel).join(", ") || "Not stated"}</dd></div>
              <div><dt className="text-xs text-ink-600">CAC number (stated)</dt><dd className="num">{b.cacNumber || "Not stated"}</dd></div>
              <div><dt className="text-xs text-ink-600">Licences (stated)</dt><dd>{b.licenceNumbers || "Not stated"}</dd></div>
              {verified && <div className="sm:col-span-2"><dt className="text-xs text-ink-600">Verified</dt><dd>Documents and phone checked by a RefineryLens reviewer on {day(b.verifiedAt!)}.</dd></div>}
            </dl>
            {b.description && <p className="mt-4 border-t border-ink-100 pt-3 text-sm text-ink-800">{b.description}</p>}
          </section>

          <section aria-labelledby="record-h">
            <SectionHeader id="record-h" title="Delivery record" note="Counts only trades both sides confirmed" />
            <dl className="grid grid-cols-3 gap-3">
              {[["Delivery jobs", record.jobs], ["Supply deliveries", record.supply], ["Awaiting confirmation", record.pending]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-ink-100 bg-ink-50 p-3"><dt className="text-xs text-ink-600">{k}</dt><dd className="num mt-1 text-xl font-semibold">{v}</dd></div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="bl-h">
            <SectionHeader id="bl-h" title="Live offers and requests" />
            {listings.length ? (
              <ul className="space-y-2">{listings.map((l) => <li key={l.id} className="rounded-xl border border-ink-100 p-3 text-sm">{l.promoted && <><PromotedTag />{" "}</>}{l.kind === "OFFER" ? "Offer" : "Request"} · {productLabel(l.product)} · <span className="num">{qty(l.quantity)}</span> {l.unit} · {stateName(l.state)}{l.details ? <span className="block text-xs text-ink-600">{l.details}</span> : null}</li>)}</ul>
            ) : <p className="muted">None right now.</p>}
          </section>

          {sites.length > 0 && (
            <section aria-labelledby="bs-h">
              <SectionHeader id="bs-h" title="Gas sites" />
              <ul className="space-y-1 text-sm">{sites.map((s) => <li key={s.id}>{s.name} · {s.gas} {s.kind.toLowerCase()} · {stateName(s.state)} <span className="text-xs text-ink-600">(confirmed {day(s.lastConfirmedAt)})</span></li>)}</ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {!own && (
            <section id="contact" aria-labelledby="contact-h" className="card">
              <h2 id="contact-h" className="h-section mb-2">Contact</h2>
              {b.phone && <p className="mb-3 text-sm">Phone: <a href={`tel:${b.phone.replace(/[^0-9+]/g, "")}`} className="num">{b.phone}</a></p>}
              {me ? (
                <HubForm action={sendEnquiryAction} submit="Send message">
                  <input type="hidden" name="toId" value={b.id} />
                  {sp.listing && listings.some((l) => l.id === sp.listing) && <input type="hidden" name="listingId" value={sp.listing} />}
                  <div><label htmlFor="message" className="label">Message</label><textarea id="message" name="message" className="input min-h-24" required maxLength={2000} placeholder="Product, quantity, where and when" /></div>
                </HubForm>
              ) : <p className="text-sm text-ink-700"><Link href="/hub/my">Add your business</Link> to send messages.</p>}
            </section>
          )}
          <AdvanceWarning />
          {!own && (
            <details className="card">
              <summary className="text-sm font-medium">Report this business</summary>
              <HubForm action={reportBusinessAction} submit="Send report" className="mt-3 space-y-3" buttonClass="btn-secondary btn-sm">
                <input type="hidden" name="businessId" value={b.id} />
                <div><label htmlFor="reason" className="label">What happened</label><select id="reason" name="reason" className="input">{REPORT_REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
                <div><label htmlFor="details" className="label">Details</label><textarea id="details" name="details" className="input min-h-20" maxLength={2000} /></div>
              </HubForm>
            </details>
          )}
          {own && <Pill className="bg-ink-100 text-ink-800">This is your business. <Link href="/hub/my" className="ml-1">Edit</Link></Pill>}
        </aside>
      </div>
    </>
  );
}
