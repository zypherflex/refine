"use client";
import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";
import { FieldError } from "./ui";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      <FieldError message={state.error} />
      <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function RegisterForm({ next, audience = "PERSONAL" }: { next?: string; audience?: "PERSONAL" | "BUSINESS" }) {
  const [state, action, pending] = useActionState(registerAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <fieldset>
        <legend className="label">I am signing up for</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["PERSONAL", "Me and my home", "Prices near me, gas refills, my car"], ["BUSINESS", "My business", "Buy, sell or deliver fuel and gas"]] as const).map(([v, t, d]) => (
            <label key={v} className="flex cursor-pointer flex-col rounded-xl border border-ink-200 p-3 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <span className="flex items-center gap-2 font-medium"><input type="radio" name="audience" value={v} defaultChecked={v === audience} />{t}</span>
              <span className="mt-1 text-xs text-ink-600">{d}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="name" className="label">Name</label>
        <input id="name" name="name" autoComplete="name" required minLength={2} className="input" />
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} className="input" aria-describedby="pw-hint" />
        <p id="pw-hint" className="hint">At least 10 characters.</p>
      </div>
      <div>
        <label htmlFor="homeState" className="label">Your state</label>
        <select id="homeState" name="homeState" className="input" defaultValue="">
          <option value="">Choose later</option>
          {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <p className="hint">So we show prices where you are first.</p>
      </div>
      <FieldError message={state.error} />
      <p className="text-xs text-ink-600">By creating an account you agree to how we handle your data in the <a href="/privacy">privacy policy</a>.</p>
      <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? "Creating account…" : "Create free account"}</button>
    </form>
  );
}
