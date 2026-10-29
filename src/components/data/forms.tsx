"use client";
import { useActionState, useState } from "react";
import { buyDataPlanAction, createKeyAction, startTrialAction, type DataState } from "@/app/actions/data";
import { BILLING_COUNTRIES } from "@/lib/data-plans";
import { useIsNativeApp } from "../native/NativeBridge";
import { FieldError } from "../ui";

function Status({ state }: { state: DataState }) {
  return (
    <>
      <FieldError message={state.error} />
      {state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
    </>
  );
}

export function TrialForm() {
  const [state, action, pending] = useActionState(startTrialAction, {});
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="d-org" className="label">Organisation</label><input id="d-org" name="organisation" required minLength={2} className="input" placeholder="e.g. Atlantic Commodities Ltd" /></div>
        <div>
          <label htmlFor="d-country" className="label">Billing country</label>
          <select id="d-country" name="billingCountry" className="input" defaultValue="US">{BILLING_COUNTRIES.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
          <p className="hint">Customers billed in Nigeria pay in naira; everyone else pays in US dollars.</p>
        </div>
      </div>
      <Status state={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Starting…" : "Start 14-day free trial"}</button>
    </form>
  );
}

export function NewKeyForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(createKeyAction, {});
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div><label htmlFor="k-name" className="label">Key name</label><input id="k-name" name="name" className="input" placeholder="e.g. Pricing model" maxLength={60} /></div>
        <button className="btn-secondary btn-sm" disabled={pending || disabled}>Create API key</button>
      </form>
      {state.key && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">{state.ok}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input readOnly value={state.key} aria-label="New API key" className="input flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn-secondary btn-sm" onClick={async () => { await navigator.clipboard?.writeText(state.key!).catch(() => undefined); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
          </div>
        </div>
      )}
      {!state.key && <Status state={state} />}
    </div>
  );
}

/** Buy buttons for a plan. Hidden inside the store apps, where digital purchases must use the stores' own billing. */
export function BuyPlan({ plan, monthly, yearly, available }: { plan: string; monthly: string; yearly: string; available: boolean }) {
  const [state, action, pending] = useActionState(buyDataPlanAction, {});
  if (useIsNativeApp()) return <p className="text-xs text-ink-600">Plans are managed on the RefineryLens website, not in the app.</p>;
  if (!available) return <p className="text-xs text-ink-600">Online payment in this currency is not set up yet. Email us for an invoice.</p>;
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="plan" value={plan} />
      <div className="flex flex-wrap gap-2">
        <button name="period" value="month" className="btn-primary btn-sm" disabled={pending}>Pay {monthly} for 1 month</button>
        <button name="period" value="year" className="btn-secondary btn-sm" disabled={pending}>Pay {yearly} for 12 months</button>
      </div>
      <Status state={state} />
    </form>
  );
}
