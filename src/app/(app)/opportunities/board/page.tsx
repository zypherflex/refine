import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listBoard, listScenarios, readiness } from "@/server/opportunities/board";
import { opportunityBySlug, segmentLabel, STAGES } from "@/lib/opportunities/catalog";
import { ScenarioList } from "@/components/opportunities/ScenarioList";
import { removeBoardAction } from "@/app/actions/opportunities";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "My opportunity board" };

export default async function BoardPage() {
  const user = await requireUser();
  const [items, scenarios] = await Promise.all([listBoard(user), listScenarios(user)]);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/opportunities">← All opportunities</Link></p>
      <PageHeader eyebrow="Your work" title="My opportunity board" subtitle="Your private pipeline of business ideas and the scenarios you have sized. Nobody else, including RefineryLens staff, can see it in the app." />
      {items.length === 0 ? (
        <EmptyState title="Your board is empty" action={<Link href="/opportunities" className="btn-primary btn-sm no-underline">Explore opportunities</Link>}>Open an opportunity and add it to your board to track it here.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {STAGES.map(([stage, label]) => {
            const col = items.filter((i) => i.stage === stage);
            return (
              <section key={stage} aria-labelledby={`col-${stage}`} className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                <h2 id={`col-${stage}`} className="text-sm font-semibold text-ink-950">{label} <span className="font-normal text-ink-500">({col.length})</span></h2>
                <ul className="mt-2 space-y-2">
                  {col.map((i) => {
                    const o = opportunityBySlug(i.opportunitySlug);
                    if (!o) return null;
                    return (
                      <li key={i.id} className="rounded-lg border border-ink-100 bg-white p-3 text-sm shadow-card">
                        <p className="text-[11px] text-ink-500">{segmentLabel(o.segment)}</p>
                        <p className="font-medium"><Link href={`/opportunities/${o.slug}`}>{o.title}</Link></p>
                        {i.nextStep && <p className="mt-1 text-xs"><span className="font-medium">Next:</span> {i.nextStep}</p>}
                        {(() => {
                          const r = readiness(o.slug, i.checked);
                          return (
                            <div className="mt-2">
                              <div className="h-1.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Readiness for ${o.title}`}><div className="h-full bg-brand-600" style={{ width: `${r.pct}%` }} /></div>
                              <p className="mt-0.5 text-[11px] text-ink-600">{r.done} of {r.total} readiness questions answered</p>
                            </div>
                          );
                        })()}
                        <p className="mt-1 text-[11px] text-ink-500">Updated {fmtDateTime(i.updatedAt)}</p>
                        <form action={removeBoardAction} className="mt-1"><input type="hidden" name="slug" value={o.slug} /><button className="text-xs text-ink-600 hover:text-risk-800">Remove</button></form>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {scenarios.length > 0 && <div className="mt-8"><ScenarioList scenarios={scenarios} showTool /></div>}
    </>
  );
}
