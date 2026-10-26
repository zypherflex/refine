"use client";
import { useActionState, useState } from "react";
import { linkEvidenceAction, saveThesisAction } from "@/app/actions/thesis";
import { FieldError } from "./ui";

type Topic = { value: string; label: string };

export function LinkEvidenceForm({ announcementId, theses }: { announcementId: string; theses: { id: string; title: string; assumptions: { id: string; statement: string }[] }[] }) {
  const [state, action, pending] = useActionState(linkEvidenceAction, {});
  return (
    <form action={action} className="mt-2 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="announcementId" value={announcementId} />
      <div className="sm:col-span-2">
        <label htmlFor="target" className="label">Assumption</label>
        <select id="target" name="target" className="input" required>
          {theses.map((t) => (
            <optgroup key={t.id} label={t.title}>
              <option value={`${t.id}:`}>Whole thesis</option>
              {t.assumptions.map((a) => <option key={a.id} value={`${t.id}:${a.id}`}>{a.statement}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="stance" className="label">This evidence…</label>
        <select id="stance" name="stance" className="input">
          <option value="SUPPORTS">may support the assumption</option>
          <option value="CHALLENGES">may challenge the assumption</option>
          <option value="UNCLEAR">is relevant but unclear</option>
        </select>
      </div>
      <div>
        <label htmlFor="note" className="label">Your note (optional)</label>
        <input id="note" name="note" className="input" maxLength={1000} />
      </div>
      <div className="sm:col-span-2">
        <FieldError message={state.error} />
        {state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
        <button className="btn-primary mt-1" disabled={pending}>Add as evidence</button>
      </div>
    </form>
  );
}

type Initial = {
  id?: string;
  companyId: string;
  title: string;
  rationale: string;
  reassessmentConditions: string;
  reviewDate: string;
  assumptions: { statement: string; topics: string[] }[];
  indicators: { metricKey: string; label: string; operator: "BELOW" | "ABOVE"; threshold: number | null; unit: string }[];
};

export function ThesisEditor({ initial, companies, topics, metricOptions }: { initial: Initial; companies: { id: string; name: string }[]; topics: Topic[]; metricOptions: { key: string; label: string; unit: string }[] }) {
  const [state, action, pending] = useActionState(saveThesisAction, {});
  const [t, setT] = useState(initial);
  const [note, setNote] = useState("");
  const payload = JSON.stringify({
    companyId: t.companyId,
    title: t.title,
    rationale: t.rationale,
    reassessmentConditions: t.reassessmentConditions,
    reviewDate: t.reviewDate || null,
    assumptions: t.assumptions.filter((a) => a.statement.trim()),
    indicators: t.indicators.filter((i) => i.metricKey),
    versionNote: note,
  });
  const upd = (patch: Partial<Initial>) => setT({ ...t, ...patch });
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="id" value={t.id ?? ""} />
      <input type="hidden" name="payload" value={payload} />
      <div className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="title">Thesis title</label>
            <input id="title" className="input" value={t.title} onChange={(e) => upd({ title: e.target.value })} required minLength={3} />
          </div>
          <div>
            <label className="label" htmlFor="company">Company</label>
            <select id="company" className="input" value={t.companyId} onChange={(e) => upd({ companyId: e.target.value })}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="rationale">Investment rationale</label>
          <textarea id="rationale" className="input min-h-28" value={t.rationale} onChange={(e) => upd({ rationale: e.target.value })} required minLength={10} />
          <p className="hint">In your own words: why might this be a good or bad investment?</p>
        </div>
      </div>

      <fieldset className="card">
        <legend className="h-section">Key assumptions</legend>
        <p className="hint">Tag each assumption with topics. When a published disclosure covers those topics, RefineryLens suggests it for your review. It never edits your thesis.</p>
        <div className="mt-3 space-y-4">
          {t.assumptions.map((a, i) => (
            <div key={i} className="rounded-md border border-ink-100 p-3">
              <label className="label" htmlFor={`as-${i}`}>Assumption {i + 1}</label>
              <input id={`as-${i}`} className="input" value={a.statement} placeholder="e.g. Improved utilization should support operating cash flow." onChange={(e) => upd({ assumptions: t.assumptions.map((x, j) => (j === i ? { ...x, statement: e.target.value } : x)) })} />
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`Topics for assumption ${i + 1}`}>
                {topics.map((tp) => (
                  <label key={tp.value} className={`cursor-pointer rounded-full border px-2 py-0.5 text-xs ${a.topics.includes(tp.value) ? "border-brand-700 bg-brand-50 text-brand-800" : "border-ink-100"}`}>
                    <input type="checkbox" className="sr-only" checked={a.topics.includes(tp.value)} onChange={(e) => upd({ assumptions: t.assumptions.map((x, j) => (j === i ? { ...x, topics: e.target.checked ? [...x.topics, tp.value] : x.topics.filter((y) => y !== tp.value) } : x)) })} />
                    {tp.label}
                  </label>
                ))}
              </div>
              <button type="button" className="mt-2 text-xs text-risk-700" onClick={() => upd({ assumptions: t.assumptions.filter((_, j) => j !== i) })}>Remove assumption</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary mt-3" onClick={() => upd({ assumptions: [...t.assumptions, { statement: "", topics: [] }] })}>Add assumption</button>
      </fieldset>

      <fieldset className="card">
        <legend className="h-section">Indicators and thresholds</legend>
        <p className="hint">Choose disclosed metrics to monitor and the level that would concern you. Thresholds are compared only with published, disclosed figures.</p>
        <div className="mt-3 space-y-3">
          {t.indicators.map((ind, i) => (
            <div key={i} className="grid gap-2 rounded-md border border-ink-100 p-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="label" htmlFor={`ind-${i}`}>Metric</label>
                <select id={`ind-${i}`} className="input" value={ind.metricKey} onChange={(e) => { const m = metricOptions.find((x) => x.key === e.target.value); upd({ indicators: t.indicators.map((x, j) => (j === i ? { ...x, metricKey: e.target.value, label: m?.label ?? "", unit: m?.unit ?? "" } : x)) }); }}>
                  <option value="">Choose…</option>
                  {metricOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`op-${i}`}>Alert if</label>
                <select id={`op-${i}`} className="input" value={ind.operator} onChange={(e) => upd({ indicators: t.indicators.map((x, j) => (j === i ? { ...x, operator: e.target.value as "BELOW" | "ABOVE" } : x)) })}>
                  <option value="BELOW">falls below</option>
                  <option value="ABOVE">rises above</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor={`th-${i}`}>Threshold {ind.unit && `(${ind.unit})`}</label>
                <input id={`th-${i}`} className="input" type="number" step="any" value={ind.threshold ?? ""} onChange={(e) => upd({ indicators: t.indicators.map((x, j) => (j === i ? { ...x, threshold: e.target.value === "" ? null : Number(e.target.value) } : x)) })} />
              </div>
              <button type="button" className="text-left text-xs text-risk-700 sm:col-span-4" onClick={() => upd({ indicators: t.indicators.filter((_, j) => j !== i) })}>Remove indicator</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-secondary mt-3" onClick={() => upd({ indicators: [...t.indicators, { metricKey: "", label: "", operator: "BELOW", threshold: null, unit: "" }] })}>Add indicator</button>
      </fieldset>

      <div className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="reassess">Conditions that would cause you to reassess</label>
          <textarea id="reassess" className="input min-h-20" value={t.reassessmentConditions} onChange={(e) => upd({ reassessmentConditions: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="review">Review date</label>
          <input id="review" type="date" className="input" value={t.reviewDate} onChange={(e) => upd({ reviewDate: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="vnote">What changed in this version? (optional)</label>
          <input id="vnote" className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </div>
      </div>
      <FieldError message={state.error} />
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : t.id ? "Save new version" : "Save thesis"}</button>
        <p className="self-center text-xs text-ink-700">Your thesis is private. Only you can see it.</p>
      </div>
    </form>
  );
}
