import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getThesis, thresholdStatus } from "@/server/services/thesis";
import { deleteThesisAction, reviewSuggestionAction } from "@/app/actions/thesis";
import { fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { topicLabel } from "@/lib/labels";
import { EmptyState, Explainer, FictionTag, Notice, PageHeader, Pill, ProvenanceBadge } from "@/components/ui";

const stanceStyle: Record<string, string> = { SUPPORTS: "bg-teal-100 text-teal-800", CHALLENGES: "bg-risk-100 text-risk-800", UNCLEAR: "bg-navy-100 text-navy-800" };
const stanceLabel: Record<string, string> = { SUPPORTS: "May support", CHALLENGES: "May challenge", UNCLEAR: "Unclear" };

export default async function ThesisPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const t = await getThesis(user, id).catch(() => null);
  if (!t) notFound();
  const thresholds = await thresholdStatus(user, id);
  const pending = t.evidence.filter((e) => e.status === "PENDING_REVIEW");
  const accepted = t.evidence.filter((e) => e.status === "ACCEPTED");
  const overdue = t.reviewDate && t.reviewDate < new Date();

  return (
    <>
      {sp.saved && <div className="mb-4"><Notice tone="ok">Saved as version {t.version}.</Notice></div>}
      <PageHeader eyebrow="Your work"
        title={t.title}
        subtitle={<>{t.company.name} · version {t.version} · updated {fmtDate(t.updatedAt)} · <span className="font-medium">Private to you</span></>}
        actions={<><Link href={`/thesis/${t.id}/edit`} className="btn-primary">Edit thesis</Link><Link href={`/assistant?q=${encodeURIComponent("Which disclosures challenge my saved thesis?")}`} className="btn-secondary">Ask what challenges it</Link></>}
      />
      {t.company.isFictional && <div className="mb-4"><FictionTag /> <span className="text-xs text-navy-700">This thesis is about the fictional demo company.</span></div>}
      {overdue && <div className="mb-4"><Notice tone="warn" title="Review date passed">You planned to review this thesis by {fmtDate(t.reviewDate)}.</Notice></div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h-section">Rationale</h2>
            <p className="mt-1 whitespace-pre-line text-sm">{t.rationale}</p>
            {t.reassessmentConditions && (<><h3 className="mt-4 text-sm font-semibold">I will reassess if…</h3><p className="mt-1 whitespace-pre-line text-sm">{t.reassessmentConditions}</p></>)}
            <p className="mt-3 text-xs text-navy-700">Review date: {fmtDate(t.reviewDate)}</p>
          </section>

          <section id="suggestions" className="card" aria-labelledby="sugg-h">
            <h2 id="sugg-h" className="h-section">Evidence to review <span className="text-sm font-normal text-navy-700">({pending.length})</span></h2>
            <p className="hint">New or corrected disclosures that overlap with your assumptions. Decide what each means; nothing is applied automatically.</p>
            {pending.length === 0 ? <p className="muted mt-3">Nothing waiting for review.</p> : (
              <ul className="mt-3 space-y-4">
                {pending.map((e) => (
                  <li key={e.id} className="rounded-md border border-amber-600/40 bg-amber-50/40 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">Your original assumption</p>
                        <p className="mt-0.5 text-sm">“{e.assumption?.statement ?? "Whole thesis"}”</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">New evidence</p>
                        {e.announcement && (
                          <p className="mt-0.5 text-sm"><Link href={`/announcements/${e.announcement.id}`} className="font-medium">{e.announcement.headline}</Link>{" "}
                            <span className="text-xs text-navy-700">({fmtDate(e.announcement.sourcePublishedAt)})</span>
                            {e.announcement.status !== "PUBLISHED" && <Pill className="ml-1 bg-risk-100 text-risk-800">{e.announcement.status.toLowerCase()}</Pill>}
                          </p>
                        )}
                        {e.announcement && <div className="mt-1"><ProvenanceBadge p={e.announcement.provenance} /></div>}
                      </div>
                    </div>
                    <p className="mt-2 text-sm"><span className="font-medium">How it may relate:</span> {e.matchReason} {e.announcement?.summary}</p>
                    {e.alternativeExplanations && <p className="mt-1 text-sm"><span className="font-medium">Alternative explanations:</span> {e.alternativeExplanations}</p>}
                    {e.questions && <p className="mt-1 text-sm"><span className="font-medium">Questions to investigate next:</span> {e.questions}</p>}
                    <form action={reviewSuggestionAction} className="mt-3 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="evidenceId" value={e.id} />
                      <input type="hidden" name="thesisId" value={t.id} />
                      <div className="min-w-[12rem] flex-1"><label className="label" htmlFor={`n-${e.id}`}>Your note (optional)</label><input id={`n-${e.id}`} name="note" className="input" /></div>
                      <button name="decision" value="SUPPORTS" className="btn-secondary">May support</button>
                      <button name="decision" value="CHALLENGES" className="btn-secondary">May challenge</button>
                      <button name="decision" value="UNCLEAR" className="btn-secondary">Unclear</button>
                      <button name="decision" value="DISMISS" className="btn btn-sm text-navy-700">Not relevant</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="h-section">Assumptions and evidence</h2>
            <ul className="mt-3 space-y-4">
              {t.assumptions.map((a) => {
                const ev = accepted.filter((e) => e.assumptionId === a.id);
                return (
                  <li key={a.id}>
                    <p className="font-medium">{a.statement}</p>
                    <p className="text-xs text-navy-700">Tracks: {a.topics.map((x) => topicLabel[x] ?? x).join(", ") || "no topics (no automatic suggestions)"}</p>
                    {ev.length === 0 ? <p className="mt-1 text-sm text-navy-700">No evidence recorded yet.</p> : (
                      <ul className="mt-2 space-y-1">
                        {ev.map((e) => (
                          <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                            <Pill className={stanceStyle[e.stance]}>{stanceLabel[e.stance]}</Pill>
                            {e.announcement ? <Link href={`/announcements/${e.announcement.id}`}>{e.announcement.headline}</Link> : <span>Note</span>}
                            {e.note && <span className="text-navy-700">— {e.note}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
            {accepted.some((e) => !e.assumptionId) && (
              <div className="mt-4 border-t border-navy-50 pt-3 text-sm">
                <p className="font-medium">Evidence for the whole thesis</p>
                {accepted.filter((e) => !e.assumptionId).map((e) => <p key={e.id}><Pill className={stanceStyle[e.stance]}>{stanceLabel[e.stance]}</Pill> {e.announcement?.headline} {e.note}</p>)}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="h-section">Indicators</h2>
            {thresholds.length === 0 ? <p className="muted mt-1">No indicators set.</p> : (
              <ul className="mt-2 space-y-3">
                {thresholds.map(({ indicator, metric, value, threshold, state }) => (
                  <li key={indicator.id} className="text-sm">
                    <p className="font-medium">{indicator.label}</p>
                    <p className="text-xs text-navy-700">Alert if {indicator.operator === "BELOW" ? "below" : "above"} {threshold === null ? "(no threshold)" : `${fmtNumber(threshold)} ${indicator.unit}`}</p>
                    {state === "NO_DATA" ? (
                      <p className="mt-1 rounded bg-navy-50 px-2 py-1 text-xs">Not publicly disclosed, so this cannot be checked.</p>
                    ) : (
                      <p className={`mt-1 rounded px-2 py-1 text-xs ${state === "BREACHED" ? "bg-risk-50 text-risk-800" : "bg-teal-50 text-teal-800"}`}>
                        Latest: {fmtNumber(value!)} {indicator.unit} ({metric?.periodLabel}{metric?.valueType !== "REPORTED" ? `, ${metric?.valueType.toLowerCase()}` : ""}). {state === "BREACHED" ? "Past your threshold." : state === "OK" ? "Within your threshold." : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card">
            <h2 className="h-section">Version history</h2>
            <ol className="mt-2 space-y-2 text-sm">
              {t.versions.map((v) => {
                const s = v.snapshot as { title: string; assumptions: { statement: string }[]; rationale: string };
                return (
                  <li key={v.id}>
                    <p><span className="font-medium">Version {v.version}</span> · {fmtDateTime(v.createdAt)}</p>
                    <p className="text-xs text-navy-700">{v.note}</p>
                    <Explainer title="Show this version">
                      <p className="font-medium">{s.title}</p>
                      <p>{s.rationale}</p>
                      <ul className="list-disc pl-4">{s.assumptions.map((a, i) => <li key={i}>{a.statement}</li>)}</ul>
                    </Explainer>
                  </li>
                );
              })}
            </ol>
          </section>
          <details className="rounded-xl border border-risk-600/20 bg-white p-3 text-sm">
            <summary className="font-medium text-risk-700">Delete this thesis</summary>
            <form action={deleteThesisAction} className="mt-2 space-y-2">
              <input type="hidden" name="id" value={t.id} />
              <p className="text-navy-700">This permanently deletes the thesis, its assumptions, evidence decisions and every saved version. It cannot be undone.</p>
              <button className="btn-danger btn-sm">Yes, delete permanently</button>
            </form>
          </details>
        </aside>
      </div>
      {t.evidence.length === 0 && t.assumptions.length === 0 && <EmptyState title="Add assumptions to start tracking evidence" />}
    </>
  );
}
