"use client";
import { useActionState, useMemo, useState } from "react";
import { CALCULATORS, exampleInputs, type CalculatorId, type Field } from "@/lib/opportunities/calculators";
import type { SignalPoint } from "@/lib/opportunities/signals";
import { saveScenarioAction } from "@/app/actions/opportunities";
import { FieldError } from "../ui";

const fmt = (n: number, unit: string) => {
  const digits = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 1 ? 2 : 4;
  return `${n.toLocaleString("en-GB", { maximumFractionDigits: digits })} ${unit}`;
};

type Origin = "you" | "example" | { signal: SignalPoint };

export function SizingTool({ calculatorId, unit, opportunitySlug, signals, initial, initialName }: { calculatorId: CalculatorId; unit?: string; opportunitySlug?: string; signals: SignalPoint[]; initial?: Record<string, number | null>; initialName?: string }) {
  const calc = CALCULATORS[calculatorId];
  const fields = useMemo(() => calc.fields({ unit }), [calc, unit]);
  const bySignal = useMemo(() => new Map(signals.map((s) => [s.key, s])), [signals]);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, initial?.[f.key] != null ? String(initial[f.key]) : ""])));
  const [origin, setOrigin] = useState<Record<string, Origin>>({});
  const [state, action, pending] = useActionState(saveScenarioAction, {});

  const numbers = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, values[f.key]?.trim() === "" ? null : Number(values[f.key])])), [fields, values]);
  const result = calc.compute(numbers, { unit });
  const anyExample = Object.values(origin).some((o) => o === "example");
  const prefillable = fields.filter((f) => f.signal && bySignal.has(f.signal.key));

  const set = (f: Field, v: string, o: Origin = "you") => {
    setValues((s) => ({ ...s, [f.key]: v }));
    setOrigin((s) => ({ ...s, [f.key]: o }));
  };
  const fillExamples = () => {
    const ex = exampleInputs(calculatorId, { unit });
    const blanks = fields.filter((f) => !values[f.key]?.trim());
    setValues((s) => ({ ...s, ...Object.fromEntries(blanks.map((f) => [f.key, String(ex[f.key])])) }));
    setOrigin((s) => ({ ...s, ...Object.fromEntries(blanks.map((f) => [f.key, "example" as const])) }));
  };
  const fillSignals = () => {
    for (const f of prefillable) {
      const s = bySignal.get(f.signal!.key)!;
      const v = s.value * (f.signal!.factor ?? 1);
      set(f, String(Math.round(v * 1000) / 1000), { signal: s });
    }
  };
  const clear = () => {
    setValues(Object.fromEntries(fields.map((f) => [f.key, ""])));
    setOrigin({});
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={fillExamples}>Fill blanks with example numbers</button>
          {prefillable.length > 0 && <button type="button" className="btn-secondary btn-sm" onClick={fillSignals}>Use latest market data</button>}
          <button type="button" className="btn-ghost btn-sm" onClick={clear}>Clear</button>
        </div>
        {anyExample && (
          <p className="mb-3 rounded-lg border border-amber-600/25 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="note">
            Fields marked “example” hold round placeholder numbers that show how the tool works. They are not market prices, quotes or RefineryLens estimates. Replace them with your own figures.
          </p>
        )}
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {fields.map((f) => {
            const o = origin[f.key];
            const id = `f-${calculatorId}-${f.key}`;
            return (
              <div key={f.key}>
                <label htmlFor={id} className="label">
                  {f.label} <span className="font-normal text-ink-500">({f.unit}){f.optional ? ", optional" : ""}</span>
                </label>
                <input id={id} className="input num" inputMode="decimal" type="number" step="any" min={f.min} max={f.max} value={values[f.key] ?? ""} onChange={(e) => set(f, e.target.value)} />
                {o === "example" && <p className="hint text-amber-800">Example placeholder</p>}
                {o && typeof o === "object" && (
                  <p className="hint">
                    From {o.signal.label}, {o.signal.period}
                    {f.signal?.factor ? ` × ${f.signal.factor}` : ""}. <a href={o.signal.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{o.signal.attribution || o.signal.sourceName}</a>
                  </p>
                )}
                {f.help && !o && <p className="hint">{f.help}</p>}
              </div>
            );
          })}
        </div>
      </div>
      <aside aria-live="polite" className="lg:sticky lg:top-24 lg:self-start">
        <div className={`rounded-xl border p-4 ${result.ok ? "border-brand-600/30 bg-white shadow-card" : "border-dashed border-ink-300 bg-ink-50/60"}`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Calculated from your inputs</p>
          {result.ok ? (
            <>
              <p className="mt-1 text-sm font-medium">{result.headline.label}</p>
              <p data-testid="headline" className={`num mt-0.5 text-2xl font-semibold ${result.headline.value < 0 ? "text-risk-800" : "text-ink-950"}`}>{fmt(result.headline.value, result.headline.unit)}</p>
              <dl className="mt-3 space-y-2 text-sm">
                {result.lines.map((l) => (
                  <div key={l.label} className="border-t border-ink-100 pt-2">
                    <dt className="text-ink-700">{l.label}</dt>
                    <dd className="num font-medium">{fmt(l.value, l.unit)}</dd>
                    <dd className="text-xs text-ink-500"><span className="sr-only">Formula: </span>{l.formula}</dd>
                  </div>
                ))}
              </dl>
              <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-ink-700">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </>
          ) : (
            <p className="mt-1 text-sm"><span className="font-medium">Not calculated yet.</span> {result.reason}</p>
          )}
        </div>
        <form action={action} className="mt-3 rounded-xl border border-ink-100 bg-white p-4">
          <input type="hidden" name="calculatorId" value={calculatorId} />
          <input type="hidden" name="opportunitySlug" value={opportunitySlug ?? ""} />
          <input type="hidden" name="inputs" value={JSON.stringify(numbers)} />
          <label htmlFor={`name-${calculatorId}`} className="label">Save as a private scenario</label>
          <input id={`name-${calculatorId}`} name="name" className="input" required minLength={2} maxLength={120} defaultValue={initialName ?? ""} placeholder="e.g. Ikorodu station, cautious case" />
          <FieldError message={state.error} />
          {state.ok && <p className="mt-2 text-sm text-brand-800" role="status">{state.ok}</p>}
          <button className="btn-primary btn-sm mt-2" disabled={pending}>Save scenario</button>
        </form>
      </aside>
    </div>
  );
}
