"use client";
import { useActionState } from "react";
import { metricAction, saveDraftAction, workflowAction, type EdState } from "@/app/actions/editorial";
import { FieldError } from "./ui";

type Opt = { id: string; name: string };
export type AnnouncementDefaults = Partial<Record<string, string | boolean | string[] | { quote: string; documentId: string; page: string }[]>>;

function Result({ s }: { s: EdState }) {
  return (
    <>
      <FieldError message={s.error} />
      {s.ok && <p className="mt-2 rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800" role="status">{s.ok}</p>}
    </>
  );
}

export function AnnouncementForm({ d, companies, entities, sources, documents, docTypes, provenances, topics }: { d: AnnouncementDefaults; companies: Opt[]; entities: (Opt & { companyId: string })[]; sources: (Opt & { approved: boolean })[]; documents: Opt[]; docTypes: [string, string][]; provenances: [string, string][]; topics: [string, string][] }) {
  const [state, action, pending] = useActionState(saveDraftAction, {});
  const v = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const excerpts = (d.excerpts as { quote: string; documentId: string; page: string }[] | undefined) ?? [];
  const field = (name: string, label: string, opts: { area?: boolean; required?: boolean; hint?: string; type?: string } = {}) => (
    <div className={opts.area ? "sm:col-span-2" : ""}>
      <label htmlFor={name} className="label">{label}{opts.required && <span className="text-risk-700"> *</span>}</label>
      {opts.area ? <textarea id={name} name={name} defaultValue={v(name)} required={opts.required} className="input min-h-20" /> : <input id={name} name={name} type={opts.type ?? "text"} defaultValue={v(name)} required={opts.required} className="input" />}
      {opts.hint && <p className="hint">{opts.hint}</p>}
    </div>
  );
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={v("id")} />
      <input type="hidden" name="supersedesId" value={v("supersedesId")} />
      <fieldset className="card grid gap-4 sm:grid-cols-2">
        <legend className="h-section">Source record</legend>
        <div><label htmlFor="companyId" className="label">Company *</label><select id="companyId" name="companyId" defaultValue={v("companyId")} className="input">{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="legalEntityId" className="label">Legal entity</label><select id="legalEntityId" name="legalEntityId" defaultValue={v("legalEntityId")} className="input"><option value="">Not specified</option>{entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
        <div><label htmlFor="sourceId" className="label">Source</label><select id="sourceId" name="sourceId" defaultValue={v("sourceId")} className="input"><option value="">None</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}{s.approved ? "" : " (not yet approved)"}</option>)}</select></div>
        <div><label htmlFor="provenance" className="label">Provenance *</label><select id="provenance" name="provenance" defaultValue={v("provenance") || "COMPANY_DISCLOSED"} className="input">{provenances.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {field("originalTitle", "Original title", { required: true })}
        {field("publisher", "Publisher", { required: true })}
        {field("sourceUrl", "Original URL", { required: true, type: "url" })}
        <div><label htmlFor="documentType" className="label">Document type *</label><select id="documentType" name="documentType" defaultValue={v("documentType") || "PRESS_RELEASE"} className="input">{docTypes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        {field("sourcePublishedAt", "Source publication date", { required: true, type: "date" })}
        {field("eventDate", "Event date", { type: "date" })}
        {field("sourceVersion", "Source version")}
        <div className="flex flex-col justify-end gap-1 text-sm">
          <label><input type="checkbox" name="aiGenerated" defaultChecked={d.aiGenerated === true} className="mr-1" />Summary drafted with AI</label>
          <label><input type="checkbox" name="isFictional" defaultChecked={d.isFictional === true} className="mr-1" />Fictional demonstration content</label>
        </div>
      </fieldset>
      <fieldset className="card grid gap-4 sm:grid-cols-2">
        <legend className="h-section">Analysis</legend>
        <div className="sm:col-span-2">{field("headline", "Headline", { required: true })}</div>
        {field("summary", "Concise summary", { area: true, required: true, hint: "Facts only. Plain language." })}
        {field("whatChanged", "What changed", { area: true })}
        {field("whyItMatters", "Why it could matter to investors", { area: true, required: true, hint: "Interpretation. Never a recommendation." })}
        {field("uncertainties", "Important uncertainties", { area: true, required: true })}
        {field("alternativeExplanations", "Alternative explanations", { area: true })}
        {field("openQuestions", "Questions to investigate next", { area: true })}
        {field("analysis", "Full analysis", { area: true })}
        <fieldset className="sm:col-span-2"><legend className="label">Topics</legend><div className="flex flex-wrap gap-x-4 gap-y-1">{topics.map(([k, l]) => <label key={k} className="text-sm"><input type="checkbox" name="topics" value={k} defaultChecked={(d.topics as string[] | undefined)?.includes(k)} className="mr-1" />{l}</label>)}</div></fieldset>
      </fieldset>
      <fieldset className="card space-y-3">
        <legend className="h-section">Supporting excerpts</legend>
        <p className="hint">At least one excerpt or page reference is required before publication.</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-6">
            <div className="sm:col-span-3"><label htmlFor={`ex_quote_${i}`} className="label">Excerpt {i + 1}</label><textarea id={`ex_quote_${i}`} name={`ex_quote_${i}`} defaultValue={excerpts[i]?.quote} className="input min-h-14" /></div>
            <div className="sm:col-span-2"><label htmlFor={`ex_doc_${i}`} className="label">Document</label><select id={`ex_doc_${i}`} name={`ex_doc_${i}`} defaultValue={excerpts[i]?.documentId ?? ""} className="input"><option value="">No stored document</option>{documents.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <div><label htmlFor={`ex_page_${i}`} className="label">Page</label><input id={`ex_page_${i}`} name={`ex_page_${i}`} type="number" min={1} defaultValue={excerpts[i]?.page} className="input" /></div>
          </div>
        ))}
      </fieldset>
      <Result s={state} />
      <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save draft"}</button>
      <p className="hint">Saving returns the item to draft. It must be reviewed again before publication.</p>
    </form>
  );
}

export function WorkflowButton({ id, op, label, tone = "primary", fields }: { id: string; op: string; label: string; tone?: "primary" | "secondary" | "danger"; fields?: React.ReactNode }) {
  const [state, action, pending] = useActionState(workflowAction, {});
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      {fields}
      <button className={tone === "danger" ? "btn-danger" : tone === "secondary" ? "btn-secondary" : "btn-primary"} disabled={pending}>{label}</button>
      <Result s={state} />
    </form>
  );
}

export function CorrectionForm({ id, d }: { id: string; d: Record<string, string> }) {
  const [state, action, pending] = useActionState(workflowAction, {});
  const area = (k: string, l: string) => (<div><label htmlFor={`c-${k}`} className="label">{l}</label><textarea id={`c-${k}`} name={k} defaultValue={d[k]} className="input min-h-16" /></div>);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value="correct" />
      <div><label htmlFor="c-headline" className="label">Headline</label><input id="c-headline" name="headline" defaultValue={d.headline} className="input" /></div>
      {area("summary", "Summary")}
      {area("whatChanged", "What changed")}
      {area("whyItMatters", "Why it could matter")}
      {area("uncertainties", "Uncertainties")}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor="c-eventDate" className="label">Event date</label><input id="c-eventDate" name="eventDate" type="date" defaultValue={d.eventDate} className="input" /></div>
        <div><label htmlFor="c-sourcePublishedAt" className="label">Source publication date</label><input id="c-sourcePublishedAt" name="sourcePublishedAt" type="date" defaultValue={d.sourcePublishedAt} className="input" /></div>
      </div>
      <div><label htmlFor="c-sum" className="label">Correction note (shown publicly) *</label><input id="c-sum" name="correctionSummary" required minLength={10} className="input" placeholder="What was wrong and what it now says" /></div>
      <Result s={state} />
      <button className="btn-primary" disabled={pending}>Publish correction</button>
    </form>
  );
}

export function MetricReviewForm({ m }: { m: { id: string; label: string; value: string; periodLabel: string; periodType: string; scope: string; auditStatus: string; page: string; currency: string; scale: string; periodStart: string; periodEnd: string; status: string } }) {
  const [state, action, pending] = useActionState(metricAction, {});
  const [pState, pAction, pPending] = useActionState(metricAction, {});
  return (
    <div className="rounded-md border border-navy-100 p-3">
      <form action={action} className="grid gap-2 sm:grid-cols-4">
        <input type="hidden" name="id" value={m.id} />
        <input type="hidden" name="op" value="correct" />
        <p className="font-medium sm:col-span-4">{m.label} <span className="text-xs text-navy-700">({m.status.toLowerCase()})</span></p>
        <div><label className="label" htmlFor={`v-${m.id}`}>Value</label><input id={`v-${m.id}`} name="value" type="number" step="any" defaultValue={m.value} className="input" /></div>
        <div><label className="label" htmlFor={`cur-${m.id}`}>Currency</label><input id={`cur-${m.id}`} name="currency" defaultValue={m.currency} className="input" /></div>
        <div><label className="label" htmlFor={`sc-${m.id}`}>Scale</label><select id={`sc-${m.id}`} name="scale" defaultValue={m.scale} className="input"><option value="units">units</option><option value="thousands">thousands</option><option value="millions">millions</option><option value="billions">billions</option></select></div>
        <div><label className="label" htmlFor={`pg-${m.id}`}>Page</label><input id={`pg-${m.id}`} name="page" type="number" min={1} defaultValue={m.page} className="input" /></div>
        <div><label className="label" htmlFor={`pl-${m.id}`}>Period label</label><input id={`pl-${m.id}`} name="periodLabel" defaultValue={m.periodLabel} className="input" /></div>
        <div><label className="label" htmlFor={`pt-${m.id}`}>Period type</label><select id={`pt-${m.id}`} name="periodType" defaultValue={m.periodType} className="input">{["UNKNOWN", "FY", "H1", "H2", "Q1", "Q2", "Q3", "Q4", "9M", "MONTH", "POINT", "EVENT"].map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="label" htmlFor={`ps-${m.id}`}>Period start</label><input id={`ps-${m.id}`} name="periodStart" type="date" defaultValue={m.periodStart} className="input" /></div>
        <div><label className="label" htmlFor={`pe-${m.id}`}>Period end</label><input id={`pe-${m.id}`} name="periodEnd" type="date" defaultValue={m.periodEnd} className="input" /></div>
        <div><label className="label" htmlFor={`s-${m.id}`}>Scope</label><select id={`s-${m.id}`} name="scope" defaultValue={m.scope} className="input"><option value="GROUP">Group</option><option value="REFINERY">Refinery</option><option value="SUBSIDIARY">Subsidiary</option><option value="NATIONAL_SECTOR">National sector</option></select></div>
        <div><label className="label" htmlFor={`a-${m.id}`}>Audit status</label><select id={`a-${m.id}`} name="auditStatus" defaultValue={m.auditStatus} className="input"><option value="AUDITED">Audited</option><option value="UNAUDITED">Unaudited</option><option value="RESTATED">Restated</option><option value="NOT_APPLICABLE">Not applicable</option></select></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`n-${m.id}`}>Change note *</label><input id={`n-${m.id}`} name="summary" className="input" placeholder="e.g. Fixed period and scale from page 1" /></div>
        <div className="sm:col-span-4"><Result s={state} /><button className="btn-secondary" disabled={pending}>Save extraction fix</button></div>
      </form>
      {m.status === "DRAFT" && (
        <form action={pAction} className="mt-2 flex flex-wrap gap-2">
          <input type="hidden" name="id" value={m.id} />
          <button name="op" value="publish" className="btn-primary btn-sm" disabled={pPending}>Publish figure</button>
          <button name="op" value="reject" className="btn btn-sm text-risk-700" disabled={pPending}>Discard</button>
          <div className="w-full"><Result s={pState} /></div>
        </form>
      )}
    </div>
  );
}
