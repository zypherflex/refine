"use client";
import { useActionState } from "react";
import { saveProfileAction } from "@/app/actions/opportunities";
import { ASSETS, SCALES, SEGMENTS } from "@/lib/opportunities/catalog";
import { FieldError } from "../ui";

export function FitForm({ profile }: { profile: { scale: string; segments: string[]; assets: string[] } | null }) {
  const [state, action, pending] = useActionState(saveProfileAction, {});
  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="h-section">1. How big is your business?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SCALES.map((s) => (
            <label key={s.id} className="flex cursor-pointer gap-2 rounded-xl border border-ink-100 bg-white p-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="radio" name="scale" value={s.id} defaultChecked={profile?.scale === s.id} required className="mt-1" />
              <span><span className="block font-semibold">{s.label}</span><span className="block text-xs text-ink-600">{s.who}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="h-section">2. Which areas interest you?</legend>
        <p className="muted">Optional. Pick any.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SEGMENTS.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="checkbox" name="segments" value={s.id} defaultChecked={profile?.segments.includes(s.id)} /> {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="h-section">3. What do you already have?</legend>
        <p className="muted">Optional. Existing assets give you a head start in some opportunities.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ASSETS.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-100 bg-white px-3 py-2 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="checkbox" name="assets" value={a.id} defaultChecked={profile?.assets.includes(a.id)} /> {a.label}
            </label>
          ))}
        </div>
      </fieldset>
      <FieldError message={state.error} />
      <button className="btn-primary" disabled={pending}>Show my matches</button>
    </form>
  );
}
