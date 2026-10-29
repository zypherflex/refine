"use client";
import { useActionState } from "react";
import type { AdminState } from "@/app/actions/admin-tools";
import { FieldError } from "../ui";

type Action = (s: AdminState, f: FormData) => Promise<AdminState>;

function Status({ state }: { state: AdminState }) {
  return (
    <>
      <FieldError message={state.error} />
      {state.ok && <p className="text-xs text-brand-800" role="status">{state.ok}</p>}
    </>
  );
}

/** A destructive admin tool behind a disclosure, asking for the reason the affected people will be told. */
export function ReasonAction({ action, id, label, placeholder }: { action: Action; id: string; label: string; placeholder: string }) {
  const [state, run, pending] = useActionState(action, {});
  if (state.ok) return <p className="text-xs text-brand-800" role="status">{state.ok}</p>;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-risk-700">{label}</summary>
      <form action={run} className="mt-2 flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={id} />
        <label className="sr-only" htmlFor={`why-${id}`}>Reason</label>
        <input id={`why-${id}`} name="reason" required minLength={5} maxLength={500} placeholder={placeholder} className="input w-64 py-1 text-xs" />
        <button className="btn-danger btn-sm" disabled={pending}>Confirm</button>
        <div className="w-full"><Status state={state} /></div>
      </form>
    </details>
  );
}

/** Generic admin form with inline status, for edits and merges. */
export function AdminForm({ action, children, submit, className = "" }: { action: Action; children: React.ReactNode; submit: string; className?: string }) {
  const [state, run, pending] = useActionState(action, {});
  return (
    <form action={run} className={className}>
      {children}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="btn-secondary btn-sm" disabled={pending}>{submit}</button>
        <Status state={state} />
      </div>
    </form>
  );
}
