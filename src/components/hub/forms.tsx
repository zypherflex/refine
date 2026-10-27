"use client";
import { useActionState, useState } from "react";
import type { GasSite, GasSiteKind, HubBusiness, HubListing, HubListingKind } from "@prisma/client";
import {
  decideVerificationAction,
  reportBusinessAction,
  replyAction,
  requestVerificationAction,
  saveBusinessAction,
  saveListingAction,
  saveSiteAction,
  sendEnquiryAction,
  startBusinessCheckoutAction,
  suspendBusinessAction,
} from "@/app/actions/hub";
import { HUB_ROLES, LISTING_DAYS, LISTING_KINDS, LOCATIONS, NIGERIAN_STATES, OTHER_LOCATIONS, PRODUCTS, UNITS } from "@/lib/hub/catalog";
import { CYLINDER_SIZES, GASES, SITE_KINDS } from "@/lib/hub/gas";
import { FieldError } from "../ui";
import { useIsNativeApp } from "../native/NativeBridge";

function Status({ state }: { state: { error?: string | null; ok?: string | null } }) {
  return (
    <>
      <FieldError message={state.error} />
      {state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
    </>
  );
}

function LocationOptions() {
  return (
    <>
      <optgroup label="Nigeria">{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</optgroup>
      <optgroup label="Outside Nigeria">{OTHER_LOCATIONS.map((s) => <option key={s}>{s}</option>)}</optgroup>
    </>
  );
}

export function BusinessForm({ business }: { business: HubBusiness | null }) {
  const [state, action, pending] = useActionState(saveBusinessAction, {});
  const [roles, setRoles] = useState<string[]>(business?.roles ?? []);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="b-name" className="label">Business name *</label>
        <input id="b-name" name="name" className="input" required minLength={2} maxLength={120} defaultValue={business?.name ?? ""} />
        <p className="hint">Use the registered name. Names of well-known refiners stay hidden until RefineryLens verifies the business.</p>
      </div>
      <fieldset>
        <legend className="label">What does your business do on the hub? *</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {HUB_ROLES.map((r) => (
            <label key={r.id} className="flex gap-2 rounded-lg border border-ink-100 bg-white p-3 text-sm">
              <input type="checkbox" name="roles" value={r.id} checked={roles.includes(r.id)} onChange={(e) => setRoles(e.target.checked ? [...roles, r.id] : roles.filter((x) => x !== r.id))} />
              <span><span className="font-medium">{r.label}</span><span className="block text-xs text-ink-600">{r.who}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="b-state" className="label">State or country *</label>
          <select id="b-state" name="state" className="input" required defaultValue={business?.state ?? ""}>
            <option value="" disabled>Choose…</option>
            <LocationOptions />
          </select>
        </div>
        <div>
          <label htmlFor="b-city" className="label">Town or city</label>
          <input id="b-city" name="city" className="input" maxLength={80} defaultValue={business?.city ?? ""} />
        </div>
      </div>
      <div>
        <label htmlFor="b-about" className="label">About the business</label>
        <textarea id="b-about" name="about" className="input min-h-24" maxLength={2000} defaultValue={business?.about ?? ""} placeholder="What you sell, buy or carry, your fleet or storage, and how you like to work." />
      </div>
      {roles.includes("REFINERY") && (
        <div>
          <label htmlFor="b-cap" className="label">Stated refining capacity (barrels per day)</label>
          <input id="b-cap" name="capacityBpd" className="input" inputMode="numeric" defaultValue={business?.capacityBpd ?? ""} />
          <p className="hint">Shown as stated by your business, not checked by RefineryLens.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="b-reg" className="label">CAC registration number</label>
          <input id="b-reg" name="registrationNumber" className="input" maxLength={40} defaultValue={business?.registrationNumber ?? ""} placeholder="e.g. RC 1234567" />
          <p className="hint">Needed for verification. Only RefineryLens administrators see it.</p>
        </div>
        <div>
          <label htmlFor="b-web" className="label">Website</label>
          <input id="b-web" name="website" type="url" className="input" maxLength={200} defaultValue={business?.website ?? ""} placeholder="https://" />
        </div>
      </div>
      <div>
        <label htmlFor="b-lic" className="label">Licences and permits held</label>
        <textarea id="b-lic" name="licences" className="input min-h-16" maxLength={500} defaultValue={business?.licences ?? ""} placeholder="e.g. NMDPRA retail outlet licence, LPG plant licence, haulage permits" />
      </div>
      <p className="hint">Changing the name, registration number, licences or adding the refinery role removes a Verified badge until it is checked again.</p>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>{business ? "Save profile" : "Create business profile"}</button>
    </form>
  );
}

export function RequestVerificationForm() {
  const [state, action, pending] = useActionState(requestVerificationAction, {});
  return (
    <form action={action} className="space-y-2">
      <Status state={state} />
      <button className="btn-secondary btn-sm" disabled={pending}>Request verification</button>
    </form>
  );
}

function Checkboxes({ name, options, selected, columns = "sm:grid-cols-3" }: { name: string; options: readonly { id: string; label: string }[]; selected: string[]; columns?: string }) {
  return (
    <div className={`grid gap-1.5 ${columns}`}>
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(o.id)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function ListingForm({ kinds, listing, initialKind }: { kinds: HubListingKind[]; listing: HubListing | null; initialKind: HubListingKind }) {
  const [state, action, pending] = useActionState(saveListingAction, {});
  const [kind, setKind] = useState<HubListingKind>(listing?.kind ?? initialKind);
  const where = { OFFER: "Where is the product? *", REQUEST: "Where should it be delivered? *", DELIVERY: "Where is your fleet based? *" }[kind];
  const areas = { OFFER: "States you can supply or deliver to", REQUEST: "Places you will accept supply from (optional)", DELIVERY: "States and routes you serve" }[kind];
  return (
    <form action={action} className="space-y-4">
      {listing && <input type="hidden" name="id" value={listing.id} />}
      <fieldset>
        <legend className="label">Type of listing *</legend>
        <div className="flex flex-wrap gap-2">
          {LISTING_KINDS.map((k) => (
            <label key={k.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${kind === k.id ? "border-brand-600 bg-brand-50" : "border-ink-100 bg-white"} ${!kinds.includes(k.id) || (listing && listing.kind !== k.id) ? "opacity-50" : ""}`}>
              <input type="radio" name="kind" value={k.id} checked={kind === k.id} disabled={!kinds.includes(k.id) || (!!listing && listing.kind !== k.id)} onChange={() => setKind(k.id)} />
              {k.verb}
            </label>
          ))}
        </div>
        {kinds.length < LISTING_KINDS.length && <p className="hint">Other types need a matching role on your business profile.</p>}
      </fieldset>
      <div>
        <label htmlFor="l-title" className="label">Title *</label>
        <input id="l-title" name="title" className="input" required minLength={4} maxLength={140} defaultValue={listing?.title ?? ""} placeholder={kind === "OFFER" ? "e.g. 33,000 litres AGO available ex-Lekki" : kind === "REQUEST" ? "e.g. Weekly 20 tonnes LPG for Ibadan skid plant" : "e.g. Two 33,000-litre tankers, Lagos to the North"} />
      </div>
      <fieldset>
        <legend className="label">{kind === "DELIVERY" ? "Products you can carry *" : "Products *"}</legend>
        <Checkboxes name="products" options={PRODUCTS} selected={listing?.products ?? []} />
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="l-qty" className="label">{kind === "DELIVERY" ? "Capacity" : "Quantity"}</label>
          <input id="l-qty" name="quantity" className="input" inputMode="decimal" defaultValue={listing?.quantity ?? ""} />
        </div>
        <div>
          <label htmlFor="l-unit" className="label">Unit</label>
          <select id="l-unit" name="unit" className="input" defaultValue={listing?.unit ?? ""}>
            <option value="">—</option>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="l-price" className="label">{kind === "REQUEST" ? "Target price or terms" : "Price or rate"}</label>
          <input id="l-price" name="priceNote" className="input" maxLength={200} defaultValue={listing?.priceNote ?? ""} placeholder="e.g. NGN 1,050/litre ex-depot" />
        </div>
      </div>
      <div>
        <label htmlFor="l-state" className="label">{where}</label>
        <select id="l-state" name="state" className="input" required defaultValue={listing?.state ?? ""}>
          <option value="" disabled>Choose…</option>
          <LocationOptions />
        </select>
      </div>
      <details className="rounded-lg border border-ink-100 bg-white p-3" open={!!listing?.areas.length}>
        <summary className="text-sm font-medium">{areas}{listing?.areas.length ? ` (${listing.areas.length} chosen)` : ""}</summary>
        <div className="mt-3"><Checkboxes name="areas" options={LOCATIONS.map((s) => ({ id: s, label: s }))} selected={listing?.areas ?? []} columns="grid-cols-2 sm:grid-cols-4" /></div>
      </details>
      <div>
        <label htmlFor="l-details" className="label">Details</label>
        <textarea id="l-details" name="details" className="input min-h-28" maxLength={4000} defaultValue={listing?.details ?? ""} placeholder="Quality and specification, loading point, minimum order, payment terms, truck types, lead times." />
      </div>
      <div>
        <label htmlFor="l-days" className="label">Keep it live for</label>
        <select id="l-days" name="days" className="input sm:w-48" defaultValue="30">
          {LISTING_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
        <p className="hint">Listings drop off when they expire so buyers only see current offers. You can renew them.</p>
      </div>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>{listing ? "Save and renew listing" : "Publish listing"}</button>
    </form>
  );
}

export function EnquiryForm({ businessId, listingId, placeholder }: { businessId: string; listingId?: string; placeholder: string }) {
  const [state, action, pending] = useActionState(sendEnquiryAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="businessId" value={businessId} />
      {listingId && <input type="hidden" name="listingId" value={listingId} />}
      <label htmlFor="enq-body" className="label">Your message</label>
      <textarea id="enq-body" name="body" className="input min-h-28" required maxLength={4000} placeholder={placeholder} />
      <Status state={state} />
      <button className="btn-primary btn-sm" disabled={pending}>Send message</button>
    </form>
  );
}

export function ReplyForm({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState(replyAction, {});
  return (
    <form action={action} className="space-y-2" key={state.ok ? Date.now() : "reply"}>
      <input type="hidden" name="threadId" value={threadId} />
      <label htmlFor="reply-body" className="label">Reply</label>
      <textarea id="reply-body" name="body" className="input min-h-24" required maxLength={4000} />
      <FieldError message={state.error} />
      <button className="btn-primary btn-sm" disabled={pending}>Send</button>
    </form>
  );
}

export function ReportForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(reportBusinessAction, {});
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-ink-600 hover:text-risk-800">Report this business</summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="businessId" value={businessId} />
        <label htmlFor="rep-reason" className="label">What happened?</label>
        <textarea id="rep-reason" name="reason" className="input min-h-20" required minLength={10} maxLength={2000} placeholder="e.g. Asked for payment in advance and stopped replying." />
        <Status state={state} />
        <button className="btn-secondary btn-sm" disabled={pending}>Send report</button>
      </form>
    </details>
  );
}

export function DecideForm({ businessId }: { businessId: string }) {
  const [state, action, pending] = useActionState(decideVerificationAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="businessId" value={businessId} />
      <label htmlFor={`note-${businessId}`} className="label">Note to the business</label>
      <input id={`note-${businessId}`} name="note" className="input" maxLength={1000} placeholder="Required when returning: what is missing or wrong" />
      <Status state={state} />
      <div className="flex flex-wrap gap-2">
        <button name="decision" value="VERIFY" className="btn-primary btn-sm" disabled={pending}>Verify</button>
        <button name="decision" value="RETURN" className="btn-secondary btn-sm" disabled={pending}>Return for more information</button>
      </div>
    </form>
  );
}

export function SuspendForm({ businessId, name }: { businessId: string; name: string }) {
  const [state, action, pending] = useActionState(suspendBusinessAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <div className="min-w-48 flex-1">
        <label htmlFor={`sus-${businessId}`} className="label">Reason for suspending {name}</label>
        <input id={`sus-${businessId}`} name="note" className="input" required maxLength={1000} />
      </div>
      <button className="btn-danger btn-sm" disabled={pending}>Suspend</button>
      <Status state={state} />
    </form>
  );
}

export function SiteForm({ kinds, site }: { kinds: GasSiteKind[]; site: GasSite | null }) {
  const [state, action, pending] = useActionState(saveSiteAction, {});
  const [kind, setKind] = useState<GasSiteKind>(site?.kind ?? kinds[0]);
  const [gases, setGases] = useState<string[]>(site?.gases ?? []);
  const supply = kind !== "LOGISTICS_BASE";
  return (
    <form action={action} className="space-y-4">
      {site && <input type="hidden" name="id" value={site.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="s-name" className="label">Site name *</label>
          <input id="s-name" name="name" className="input" required minLength={2} maxLength={120} defaultValue={site?.name ?? ""} placeholder="e.g. Sabon Gari refill plant" />
        </div>
        <div>
          <label htmlFor="s-kind" className="label">Type of site *</label>
          <select id="s-kind" name="kind" className="input" value={kind} onChange={(e) => setKind(e.target.value as GasSiteKind)}>
            {SITE_KINDS.filter((k) => kinds.includes(k.id) || k.id === site?.kind).map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <p className="hint">{SITE_KINDS.find((k) => k.id === kind)?.help}</p>
        </div>
      </div>
      <fieldset>
        <legend className="label">{supply ? "Gas supplied *" : "Gas carried *"}</legend>
        <div className="flex flex-wrap gap-4">
          {GASES.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="gases" value={g.id} checked={gases.includes(g.id)} onChange={(e) => setGases(e.target.checked ? [...gases, g.id] : gases.filter((x) => x !== g.id))} />
              {g.label}
            </label>
          ))}
        </div>
      </fieldset>
      {gases.includes("lpg_cylinder") && (
        <fieldset>
          <legend className="label">Cylinder sizes (kg)</legend>
          <div className="flex flex-wrap gap-4">
            {CYLINDER_SIZES.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm"><input type="checkbox" name="cylinderSizes" value={c} defaultChecked={site?.cylinderSizes.includes(c)} />{c} kg</label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="s-state" className="label">State *</label>
          <select id="s-state" name="state" className="input" required defaultValue={site?.state ?? ""}>
            <option value="" disabled>Choose…</option>
            {NIGERIAN_STATES.map((st) => <option key={st}>{st}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="s-town" className="label">Town or LGA</label>
          <input id="s-town" name="town" className="input" maxLength={80} defaultValue={site?.town ?? ""} />
        </div>
        <div>
          <label htmlFor="s-status" className="label">Status</label>
          <select id="s-status" name="status" className="input" defaultValue={site?.status ?? "OPERATING"}>
            <option value="OPERATING">Operating</option>
            <option value="PLANNED">Planned or under construction</option>
            <option value="CLOSED">Closed (hidden from the map)</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="s-address" className="label">Address or landmark</label>
        <input id="s-address" name="address" className="input" maxLength={200} defaultValue={site?.address ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {supply && (
          <div>
            <label htmlFor="s-storage" className="label">Storage (tonnes)</label>
            <input id="s-storage" name="storageTonnes" className="input" inputMode="decimal" defaultValue={site?.storageTonnes ?? ""} />
          </div>
        )}
        <div>
          <label htmlFor="s-hours" className="label">Opening hours</label>
          <input id="s-hours" name="hours" className="input" maxLength={120} defaultValue={site?.hours ?? ""} placeholder="e.g. Mon–Sat 7:00–19:00" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="delivers" value="1" defaultChecked={site?.delivers} /> {supply ? "Delivers from this site" : "Takes delivery jobs from this base"}</label>
      <div>
        <label htmlFor="s-notes" className="label">Notes for buyers</label>
        <textarea id="s-notes" name="notes" className="input min-h-20" maxLength={1000} defaultValue={site?.notes ?? ""} placeholder="Minimum order, payment terms, truck access, safety rules." />
      </div>
      <p className="hint">Details are shown as stated by your business. Saving confirms they are current; entries not confirmed for 90 days are marked as possibly out of date.</p>
      <FieldError message={state.error} />
      <button className="btn-primary" disabled={pending}>{site ? "Save and confirm" : "Add site to the gas network"}</button>
    </form>
  );
}

export function BusinessPlanButton({ label }: { label: string }) {
  const [state, action, pending] = useActionState(startBusinessCheckoutAction, {});
  // App store rules require their own billing for in-app purchases, so plans are bought on the website only.
  if (useIsNativeApp()) return <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-700">Plans are managed on the RefineryLens website, not in the app.</p>;
  return (
    <form action={action} className="space-y-2">
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Opening secure payment…" : label}</button>
      <FieldError message={state.error} />
    </form>
  );
}
