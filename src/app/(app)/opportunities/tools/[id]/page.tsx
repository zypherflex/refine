import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { listScenarios } from "@/server/opportunities/board";
import { signalPoints } from "@/server/opportunities/context";
import { CALCULATORS, isCalculatorId } from "@/lib/opportunities/calculators";
import { opportunityBySlug } from "@/lib/opportunities/catalog";
import { SizingTool } from "@/components/opportunities/SizingTool";
import { ScenarioList } from "@/components/opportunities/ScenarioList";
import { PageHeader } from "@/components/ui";

const UNITS = ["litre", "kg", "tonne"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: isCalculatorId(id) ? CALCULATORS[id].name : "Sizing tool" };
}

export default async function ToolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ scenario?: string; unit?: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!isCalculatorId(id)) notFound();
  const sp = await searchParams;
  const calc = CALCULATORS[id];
  const scenarios = await listScenarios(user, { calculatorId: id });
  const loaded = sp.scenario ? scenarios.find((s) => s.id === sp.scenario) ?? null : null;
  const opp = loaded?.opportunitySlug ? opportunityBySlug(loaded.opportunitySlug) : null;
  const unit = opp?.calculator?.id === id ? opp.calculator.unit : id === "unit-margin" && UNITS.includes(sp.unit ?? "") ? sp.unit : undefined;
  const keys = calc.fields({ unit }).flatMap((f) => (f.signal ? [f.signal.key] : []));
  const points = await signalPoints(keys, user);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/opportunities/tools">← All sizing tools</Link></p>
      <PageHeader eyebrow="Sizing tool" title={calc.name} subtitle={calc.summary} />
      {id === "unit-margin" && !loaded && (
        <nav aria-label="Unit" className="mb-4 flex flex-wrap gap-2 text-sm">
          {UNITS.map((u) => <Link key={u} href={`?unit=${u}`} aria-current={(unit ?? "litre") === u ? "true" : undefined} className={`btn-sm no-underline ${(unit ?? "litre") === u ? "btn-primary" : "btn-secondary"}`}>Per {u}</Link>)}
        </nav>
      )}
      {loaded && <p className="mb-4 text-sm text-ink-700" role="status">Loaded your scenario “{loaded.name}”{opp ? ` for ${opp.title}` : ""}. Saving again creates a new scenario.</p>}
      <section className="card">
        <SizingTool key={loaded?.id ?? unit ?? "new"} calculatorId={id} unit={unit} opportunitySlug={loaded?.opportunitySlug ?? undefined} signals={points} initial={(loaded?.inputs as Record<string, number | null>) ?? undefined} initialName={loaded ? `${loaded.name} (copy)` : undefined} />
      </section>
      {scenarios.length > 0 && <div className="mt-6"><ScenarioList scenarios={scenarios} showTool /></div>}
    </>
  );
}
