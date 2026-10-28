import type { CalcResult } from "@/lib/calculations";
import { fmtNumber } from "@/lib/format";

export function CalcCard({ name, result, plain }: { name: string; result: CalcResult; plain?: string }) {
  return (
    <div className={`rounded-md border p-3 text-sm ${result.ok ? "border-brand-600/30 bg-white" : "border-dashed border-navy-600/30 bg-navy-50/50"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">Calculated by RefineryLens</p>
      <p className="mt-0.5 font-medium">{name}</p>
      {result.ok ? (
        <>
          <p className="mt-1 text-lg font-semibold tabular-nums">{fmtNumber(result.value, 1)} {result.unit}</p>
          <p className="mt-1 text-xs"><span className="font-medium">Formula:</span> {result.formula}</p>
          <ul className="mt-1 text-xs text-navy-700">{result.inputs.map((i) => <li key={i.label}>{i.label}: {fmtNumber(i.value)} {i.unit}</li>)}</ul>
          {result.note && <p className="mt-1 text-xs text-amber-800">{result.note}</p>}
          {plain && <p className="mt-1 text-xs">{plain}</p>}
        </>
      ) : (
        <p className="mt-1 text-sm"><span className="font-medium">Not calculated.</span> {result.reason}</p>
      )}
    </div>
  );
}
