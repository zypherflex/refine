"use client";
import { useActionState } from "react";
import { createApiKeyAction, type KeyState } from "@/app/actions/hub";
import { FieldError } from "../ui";

/** Creates a key and shows it once, with a copy button. */
export function ApiKeyForm() {
  const [state, run, pending] = useActionState<KeyState, FormData>(createApiKeyAction, {});
  return (
    <form action={run} className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div><label htmlFor="key-name" className="label">Key name</label><input id="key-name" name="name" className="input" placeholder="Credit team" maxLength={60} required /></div>
        <button className="btn-primary btn-sm" disabled={pending}>{pending ? "Working…" : "Create key"}</button>
      </div>
      <FieldError message={state.error} />
      {state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
      {state.key && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-50 p-3">
          <code className="num break-all text-sm" data-testid="new-api-key">{state.key}</code>
          <button type="button" className="btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(state.key!)}>Copy</button>
        </div>
      )}
    </form>
  );
}
