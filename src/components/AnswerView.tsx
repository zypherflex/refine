import Link from "next/link";
import type { StructuredAnswer } from "@/server/assistant/types";
import { fmtDate, fmtNumber } from "@/lib/format";
import { Notice, Pill } from "./ui";

const kindStyle = { FACT: "bg-navy-100 text-navy-900", CALCULATION: "bg-teal-100 text-teal-800", ESTIMATE: "bg-amber-100 text-amber-800", INTERPRETATION: "bg-white text-navy-800 ring-1 ring-inset ring-navy-600/30" } as const;
const kindLabel = { FACT: "Fact (disclosed)", CALCULATION: "Calculation", ESTIMATE: "Estimate", INTERPRETATION: "Interpretation" } as const;
const scopeLabel = { COMPANY_SPECIFIC: "Company-specific answer", GENERAL: "General explanation", MIXED: "General explanation and company evidence" } as const;

function Refs({ refs, a }: { refs: string[]; a: StructuredAnswer }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-baseline">
      {refs.map((r) => {
        const s = a.sources.find((x) => x.ref === r);
        const c = a.calculations.find((x) => x.ref === r);
        if (s) return <Link key={r} href={s.link} className="rounded bg-teal-50 px-1 text-xs font-semibold no-underline ring-1 ring-teal-600/40" title={s.label}>[{r}]</Link>;
        if (c) return <a key={r} href={`#calc-${r}`} className="rounded bg-teal-50 px-1 text-xs font-semibold no-underline ring-1 ring-teal-600/40">[{r}]</a>;
        return null;
      })}
    </span>
  );
}

export function AnswerView({ a }: { a: StructuredAnswer }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Pill className="bg-navy-900 text-white">{scopeLabel[a.scope]}</Pill>
        <span className="text-navy-700">Information cut-off: {a.cutoff ? fmtDate(a.cutoff) : "no reviewed sources"}</span>
        <span className="text-navy-700">· {a.mode === "llm" ? "Language model, evidence-grounded" : "Evidence mode"}</span>
      </div>
      {a.insufficientEvidence && <Notice tone="warn" title="Insufficient evidence">The available reviewed evidence does not fully answer this question. Nothing has been guessed.</Notice>}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700">Direct answer</h3>
        <p className="mt-1">{a.directAnswer}</p>
      </section>
      {a.generalExplanation && (
        <section className="rounded-md border border-navy-100 bg-navy-50 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700">General explanation (not specific to this company)</h3>
          <p className="mt-1 text-sm">{a.generalExplanation}</p>
        </section>
      )}
      {a.evidence.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700">Supporting evidence</h3>
          <ul className="mt-1 space-y-2">
            {a.evidence.map((e, i) => (
              <li key={i} className="text-sm"><Pill className={kindStyle[e.kind]}>{kindLabel[e.kind]}</Pill> {e.claim}<Refs refs={e.refs} a={a} /></li>
            ))}
          </ul>
        </section>
      )}
      {a.calculations.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700">Calculations (by RefineryLens)</h3>
          <ul className="mt-1 grid gap-2 sm:grid-cols-2">
            {a.calculations.map((c) => (
              <li key={c.ref} id={`calc-${c.ref}`} className="rounded-md border border-teal-600/30 p-2 text-sm">
                <p className="font-medium">[{c.ref}] {c.name}</p>
                {c.refused ? <p className="text-navy-700">Not calculated: {c.refused}</p> : (
                  <>
                    <p className="font-semibold tabular-nums">{fmtNumber(c.result!, 1)} {c.unit}</p>
                    <p className="text-xs">Formula: {c.formula}</p>
                    <ul className="text-xs text-navy-700">{c.inputs.map((x) => <li key={x.label}>{x.label}: {fmtNumber(x.value)} {x.unit}</li>)}</ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {a.implications.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-800">Possible investment implications</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{a.implications.map((x, i) => <li key={i}>{x}</li>)}</ul>
          <p className="hint">Interpretations to consider, not recommendations.</p>
        </section>
      )}
      {(a.uncertainties.length > 0 || a.missing.length > 0) && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">Uncertainty, alternative explanations and missing information</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{a.uncertainties.map((x, i) => <li key={i}>{x}</li>)}{a.missing.map((x, i) => <li key={`m${i}`}>{x}</li>)}</ul>
        </section>
      )}
      {a.sources.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700">Sources</h3>
          <ol className="mt-1 space-y-1.5 text-sm">
            {a.sources.map((s) => (
              <li key={s.ref}>
                <span className="font-semibold">[{s.ref}]</span> <Link href={s.link}>{s.label}</Link>
                <span className="text-xs text-navy-700"> · {s.provenance}{s.date ? ` · ${fmtDate(s.date)}` : ""}{s.isPrivate ? " · private to you" : ""}{s.isFictional ? " · fictional" : ""}</span>
                {s.quote && <p className="text-xs italic text-navy-700">“{s.quote.slice(0, 240)}{s.quote.length > 240 ? "…" : ""}”</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
      {a.flags.map((f) => <Notice key={f} tone="warn">{f}</Notice>)}
      <p className="text-xs text-navy-700">{a.modeNote}</p>
    </div>
  );
}
