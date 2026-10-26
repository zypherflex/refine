import Link from "next/link";
import { requireUser } from "@/server/auth";
import { deliveryRecord, myBusiness } from "@/server/hub/business";
import { businessListings, inbox } from "@/server/hub/market";
import { mySites } from "@/server/hub/gas";
import { GASES, PRODUCTS, productLabel, ROLES, SITE_KINDS, stateName } from "@/lib/hub/catalog";
import { displayName, isProtectedName, SITE_STALE_DAYS, daysAgo } from "@/lib/hub/rules";
import { addSiteAction, closeListingAction, confirmSiteAction, createListingAction, removeSiteAction, requestVerificationAction, saveBusinessAction } from "@/app/actions/hub";
import { Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { BusinessName, ProductSelect, StateSelect, UnitSelect, VerificationBadge, day, qty } from "@/components/hub/bits";

export const metadata = { title: "My business" };

export default async function MyBusinessPage() {
  const user = await requireUser();
  const b = await myBusiness(user);
  const [listings, sites, messages, record] = b ? await Promise.all([businessListings(b.id, true), mySites(user), inbox(user), deliveryRecord(b.id)]) : [[], [], [], null];
  const now = new Date();

  return (
    <>
      <PageHeader eyebrow="Trade hub" title={b ? displayName(b) : "Add your business"} subtitle={b ? <BusinessName b={b} link={false} /> : "Free to list and free to talk. Tell buyers, sellers and hauliers who you are; ask for verification when you are ready."} actions={b ? <Link href={`/hub/business/${b.id}`} className="btn-secondary btn-sm no-underline">View public page</Link> : undefined} />

      {b && (
        <section aria-labelledby="verify-h" className="mb-8 card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="verify-h" className="h-section flex items-center gap-2">Verification <VerificationBadge v={b.verification} /></h2>
            {record && <p className="text-xs text-ink-600"><span className="num font-semibold text-ink-950">{record.total}</span> deliveries confirmed by both sides</p>}
          </div>
          {b.verification === "VERIFIED" && <p className="mt-2 text-sm text-ink-700">Verified on {day(b.verifiedAt!)}. Changing your name, CAC or licence numbers removes the badge until a reviewer checks them again.</p>}
          {b.verification === "PENDING" && <p className="mt-2 text-sm text-ink-700">Requested on {day(b.verificationAskedAt!)}. A reviewer will call {b.phone} and ask to see your CAC certificate and licences.</p>}
          {b.verification === "SUSPENDED" && <div className="mt-2"><Notice tone="risk" title="Suspended">{b.verificationNote || "Your business is hidden from the hub."} Contact support to appeal.</Notice></div>}
          {b.verification === "UNVERIFIED" && (
            <div className="mt-2 space-y-3">
              {b.verificationNote && <Notice tone="warn" title="Reviewer note">{b.verificationNote}</Notice>}
              {isProtectedName(b.name) && <Notice tone="warn" title="Your name is hidden until verified">Your business name includes the name of a well-known company, so others see “Name hidden until verified” until a reviewer confirms it.</Notice>}
              <p className="text-sm text-ink-700">Verified businesses are listed first and show the badge everywhere. A reviewer checks your CAC registration, licences and phone. Add your CAC number and phone below, then ask.</p>
              <HubForm action={requestVerificationAction} submit="Ask for verification" />
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="profile-h" className="mb-10">
        <SectionHeader id="profile-h" title={b ? "Business profile" : "Your business"} />
        <HubForm action={saveBusinessAction} submit={b ? "Save profile" : "Add my business"} className="card space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="name" className="label">Business name</label><input id="name" name="name" className="input" required maxLength={120} defaultValue={b?.name} /></div>
            <div><label htmlFor="phone" className="label">Phone or WhatsApp</label><input id="phone" name="phone" className="input" maxLength={40} defaultValue={b?.phone} placeholder="+234…" /></div>
            <StateSelect value={b?.state} />
            <div><label htmlFor="town" className="label">Town or area</label><input id="town" name="town" className="input" maxLength={80} defaultValue={b?.town} /></div>
          </div>
          <fieldset>
            <legend className="label">What you do</legend>
            <div className="grid gap-2 sm:grid-cols-2">{ROLES.map((r) => <label key={r.id} className="flex items-start gap-2 rounded-lg border border-ink-100 p-2 text-sm"><input type="checkbox" name="roles" value={r.id} defaultChecked={b?.roles.includes(r.id)} className="mt-1" /><span><span className="font-medium">{r.label}</span><span className="block text-xs text-ink-600">{r.who}</span></span></label>)}</div>
          </fieldset>
          <fieldset>
            <legend className="label">Products</legend>
            <div className="flex flex-wrap gap-2">{PRODUCTS.map((p) => <label key={p.id} className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1 text-sm"><input type="checkbox" name="products" value={p.id} defaultChecked={b?.products.includes(p.id)} />{p.label}</label>)}</div>
          </fieldset>
          <div><label htmlFor="description" className="label">About the business</label><textarea id="description" name="description" className="input min-h-20" maxLength={1000} defaultValue={b?.description} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="cacNumber" className="label">CAC registration number</label><input id="cacNumber" name="cacNumber" className="input" maxLength={30} defaultValue={b?.cacNumber} placeholder="RC or BN number" /><p className="hint">Needed for verification. Shown on your public page.</p></div>
            <div><label htmlFor="licenceNumbers" className="label">Licence numbers</label><input id="licenceNumbers" name="licenceNumbers" className="input" maxLength={300} defaultValue={b?.licenceNumbers} placeholder="NMDPRA, NCDMB, state permits" /><p className="hint">You remain responsible for keeping licences current.</p></div>
          </div>
        </HubForm>
      </section>

      {b && b.verification !== "SUSPENDED" && (
        <>
          <section id="listings" aria-labelledby="listings-h" className="mb-10">
            <SectionHeader id="listings-h" title="Offers and requests" />
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <HubForm action={createListingAction} submit="Post listing" className="card space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="kind" className="label">Type</label><select id="kind" name="kind" className="input" defaultValue={b.roles.includes("SELLER") ? "OFFER" : "REQUEST"}><option value="OFFER">I have product to offer</option><option value="REQUEST">I need product</option></select></div>
                  <ProductSelect value={b.products[0]} />
                  <div><label htmlFor="quantity" className="label">Quantity</label><input id="quantity" name="quantity" type="number" min="0" step="any" className="input num" required /></div>
                  <UnitSelect />
                </div>
                <StateSelect value={b.state} />
                <div><label htmlFor="details" className="label">Details</label><textarea id="details" name="details" className="input min-h-16" maxLength={1000} placeholder="Grade, loading point, delivery or pickup" /></div>
                <p className="text-xs text-ink-600">Do not post planned prices for others to follow. Agree prices directly with each customer.</p>
              </HubForm>
              <ul className="space-y-2">
                {listings.map((l) => {
                  const live = l.active && l.expiresAt > now;
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                      <span>{l.kind === "OFFER" ? "Offer" : "Request"} · {productLabel(l.product)} · <span className="num">{qty(l.quantity)}</span> {l.unit} · {stateName(l.state)}{!live && <span className="text-ink-500"> · closed</span>}</span>
                      {live && <HubForm action={closeListingAction} submit="Close" buttonClass="btn-ghost btn-sm" inline><input type="hidden" name="id" value={l.id} /></HubForm>}
                    </li>
                  );
                })}
                {!listings.length && <li className="muted">No listings yet.</li>}
              </ul>
            </div>
          </section>

          <section id="sites" aria-labelledby="sites-h" className="mb-10">
            <SectionHeader id="sites-h" title="Gas sites" note={`Reconfirm each site at least every ${SITE_STALE_DAYS} days`} />
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <HubForm action={addSiteAction} submit="Add site" className="card space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="site-kind" className="label">Site type</label><select id="site-kind" name="kind" className="input">{SITE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}: {k.help}</option>)}</select></div>
                  <div><label htmlFor="gas" className="label">Gas</label><select id="gas" name="gas" className="input">{GASES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
                  <div><label htmlFor="site-name" className="label">Site name</label><input id="site-name" name="name" className="input" required maxLength={120} /></div>
                  <StateSelect value={b.state} id="site-state" />
                  <div><label htmlFor="site-town" className="label">Town</label><input id="site-town" name="town" className="input" maxLength={80} /></div>
                  <div><label htmlFor="capacityNote" className="label">Capacity or need</label><input id="capacityNote" name="capacityNote" className="input" maxLength={160} placeholder="e.g. 20 t storage; needs 3 t a week" /></div>
                </div>
              </HubForm>
              <ul className="space-y-2">
                {sites.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                    <span>{s.name} · {s.gas} {s.kind.toLowerCase()} · {stateName(s.state)} <span className="text-xs text-ink-600">· confirmed {day(s.lastConfirmedAt)}</span>{daysAgo(s.lastConfirmedAt, now) > SITE_STALE_DAYS && <Pill className="ml-1 bg-amber-100 text-amber-800">Needs reconfirming</Pill>}</span>
                    <span className="flex gap-1">
                      <HubForm action={confirmSiteAction} submit="Still current" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={s.id} /></HubForm>
                      <HubForm action={removeSiteAction} submit="Remove" buttonClass="btn-ghost btn-sm" inline><input type="hidden" name="id" value={s.id} /></HubForm>
                    </span>
                  </li>
                ))}
                {!sites.length && <li className="muted">No sites yet.</li>}
              </ul>
            </div>
          </section>

          <section aria-labelledby="inbox-h">
            <SectionHeader id="inbox-h" title="Messages to your business" />
            {messages.length ? (
              <ul className="space-y-2">
                {messages.map((m) => (
                  <li key={m.id} className="rounded-xl border border-ink-100 p-3 text-sm">
                    <p className="text-xs text-ink-600"><BusinessName b={m.from} /> · {day(m.createdAt)}{m.listing ? ` · about your ${productLabel(m.listing.product)} ${m.listing.kind === "OFFER" ? "offer" : "request"}` : ""}</p>
                    <p className="mt-1 whitespace-pre-line">{m.message}</p>
                    {m.from.phone && <p className="mt-1 text-xs">Reply: <a href={`tel:${m.from.phone.replace(/[^0-9+]/g, "")}`}>{m.from.phone}</a></p>}
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No messages yet.</p>}
          </section>
        </>
      )}
    </>
  );
}
