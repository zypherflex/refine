import Link from "next/link";
import { deleteScenarioAction } from "@/app/actions/opportunities";
import { CALCULATORS, isCalculatorId, type Inputs } from "@/lib/opportunities/calculators";
import { opportunityBySlug } from "@/lib/opportunities/catalog";
import { fmtDateTime } from "@/lib/format";

type Scenario = { id: string; name: string; calculatorId: string; opportunitySlug: string | null; inputs: unknown; createdAt: Date };

/** Saved scenarios are recalculated from their stored inputs every time they are shown. */
export function ScenarioList({ scenarios, showTool }: { scenarios: Scenario[]; showTool?: boolean }) {
  return (
    <div>
      <h3 className="font-semibold text-ink-950">Your saved scenarios</h3>
      <ul className="mt-2 divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white">
        {scenarios.map((s) => {
          if (!isCalculatorId(s.calculatorId)) return null;
          const calc = CALCULATORS[s.calculatorId];
          const opp = s.opportunitySlug ? opportunityBySlug(s.opportunitySlug) : null;
          const unit = opp?.calculator?.id === calc.id ? opp.calculator.unit : undefined;
          const r = calc.compute((s.inputs ?? {}) as Inputs, { unit });
          const href = `/opportunities/tools/${calc.id}?scenario=${s.id}`;
          return (
            <li key={s.id} className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium"><Link href={href}>{s.name}</Link></p>
                <p className="text-xs text-ink-600">{showTool ? `${calc.name}${opp ? ` · ${opp.title}` : ""} · ` : ""}saved {fmtDateTime(s.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="num font-medium">{r.ok ? `${r.headline.label}: ${r.headline.value.toLocaleString("en-GB", { maximumFractionDigits: 0 })} ${r.headline.unit}` : "Incomplete"}</span>
                <form action={deleteScenarioAction}><input type="hidden" name="id" value={s.id} /><button className="btn-ghost btn-sm" aria-label={`Delete scenario ${s.name}`}>Delete</button></form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
