import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { boardItem, listScenarios } from "@/server/opportunities/board";
import { signalPoints } from "@/server/opportunities/context";
import { opportunityBySlug, scaleLabel, segmentLabel } from "@/lib/opportunities/catalog";
import { CALCULATORS } from "@/lib/opportunities/calculators";
import { SizingTool } from "@/components/opportunities/SizingTool";
import { MarketPanel } from "@/components/opportunities/MarketPanel";
import { BoardForm } from "@/components/opportunities/BoardForm";
import { ContextList, SourceLine } from "@/components/opportunities/ContextList";
import { ScenarioList } from "@/components/opportunities/ScenarioList";
import { PageHeader, Pill, Unavailable } from "@/components/ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const o = opportunityBySlug((await params).slug);
  return { title: o?.title ?? "Opportunity" };
}

export default async function OpportunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const o = opportunityBySlug((await params).slug);
  if (!o) notFound();
  const calcKeys = o.calculator ? CALCULATORS[o.calculator.id].fields({ unit: o.calculator.unit }).flatMap((f) => (f.signal ? [f.signal.key] : [])) : [];
  const [item, scenarios, points] = await Promise.all([boardItem(user, o.slug), listScenarios(user, { opportunitySlug: o.slug }), signalPoints([...new Set([...o.signals, ...calcKeys])], user)]);

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/opportunities">← All opportunities</Link></p>
      <PageHeader eyebrow={segmentLabel(o.segment)} title={o.title} subtitle={o.pitch} actions={<div className="flex flex-wrap gap-1.5">{o.scales.map((s) => <Pill key={s} className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{scaleLabel(s)}</Pill>)}</div>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="card" aria-labelledby="how-h">
            <h2 id="how-h" className="h-section">How the business works</h2>
            <p className="mt-1 text-sm text-ink-800">{o.howItWorks}</p>
          </section>
          <section className="card" aria-labelledby="anchor-h">
            <h2 id="anchor-h" className="h-section">What it builds on</h2>
            <p className="muted">Statements from the company's own website. They are the company's claims, shown with their page, and RefineryLens has not verified them.</p>
            <ul className="mt-3 space-y-3">
              {o.anchors.map((a) => (
                <li key={a.text} className="rounded-lg border border-ink-100 bg-white p-3">
                  <p className="text-sm text-ink-900">{a.text}</p>
                  <div className="mt-1.5"><SourceLine id={a.source} /></div>
                </li>
              ))}
            </ul>
          </section>
          <section className="card" aria-labelledby="ctx-h">
            <h2 id="ctx-h" className="h-section">What has been reported</h2>
            <p className="muted">Dated reports that bear on this opportunity. They describe the position when published and may since have changed.</p>
            <div className="mt-3">
              {o.context.length ? <ContextList items={o.context} /> : <Unavailable title="No reviewed reports yet">RefineryLens has not yet reviewed a dated report specific to this opportunity.</Unavailable>}
            </div>
          </section>
          {o.calculator && (
            <section className="card" aria-labelledby="size-h" id="size">
              <h2 id="size-h" className="h-section">Size it: {CALCULATORS[o.calculator.id].name}</h2>
              <p className="muted mb-4">{CALCULATORS[o.calculator.id].summary} Nothing is filled in for you: enter your own quotes, or use example numbers to see how it works.</p>
              <SizingTool calculatorId={o.calculator.id} unit={o.calculator.unit} opportunitySlug={o.slug} signals={points} />
              {scenarios.length > 0 && <div className="mt-6"><ScenarioList scenarios={scenarios} /></div>}
            </section>
          )}
          <section className="card" aria-labelledby="val-h">
            <h2 id="val-h" className="h-section">Questions to answer before you commit</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{o.validate.map((v) => <li key={v}>{v}</li>)}</ul>
            <h3 className="mt-4 font-semibold text-ink-950">Risks</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{o.risks.map((v) => <li key={v}>{v}</li>)}</ul>
            <h3 className="mt-4 font-semibold text-ink-950">Licences and registrations to check</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{o.permits.map((v) => <li key={v}>{v}</li>)}</ul>
          </section>
          {o.signals.length > 0 && <section className="card"><MarketPanel keys={o.signals} points={points} title="Market signals to watch" /></section>}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <section className="card" aria-labelledby="board-h">
            <h2 id="board-h" className="h-section">My opportunity board</h2>
            <p className="muted mb-3">Private to you. Track where you are with this idea.</p>
            <BoardForm slug={o.slug} item={item} />
          </section>
        </aside>
      </div>
    </>
  );
}
