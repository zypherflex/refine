"use client";
import { useActionState, useMemo, useState } from "react";
import {
  addCylinderAction, addOutletAction, advanceOrderAction, cancelOrderAction, logRefillAction, placeOrderAction, rateOrderAction, reportOutletAction,
  saveHomeDeliveryAction,
} from "@/app/actions/everyday";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { naira, priceItem } from "@/lib/hub/prices";
import { cngSavings, EVERYDAY_LABEL, HOME_CYLINDER_SIZES, OUTLET_KINDS, PROBLEMS, QUEUES, VEHICLES, type EverydayItem } from "@/lib/everyday";
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

const States = () => <>{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</>;
const today = () => new Date().toISOString().slice(0, 10);

export function OutletForm({ defaultState }: { defaultState: string }) {
  const [state, action, pending] = useActionState(addOutletAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="o-name" className="label">Name on the sign *</label><input id="o-name" name="name" required className="input" placeholder="e.g. MRS Ojuelegba" /></div>
        <div><label htmlFor="o-brand" className="label">Brand</label><input id="o-brand" name="brand" className="input" placeholder="NNPC, MRS, Conoil, independent…" /></div>
        <div>
          <label htmlFor="o-kind" className="label">Kind of place *</label>
          <select id="o-kind" name="kind" className="input" required>{OUTLET_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select>
        </div>
        <div><label htmlFor="o-state" className="label">State *</label><select id="o-state" name="state" className="input" required defaultValue={defaultState}><States /></select></div>
        <div><label htmlFor="o-area" className="label">Area or LGA *</label><input id="o-area" name="area" required className="input" placeholder="e.g. Surulere" /></div>
        <div><label htmlFor="o-address" className="label">Street or landmark</label><input id="o-address" name="address" className="input" placeholder="e.g. by the bus stop, Ojuelegba Rd" /></div>
      </div>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add this place"}</button>
    </form>
  );
}

/** One form, three kinds of report: what you paid, whether they are selling (and the queue), or a problem. */
export function ReportForm({ outletId, items }: { outletId: string; items: EverydayItem[] }) {
  const [state, action, pending] = useActionState(reportOutletAction, {});
  const [kind, setKind] = useState<"PRICE" | "AVAILABILITY" | "PROBLEM">("PRICE");
  const [available, setAvailable] = useState("yes");
  const [item, setItem] = useState<EverydayItem>(items[0]);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="outletId" value={outletId} />
      <input type="hidden" name="kind" value={kind} />
      <div role="tablist" aria-label="What are you reporting?" className="inline-flex rounded-xl bg-ink-100 p-1 text-sm">
        {([["PRICE", "Price I paid"], ["AVAILABILITY", "Selling / queue"], ["PROBLEM", "A problem"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-lg px-3 py-1.5 font-medium ${kind === k ? "bg-white text-ink-950 shadow-sm" : "text-ink-600"}`}>{l}</button>
        ))}
      </div>
      {kind !== "PROBLEM" && (
        <div>
          <label htmlFor="r-item" className="label">Product</label>
          <select id="r-item" name="item" className="input" value={item} onChange={(e) => setItem(e.target.value as EverydayItem)}>
            {items.map((i) => <option key={i} value={i}>{EVERYDAY_LABEL[i]}</option>)}
          </select>
        </div>
      )}
      {kind === "PRICE" && (
        <div>
          <label htmlFor="r-price" className="label">Price you paid, ₦ {priceItem(item)?.unit}</label>
          <input id="r-price" name="price" inputMode="decimal" required className="input num" placeholder={item === "lpg_cyl_12_5" ? "e.g. 15000" : "e.g. 950"} />
          <p className="hint">The price on the pump or the receipt, not what you expect it to be.</p>
        </div>
      )}
      {kind === "AVAILABILITY" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Are they selling?</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="available" value="yes" checked={available === "yes"} onChange={() => setAvailable("yes")} /> Yes, selling</label>
              <label className="flex items-center gap-2"><input type="radio" name="available" value="no" checked={available === "no"} onChange={() => setAvailable("no")} /> Not selling</label>
            </div>
          </fieldset>
          {available === "yes" && (
            <div><label htmlFor="r-queue" className="label">Queue</label><select id="r-queue" name="queue" className="input">{QUEUES.map((q) => <option key={q.id} value={q.id}>{q.label}</option>)}</select></div>
          )}
        </div>
      )}
      {kind === "PROBLEM" && (
        <div><label htmlFor="r-problem" className="label">What happened?</label><select id="r-problem" name="problem" className="input">{PROBLEMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
      )}
      <div><label htmlFor="r-note" className="label">Note (optional)</label><input id="r-note" name="note" maxLength={280} className="input" placeholder={kind === "PROBLEM" ? "What you saw, e.g. 10 litres paid, 8.5 litres measured" : "e.g. only pump 3 working"} /></div>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Sending…" : "Send report"}</button>
    </form>
  );
}

type Seller = { id: string; name: string; homePricePerKg: number | null; deliveryFeeNaira: number | null; delivered: number; rating: number | null; isDemo: boolean; city: string };

export function OrderForm({ sellers, state: s, phone, defaultSeller }: { sellers: Seller[]; state: string; phone: string; defaultSeller?: string }) {
  const [state, action, pending] = useActionState(placeOrderAction, {});
  const [sellerId, setSellerId] = useState(defaultSeller && sellers.some((x) => x.id === defaultSeller) ? defaultSeller : sellers[0]?.id ?? "");
  const [kg, setKg] = useState(12.5);
  const [count, setCount] = useState(1);
  const seller = sellers.find((x) => x.id === sellerId);
  const est = seller?.homePricePerKg ? Math.round(seller.homePricePerKg * kg * count + (seller.deliveryFeeNaira ?? 0)) : null;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="state" value={s} />
      <fieldset>
        <legend className="label">Seller</legend>
        <ul className="space-y-2">
          {sellers.map((x) => (
            <li key={x.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
                <input type="radio" name="businessId" value={x.id} checked={sellerId === x.id} onChange={() => setSellerId(x.id)} className="mt-1" />
                <span className="flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">{x.name} <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-800">Verified</span>{x.isDemo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">Demo</span>}</span>
                  <span className="mt-0.5 block text-xs text-ink-600">{x.city ? `${x.city} · ` : ""}{naira(x.homePricePerKg!)} per kg{x.deliveryFeeNaira ? ` + ${naira(x.deliveryFeeNaira)} delivery` : " · free delivery"} · {x.delivered} delivered{x.rating ? ` · ${x.rating.toFixed(1)}★` : ""}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="g-kg" className="label">Cylinder size</label>
          <select id="g-kg" name="cylinderKg" className="input" value={kg} onChange={(e) => setKg(Number(e.target.value))}>{HOME_CYLINDER_SIZES.map((k) => <option key={k} value={k}>{k} kg</option>)}</select>
        </div>
        <div>
          <label htmlFor="g-n" className="label">How many cylinders</label>
          <select id="g-n" name="cylinders" className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select>
        </div>
        <div><label htmlFor="g-area" className="label">Area *</label><input id="g-area" name="area" required className="input" placeholder="e.g. Surulere" /></div>
        <div><label htmlFor="g-phone" className="label">Phone for the rider *</label><input id="g-phone" name="phone" type="tel" required className="input" defaultValue={phone} placeholder="0803 123 4567" /></div>
      </div>
      <div><label htmlFor="g-address" className="label">Delivery address and landmark *</label><textarea id="g-address" name="address" required rows={2} className="input" placeholder="House number, street, and something the rider can find" /></div>
      <div><label htmlFor="g-note" className="label">Note for the seller</label><input id="g-note" name="note" className="input" placeholder="e.g. call when at the gate; cylinder valve is the old type" /></div>
      <div className="rounded-xl bg-ink-950 p-4 text-white">
        <p className="text-xs text-ink-300">Estimate from the seller&apos;s listed prices</p>
        <p className="num mt-1 text-2xl font-semibold">{est === null ? "–" : naira(est)}</p>
        <p className="mt-1 text-xs text-ink-300">The seller confirms the final price when accepting. You pay the rider on delivery, by cash or transfer; RefineryLens never asks you to pay in advance.</p>
      </div>
      <Status state={state} />
      <button className="btn-primary w-full py-3 text-base" disabled={pending || !sellerId}>{pending ? "Placing order…" : "Place order · pay on delivery"}</button>
    </form>
  );
}

export function CancelOrderForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(cancelOrderAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Status state={state} />
      <button className="btn-secondary btn-sm" disabled={pending}>Cancel order</button>
    </form>
  );
}

export function RateForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(rateOrderAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="orderId" value={orderId} />
      <fieldset className="flex items-center gap-1">
        <legend className="label">How was the delivery?</legend>
        {[1, 2, 3, 4, 5].map((n) => <button key={n} name="rating" value={n} disabled={pending} aria-label={`${n} star${n === 1 ? "" : "s"}`} className="rounded-lg px-2 py-1 text-2xl text-amber-500 hover:bg-amber-50">★</button>)}
      </fieldset>
      <Status state={state} />
    </form>
  );
}

export function OrderStepForm({ orderId, step, estimate }: { orderId: string; step: "accept" | "decline" | "dispatch" | "deliver"; estimate?: number | null }) {
  const [state, action, pending] = useActionState(advanceOrderAction, {});
  const label = { accept: "Accept", decline: "Decline", dispatch: "On the way", deliver: "Delivered" }[step];
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="step" value={step} />
      {step === "accept" && <div><label className="label" htmlFor={`p-${orderId}`}>Total to collect, ₦</label><input id={`p-${orderId}`} name="price" inputMode="decimal" defaultValue={estimate ?? ""} className="input num w-32" required /></div>}
      {step === "decline" && <input name="note" className="input w-48" placeholder="Reason (optional)" aria-label="Reason" />}
      <button className={step === "decline" ? "btn-secondary btn-sm" : "btn-primary btn-sm"} disabled={pending}>{label}</button>
      <Status state={state} />
    </form>
  );
}

export function HomeDeliveryForm({ current }: { current: { homeDelivery: boolean; deliveryStates: string[]; homePricePerKg: number | null; deliveryFeeNaira: number | null } }) {
  const [state, action, pending] = useActionState(saveHomeDeliveryAction, {});
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="homeDelivery" defaultChecked={current.homeDelivery} /> Deliver LPG refills to homes</label>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="h-kg" className="label">Your price per kg, ₦</label><input id="h-kg" name="homePricePerKg" inputMode="decimal" className="input num" defaultValue={current.homePricePerKg ?? ""} /></div>
        <div><label htmlFor="h-fee" className="label">Delivery fee, ₦ (blank for free)</label><input id="h-fee" name="deliveryFeeNaira" inputMode="decimal" className="input num" defaultValue={current.deliveryFeeNaira ?? ""} /></div>
      </div>
      <fieldset>
        <legend className="label">States you deliver to</legend>
        <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-ink-100 p-2 text-sm sm:grid-cols-4">
          {NIGERIAN_STATES.map((s) => <label key={s} className="flex items-center gap-2"><input type="checkbox" name="deliveryStates" value={s} defaultChecked={current.deliveryStates.includes(s)} />{s}</label>)}
        </div>
      </fieldset>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>Save</button>
    </form>
  );
}

export function CylinderForm() {
  const [state, action, pending] = useActionState(addCylinderAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="c-label" className="label">Name</label><input id="c-label" name="label" className="input" defaultValue="Kitchen" /></div>
        <div><label htmlFor="c-size" className="label">Size</label><select id="c-size" name="sizeKg" className="input" defaultValue="12.5">{HOME_CYLINDER_SIZES.map((k) => <option key={k} value={k}>{k} kg</option>)}</select></div>
        <div><label htmlFor="c-last" className="label">Last refilled on</label><input id="c-last" name="lastFilledAt" type="date" max={today()} className="input" defaultValue={today()} /></div>
        <div><label htmlFor="c-days" className="label">A full cylinder usually lasts (days)</label><input id="c-days" name="usualDays" type="number" min={3} max={180} className="input num" defaultValue={30} /></div>
      </div>
      <p className="hint">A rough guess is fine. After two refills we measure it for you.</p>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>Start tracking</button>
    </form>
  );
}

export function RefillForm({ cylinderId }: { cylinderId: string }) {
  const [state, action, pending] = useActionState(logRefillAction, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="cylinderId" value={cylinderId} />
      <div><label className="label" htmlFor={`rf-d-${cylinderId}`}>Refilled on</label><input id={`rf-d-${cylinderId}`} name="filledAt" type="date" max={today()} defaultValue={today()} className="input" /></div>
      <div><label className="label" htmlFor={`rf-p-${cylinderId}`}>Paid, ₦</label><input id={`rf-p-${cylinderId}`} name="price" inputMode="decimal" className="input num w-28" placeholder="optional" /></div>
      <button className="btn-primary btn-sm" disabled={pending}>I refilled</button>
      <div className="w-full"><Status state={state} /></div>
    </form>
  );
}

/** Works out a month of petrol against CNG for the person's own vehicle, prices and conversion quote. */
export function CngCalculator({ petrol, cng }: { petrol: number | null; cng: number | null }) {
  const [vehicle, setVehicle] = useState<string>(VEHICLES[0].id);
  const v = VEHICLES.find((x) => x.id === vehicle)!;
  const [vals, setVals] = useState({ kmPerDay: String(v.kmPerDay), kmPerLitre: String(v.kmPerLitre), daysPerMonth: "26", petrolPrice: petrol ? String(Math.round(petrol)) : "", cngPrice: cng ? String(Math.round(cng)) : "", conversionCost: "" });
  const n = (s: string) => Number(s.replace(/[,₦\s]/g, ""));
  const ready = ["kmPerDay", "kmPerLitre", "daysPerMonth", "petrolPrice", "cngPrice"].every((k) => n(vals[k as keyof typeof vals]) > 0);
  const r = useMemo(() => (ready ? cngSavings({ kmPerDay: n(vals.kmPerDay), kmPerLitre: n(vals.kmPerLitre), daysPerMonth: n(vals.daysPerMonth), petrolPrice: n(vals.petrolPrice), cngPrice: n(vals.cngPrice), conversionCost: n(vals.conversionCost) || null }) : null), [vals, ready]);
  const field = (k: keyof typeof vals, label: string, hint?: string) => (
    <div>
      <label htmlFor={`cs-${k}`} className="label">{label}</label>
      <input id={`cs-${k}`} inputMode="decimal" className="input num" value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="card space-y-4">
        <div>
          <label htmlFor="cs-vehicle" className="label">Vehicle</label>
          <select id="cs-vehicle" className="input" value={vehicle} onChange={(e) => { const nv = VEHICLES.find((x) => x.id === e.target.value)!; setVehicle(nv.id); setVals({ ...vals, kmPerDay: String(nv.kmPerDay), kmPerLitre: String(nv.kmPerLitre) }); }}>
            {VEHICLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("kmPerDay", "Kilometres a day")}
          {field("daysPerMonth", "Working days a month")}
          {field("kmPerLitre", "Kilometres per litre of petrol", "Typical for this vehicle; change it if you know yours.")}
          {field("petrolPrice", "Petrol, ₦ per litre", petrol ? "Today's median where you are." : "Enter the pump price you pay.")}
          {field("cngPrice", "CNG, ₦ per scm", cng ? "Today's median where you are." : "Enter the price at your nearest CNG station.")}
          {field("conversionCost", "Conversion quote, ₦ (optional)", "From a certified conversion centre, to see how fast it pays back.")}
        </div>
      </div>
      <div className="card bg-ink-950 text-white" aria-live="polite">
        {r ? (
          <>
            <p className="text-sm text-ink-300">Each month you would spend</p>
            <dl className="mt-3 grid grid-cols-2 gap-4">
              <div><dt className="text-xs text-ink-300">On petrol</dt><dd className="num text-2xl font-semibold">{naira(r.petrolPerMonth)}</dd></div>
              <div><dt className="text-xs text-ink-300">On CNG</dt><dd className="num text-2xl font-semibold">{naira(r.cngPerMonth)}</dd></div>
            </dl>
            <p className="mt-6 text-sm text-ink-300">{r.savingPerMonth >= 0 ? "You could save" : "CNG would cost more by"}</p>
            <p className={`num text-4xl font-semibold ${r.savingPerMonth >= 0 ? "text-brand-300" : "text-amber-300"}`}>{naira(Math.abs(r.savingPerMonth))}<span className="text-base font-normal text-ink-300"> a month</span></p>
            {r.paybackMonths !== null && <p className="mt-3 text-sm">The conversion would pay for itself in about <strong className="num">{r.paybackMonths < 1 ? "less than a month" : `${Math.ceil(r.paybackMonths)} months`}</strong>.</p>}
            <p className="mt-6 text-xs leading-relaxed text-ink-300">Assumes 1 scm of CNG takes your vehicle about as far as 1 litre of petrol. Real figures depend on the engine, the kit and how you drive. Convert only at a certified centre.</p>
          </>
        ) : (
          <p className="text-sm text-ink-300">Fill in the prices to see your monthly saving.</p>
        )}
      </div>
    </div>
  );
}
