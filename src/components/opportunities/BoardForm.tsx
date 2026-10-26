"use client";
import { useActionState } from "react";
import { saveBoardAction } from "@/app/actions/opportunities";
import { FieldError } from "../ui";
import { STAGES } from "@/lib/opportunities/catalog";


export function BoardForm({ slug, item }: { slug: string; item: { stage: string; notes: string; nextStep: string } | null }) {
  const [state, action, pending] = useActionState(saveBoardAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <div>
        <label htmlFor={`stage-${slug}`} className="label">Stage</label>
        <select id={`stage-${slug}`} name="stage" className="input" defaultValue={item?.stage ?? "EXPLORING"}>
          {STAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor={`next-${slug}`} className="label">Next step</label>
        <input id={`next-${slug}`} name="nextStep" className="input" maxLength={300} defaultValue={item?.nextStep ?? ""} placeholder="e.g. Ask two depots for written quotes" />
      </div>
      <div>
        <label htmlFor={`notes-${slug}`} className="label">Private notes</label>
        <textarea id={`notes-${slug}`} name="notes" className="input min-h-24" maxLength={4000} defaultValue={item?.notes ?? ""} />
      </div>
      <FieldError message={state.error} />
      {state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
      <button className="btn-primary btn-sm" disabled={pending}>{item ? "Update board" : "Add to my board"}</button>
    </form>
  );
}
