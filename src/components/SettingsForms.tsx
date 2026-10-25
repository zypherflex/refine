"use client";
import { useActionState } from "react";
import { changePasswordAction, updateProfileAction } from "@/app/actions/settings";
import { FieldError } from "./ui";

export function ProfileForm({ name }: { name: string }) {
  const [s, a, p] = useActionState(updateProfileAction, {});
  return (
    <form action={a} className="flex flex-wrap items-end gap-2">
      <div className="flex-1"><label className="label" htmlFor="name">Name</label><input id="name" name="name" defaultValue={name} className="input" /></div>
      <button className="btn-primary" disabled={p}>Save</button>
      <div className="w-full"><FieldError message={s.error} />{s.ok && <p className="text-sm text-teal-800" role="status">{s.ok}</p>}</div>
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
