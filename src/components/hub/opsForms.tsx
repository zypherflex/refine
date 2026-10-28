"use client";
import { useActionState } from "react";
import { logDeliveryAction, postJobAction, proposeAgreementAction, quoteAction, reportPricesAction, reviewDeliveryAction } from "@/app/actions/hub";
import { LOCATIONS, NIGERIAN_STATES, OTHER_LOCATIONS, PRODUCTS, UNITS } from "@/lib/hub/catalog";
import { PRICE_ITEMS } from "@/lib/hub/prices";
import { FieldError } from "../ui";

type State = { error?: string | null; ok?: string | null };

function Status({ state }: { state: State }) {
  return (
    <>
      <FieldError message={state.error} />
      {state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
    </>
  );
}

function Locations({ nigeriaOnly = false }: { nigeriaOnly?: boolean }) {
  return nigeriaOnly ? (
    <>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</>
  ) : (
    <>
      <optgroup label="Nigeria">{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</optgroup>
      <optgroup label="Outside Nigeria">{OTHER_LOCATIONS.map((s) => <option key={s}>{s}</option>)}</optgroup>
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function PriceReportForm({ defaultState }: { defaultState: string }) {
  const [state, action, pending] = useActionState(reportPricesAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="p-state" className="label">State *</label>
          <select id="p-state" name="state" className="input" required defaultValue={NIGERIAN_STATES.includes(defaultState as never) ? defaultState : ""}>
            <option value="" disabled>Choose…</option>
            <Locations nigeriaOnly />
          </select>
        </div>
        <div>
          <label htmlFor="p-day" className="label">These were my prices</label>
          <select id="p-day" name="daysAgo" className="input" defaultValue="0">
            <option value="0">Today</option>
            <option value="1">Yesterday</option>
            {[2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{d} days ago</option>)}
          </select>
        </div>
      </div>
      <fieldset>
        <legend className="label">Your selling price in naira (leave blank what you don&apos;t sell)</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRICE_ITEMS.map((p) => (
            <div key={p.id}>
              <label htmlFor={`price-${p.id}`} className="text-xs font-medium text-navy-800">{p.label} <span className="font-normal text-navy-500">{p.unit}</span></label>
              <input id={`price-${p.id}`} name={`price:${p.id}`} className="input mt-1" inputMode="decimal" placeholder="₦" />
            </div>
          ))}
        </div>
      </fieldset>
      <p className="hint">Report prices you actually charged, never planned prices. The board only shows medians across at least three sellers in a state.</p>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>Submit prices</button>
    </form>
  );
}

export function JobForm({ defaultFrom }: { defaultFrom: string }) {
  const [state, action, pending] = useActionState(postJobAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="j-title" className="label">What needs moving? *</label>
        <input id="j-title" name="title" className="input" required minLength={4} maxLength={140} placeholder="e.g. 20 tonnes LPG, Ikeja to Kano" />
      </div>
      <fieldset>
        <legend className="label">Products *</legend>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {PRODUCTS.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="products" value={p.id} />{p.label}</label>)}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="j-qty" className="label">Quantity *</label><input id="j-qty" name="quantity" className="input" required inputMode="decimal" /></div>
        <div><label htmlFor="j-unit" className="label">Unit *</label><select id="j-unit" name="unit" className="input" required defaultValue="">{[<option key="" value="" disabled>Choose…</option>, ...UNITS.map((u) => <option key={u}>{u}</option>)]}</select></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="j-from" className="label">From *</label><select id="j-from" name="fromState" className="input" required defaultValue={LOCATIONS.includes(defaultFrom) ? defaultFrom : ""}><option value="" disabled>Choose…</option><Locations /></select></div>
        <div><label htmlFor="j-fromtown" className="label">Pickup town or depot</label><input id="j-fromtown" name="fromTown" className="input" maxLength={80} /></div>
        <div><label htmlFor="j-to" className="label">To *</label><select id="j-to" name="toState" className="input" required defaultValue=""><option value="" disabled>Choose…</option><Locations /></select></div>
        <div><label htmlFor="j-totown" className="label">Delivery town</label><input id="j-totown" name="toTown" className="input" maxLength={80} /></div>
      </div>
      <div className="sm:w-60"><label htmlFor="j-date" className="label">Pickup date *</label><input id="j-date" name="pickupDate" type="date" className="input" required min={today()} defaultValue={today()} /></div>
      <div><label htmlFor="j-details" className="label">Details for carriers</label><textarea id="j-details" name="details" className="input min-h-24" maxLength={2000} placeholder="Truck type, loading times, documents, safety requirements, offloading." /></div>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>Post job and collect quotes</button>
    </form>
  );
}

export function QuoteForm({ jobId, current }: { jobId: string; current?: { priceNaira: number; note: string } }) {
  const [state, action, pending] = useActionState(quoteAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="jobId" value={jobId} />
      <div><label htmlFor="q-price" className="label">Your price for the whole job (₦) *</label><input id="q-price" name="priceNaira" className="input" required inputMode="decimal" defaultValue={current?.priceNaira ?? ""} /></div>
      <div><label htmlFor="q-note" className="label">Note</label><textarea id="q-note" name="note" className="input min-h-20" maxLength={1000} defaultValue={current?.note ?? ""} placeholder="Truck type and capacity, when you can load, what is included." /></div>
      <Status state={state} />
      <button className="btn-primary btn-sm" disabled={pending}>{current ? "Update quote" : "Send quote"}</button>
    </form>
  );
}

export function AgreementForm({ counterparty, side, defaultTo }: { counterparty: { id: string; name: string }; side: "BUYER" | "SELLER"; defaultTo: string }) {
  const [state, action, pending] = useActionState(proposeAgreementAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="counterpartyId" value={counterparty.id} />
      <input type="hidden" name="side" value={side} />
      <p className="text-sm">You are the <b>{side === "BUYER" ? "buyer" : "seller"}</b>; {counterparty.name} is the {side === "BUYER" ? "seller" : "buyer"}.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor="a-product" className="label">Product *</label><select id="a-product" name="product" className="input" required defaultValue="lpg">{PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
        <div><label htmlFor="a-qty" className="label">Quantity per delivery *</label><input id="a-qty" name="quantity" className="input" required inputMode="decimal" /></div>
        <div><label htmlFor="a-unit" className="label">Unit *</label><select id="a-unit" name="unit" className="input" required defaultValue="tonnes">{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div><label htmlFor="a-freq" className="label">How often *</label><select id="a-freq" name="frequency" className="input" defaultValue="WEEKLY"><option value="WEEKLY">Every week</option><option value="FORTNIGHTLY">Every two weeks</option><option value="MONTHLY">Every month</option></select></div>
        <div><label htmlFor="a-to" className="label">Deliver to *</label><select id="a-to" name="deliverTo" className="input" required defaultValue={LOCATIONS.includes(defaultTo) ? defaultTo : ""}><option value="" disabled>Choose…</option><Locations /></select></div>
        <div><label htmlFor="a-price" className="label">Price terms</label><input id="a-price" name="priceNote" className="input" maxLength={200} placeholder="e.g. Depot price on the day + ₦40/kg" /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="a-start" className="label">First delivery *</label><input id="a-start" name="startDate" type="date" className="input" required defaultValue={today()} /></div>
        <div><label htmlFor="a-end" className="label">Ends (optional)</label><input id="a-end" name="endDate" type="date" className="input" /></div>
      </div>
      <div><label htmlFor="a-notes" className="label">Other terms</label><textarea id="a-notes" name="notes" className="input min-h-20" maxLength={1000} placeholder="Payment terms, quality standard, what happens if a delivery is missed." /></div>
      <p className="hint">This records what you agreed so both sides can confirm each delivery. Payment is settled between you, outside RefineryLens.</p>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>Send proposal to {counterparty.name}</button>
    </form>
  );
}

export function LogDeliveryForm({ agreementId, quantity, unit }: { agreementId: string; quantity: number; unit: string }) {
  const [state, action, pending] = useActionState(logDeliveryAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="agreementId" value={agreementId} />
      <div><label htmlFor="d-date" className="label">Delivered on</label><input id="d-date" name="deliveredOn" type="date" className="input" required max={today()} defaultValue={today()} /></div>
      <div><label htmlFor="d-qty" className="label">Quantity ({unit})</label><input id="d-qty" name="quantity" className="input" required inputMode="decimal" defaultValue={quantity} /></div>
      <button className="btn-primary" disabled={pending}>Log delivery</button>
      <div className="sm:col-span-3"><Status state={state} /></div>
    </form>
  );
}

export function ReviewDeliveryForm({ agreementId, deliveryId }: { agreementId: string; deliveryId: string }) {
  const [state, action, pending] = useActionState(reviewDeliveryAction, {});
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="agreementId" value={agreementId} />
      <input type="hidden" name="deliveryId" value={deliveryId} />
      <div className="min-w-48 flex-1"><label htmlFor={`n-${deliveryId}`} className="sr-only">Note if disputing</label><input id={`n-${deliveryId}`} name="note" className="input py-1.5" maxLength={500} placeholder="If disputing, say what was wrong" /></div>
      <button name="ok" value="1" className="btn-primary btn-sm" disabled={pending}>Confirm received</button>
      <button name="ok" value="0" className="btn-secondary btn-sm" disabled={pending}>Dispute</button>
      <FieldError message={state.error} />
    </form>
  );
}
