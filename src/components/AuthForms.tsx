"use client";
import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";
import { FieldError } from "./ui";

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

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, {});
  return (
    <form action={action} className="space-y-4">
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
      <FieldError message={state.error} />
      <p className="text-xs text-ink-600">By creating an account you agree to how we handle your data in the <a href="/privacy">privacy policy</a>.</p>
      <button className="btn-primary w-full py-2.5" disabled={pending}>{pending ? "Creating account…" : "Create free account"}</button>
    </form>
  );
}
