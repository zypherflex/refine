"use client";
import { useActionState } from "react";
import { changePasswordAction, saveTextSettingsAction, startCheckoutAction, updateProfileAction } from "@/app/actions/settings";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { FieldError } from "./ui";

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

export function CheckoutButton({ label }: { label: string }) {
  const [s, a, p] = useActionState(startCheckoutAction, {});
  return (
    <form action={a} className="mt-4">
      <button className="btn-primary w-full" disabled={p}>{p ? "Opening secure payment…" : label}</button>
      <FieldError message={s.error} />
    </form>
  );
}
