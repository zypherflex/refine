"use client";
import { useActionState } from "react";
import type { HubState } from "@/app/actions/hub";
import { FieldError } from "../ui";

/** A form bound to one trade hub server action, showing its error or confirmation inline. */
export function HubForm({ action, submit, children, className = "space-y-3", buttonClass = "btn-primary btn-sm", inline = false }: {
  action: (s: HubState, f: FormData) => Promise<HubState>;
  submit: string;
  children?: React.ReactNode;
  className?: string;
  buttonClass?: string;
  inline?: boolean;
}) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className={inline ? "inline" : className}>
      {children}
      {!inline && <FieldError message={state.error} />}
      {!inline && state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
      <button className={buttonClass} disabled={pending}>{pending ? "Working…" : submit}</button>
      {inline && state.error && <span className="ml-2 text-xs text-risk-700" role="alert">{state.error}</span>}
      {inline && state.ok && <span className="ml-2 text-xs text-brand-800" role="status">{state.ok}</span>}
    </form>
  );
}
