"use client";
import { useActionState } from "react";
import { changePasswordAction, deleteAccountAction, saveTextSettingsAction, startCheckoutAction, updateProfileAction } from "@/app/actions/settings";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { FieldError } from "./ui";
import { useIsNativeApp } from "./native/NativeBridge";

export function ProfileForm({ name }: { name: string }) {
  const [s, a, p] = useActionState(updateProfileAction, {});
  return (
    <form action={a} className="flex flex-wrap items-end gap-2">
      <div className="flex-1"><label className="label" htmlFor="name">Name</label><input id="name" name="name" defaultValue={name} className="input" /></div>
      <button className="btn-primary" disabled={p}>Save</button>
      <div className="w-full"><FieldError message={s.error} />{s.ok && <p className="text-sm text-brand-800" role="status">{s.ok}</p>}</div>
    </form>
  );
}

export function PasswordForm() {
  const [s, a, p] = useActionState(changePasswordAction, {});
  return (
    <form action={a} className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" className="input" required /></div>
      <div><label className="label" htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={10} className="input" required /></div>
      <div className="sm:col-span-2"><FieldError message={s.error} /><button className="btn-secondary" disabled={p}>Change password</button><p className="hint">Changing your password signs you out everywhere.</p></div>
    </form>
  );
}

export function TextSettingsForm({ phone, textAlerts, priceDigest, digestState, provider }: { phone: string; textAlerts: boolean; priceDigest: boolean; digestState: string; provider: string | null }) {
  const [s, a, p] = useActionState(saveTextSettingsAction, {});
  const off = !provider;
  return (
    <form action={a} className="space-y-3">
      <div><label className="label" htmlFor="phone">Phone number</label><input id="phone" name="phone" defaultValue={phone} className="input" inputMode="tel" placeholder="0803 123 4567" autoComplete="tel" /></div>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="textAlerts" value="1" defaultChecked={textAlerts} disabled={off} className="mt-1" /><span>Text me trade hub alerts: new messages, quotes, deliveries to confirm and verification results</span></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="priceDigest" value="1" defaultChecked={priceDigest} disabled={off} className="mt-1" /><span>Send me a morning price digest for my state</span></label>
      <div className="sm:w-64"><label className="label" htmlFor="digestState">Digest state</label><select id="digestState" name="digestState" className="input" defaultValue={digestState} disabled={off}><option value="">Choose…</option>{NIGERIAN_STATES.map((st) => <option key={st}>{st}</option>)}</select></div>
      <FieldError message={s.error} />
      {s.ok && <p className="text-sm text-brand-800" role="status">{s.ok}</p>}
      <button className="btn-primary" disabled={p}>Save</button>
    </form>
  );
}

export function CheckoutButton({ label, currency = "NGN", secondary = false }: { label: string; currency?: "NGN" | "USD"; secondary?: boolean }) {
  const [s, a, p] = useActionState(startCheckoutAction, {});
  // App store rules require their own billing for in-app purchases, so plans are bought on the website only.
  if (useIsNativeApp()) return <div className="mt-4"><p className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-700">Plans are managed on the RefineryLens website, not in the app.</p></div>;
  return (
    <form action={a} className="mt-4">
      <input type="hidden" name="currency" value={currency} />
      <button className={`${secondary ? "btn-secondary" : "btn-primary"} w-full`} disabled={p}>{p ? "Opening secure payment…" : label}</button>
      <FieldError message={s.error} />
    </form>
  );
}

/** Account deletion, required by both app stores. Asks for the password and the word DELETE. */
export function DeleteAccountForm() {
  const [s, a, p] = useActionState(deleteAccountAction, {});
  return (
    <details className="rounded-2xl border border-risk-600/20 bg-white p-4">
      <summary className="font-semibold text-risk-800">Delete my account</summary>
      <form action={a} className="mt-3 space-y-3">
        <p className="text-sm text-ink-700">This permanently deletes your account, private files, theses, alerts, your trade hub business with its listings, sites, prices, jobs, agreements and messages, and the phones registered for notifications. It cannot be undone. Payment records held by Paystack are kept by Paystack under its own rules.</p>
        <div><label className="label" htmlFor="del-password">Password</label><input id="del-password" name="password" type="password" className="input" required autoComplete="current-password" /></div>
        <div><label className="label" htmlFor="del-confirm">Type DELETE to confirm</label><input id="del-confirm" name="confirm" className="input" required autoComplete="off" /></div>
        <FieldError message={s.error} />
        <button className="btn-danger" disabled={p}>{p ? "Deleting…" : "Delete my account permanently"}</button>
      </form>
    </details>
  );
}
