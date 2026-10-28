import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { selectedCompany, companyFreshness } from "@/server/services/companies";
import { listAnnouncements } from "@/server/services/announcements";
import { latestMetric, openConflicts } from "@/server/views";
import { netDebt } from "@/lib/calculations";
import { toCalcInput, FINANCIAL_KEYS, OPERATIONAL_KEYS } from "@/server/services/metrics";
import { fmtDate, fmtDateTime, daysBetween, fmtNumber } from "@/lib/format";
import { riskCategoryLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { MetricTile, TileFrame } from "@/components/MetricTile";
import { EmptyState, LevelBadge, Notice, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Overview" };

const coverageLabel = { ACTIVE: "Active coverage", IN_PREPARATION: "Coverage in preparation", DEMONSTRATION: "Demonstration (fictional)" } as const;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string; welcome?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const company = await selectedCompany();
  if (!company) return <EmptyState title="No companies are covered yet." />;

  const [anns, fresh, conflicts, risks, suggestions, metrics] = await Promise.all([
    listAnnouncements(user, { companyId: company.id, take: 12 }),
    companyFreshness(company.id),
    openConflicts(company.id),
    db.risk.findMany({ where: { companyId: company.id, status: "PUBLISHED" }, orderBy: [{ severity: "desc" }, { updatedAt: "desc" }], take: 4 }),
    db.thesisEvidence.findMany({ where: { status: "PENDING_REVIEW", thesis: { ownerId: user.id, companyId: company.id } }, include: { thesis: true, assumption: true, announcement: true }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.metric.findMany({ where: { companyId: company.id, status: "PUBLISHED" }, select: { key: true, disclosureStatus: true } }),
  ]);
  const published = anns.filter((a) => a.status === "PUBLISHED");
  const [rev, np, ocf, thr, util, debt, cash] = await Promise.all([
    latestMetric(company.id, "revenue", "GROUP"),
    latestMetric(company.id, "net_profit", "GROUP"),
    latestMetric(company.id, "operating_cash_flow", "GROUP"),
    latestMetric(company.id, "throughput", "REFINERY"),
    latestMetric(company.id, "utilization", "REFINERY"),
    latestMetric(company.id, "total_debt", "GROUP"),
    latestMetric(company.id, "cash", "GROUP"),
  ]);
  const nd = debt && cash ? netDebt(toCalcInput(debt), toCalcInput(cash)) : null;
  const allKeys = [...FINANCIAL_KEYS, ...OPERATIONAL_KEYS];
  const missing = allKeys.filter(([k]) => !metrics.some((m) => m.key === k && m.disclosureStatus === "DISCLOSED"));
  const stale = fresh.latest ? daysBetween(fresh.latest, new Date()) > 45 : false;

  return (
    <>
      {sp.denied && <div className="mb-4"><Notice tone="warn">You do not have access to that area.</Notice></div>}
      {sp.welcome && <div className="mb-4"><Notice tone="ok" title="Welcome to RefineryLens">Start by reading what changed, then save your own thesis under “My investment thesis”.</Notice></div>}
      <PageHeader
        eyebrow="Overview"
        title={company.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Pill className={company.coverageStatus === "ACTIVE" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"}>{coverageLabel[company.coverageStatus]}</Pill>
            <span>{company.coverageNote}</span>
          </span>
        }
        actions={<Link href="/assistant" className="btn-primary">Ask the research assistant</Link>}
      />

      <section aria-label="Data freshness" className="mb-6 grid gap-2 sm:grid-cols-2">
        <Notice tone={stale || !fresh.latest ? "warn" : "info"} title="Data freshness">
          {fresh.latest ? (
            <>Most recent reviewed source retrieved {fmtDateTime(fresh.latest)}. {stale && "This is more than 45 days old; newer disclosures may exist."} RefineryLens has no access to live plant systems.</>
          ) : (
            <>No reviewed sources are published for this company yet.</>
          )}
        </Notice>
        <Notice tone={missing.length ? "warn" : "ok"} title="Missing information">
          {missing.length} of {allKeys.length} tracked metrics have no disclosed figure{conflicts.length ? `; ${conflicts.length} source conflict(s) are unresolved` : ""}.
          {fresh.pendingReview > 0 && ` ${fresh.pendingReview} drafted item(s) await editorial review.`}{" "}
          <Link href="/financials">See what is missing</Link>
        </Notice>
      </section>

      <section aria-labelledby="changed" className="mb-8">
        <h2 id="changed" className="h-section">What changed?</h2>
        {published.length === 0 ? (
          <div className="mt-2">
            <EmptyState title="No reviewed announcements yet">
              {fresh.pendingReview > 0 ? `${fresh.pendingReview} item(s) drafted from public sources are waiting for an editor to verify them.` : "Nothing has been published for this company."}
              {can.publish(user) && fresh.pendingReview > 0 && <> <Link href="/editorial">Review them now</Link>.</>}
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {published.slice(0, 3).map((a) => (
              <li key={a.id} className="card flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-5">
                <span className="num w-28 shrink-0 text-xs font-semibold uppercase tracking-wider text-brand-700">{fmtDate(a.sourcePublishedAt)}</span>
                <span className="text-sm"><Link href={`/announcements/${a.id}`} className="font-medium text-navy-950">{a.headline}.</Link> {a.whatChanged}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="metrics" className="mb-8">
        <div className="flex items-baseline justify-between">
          <h2 id="metrics" className="h-section">Available metrics</h2>
          <span className="text-xs text-navy-700">Latest reviewed figure per metric. Group and refinery figures are kept separate.</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
          <MetricTile label="Revenue (group)" m={rev} href="/financials" />
          <MetricTile label="Net profit (group)" m={np} href="/financials" />
          <MetricTile label="Operating cash flow (group)" m={ocf} href="/financials" />
          {nd && nd.ok ? (
            <TileFrame label="Net debt (group, calculated)">
              <p className="num mt-2 text-2xl font-semibold tracking-tight text-navy-950">{fmtNumber(nd.value)} <span className="text-sm font-medium tracking-normal text-navy-600">{nd.unit}</span></p>
              <p className="mt-1 text-xs text-navy-600">{debt!.periodLabel} · {nd.formula}</p>
            </TileFrame>
          ) : (
            <MetricTile label="Net debt (group)" m={null} href="/financials" />
          )}
          <MetricTile label="Crude throughput (refinery)" m={thr} href="/operations" />
          <MetricTile label="Capacity utilization (refinery)" m={util} href="/operations" />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section aria-labelledby="latest" className="lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 id="latest" className="h-section">Latest verified announcements</h2>
            <Link href="/announcements" className="text-sm">All announcements</Link>
          </div>
          <div className="mt-2 space-y-3">
            {published.slice(0, 4).map((a) => <AnnouncementCard key={a.id} a={a} />)}
            {published.length === 0 && <EmptyState title="Nothing published yet" />}
          </div>
        </section>
        <div className="space-y-8">
          <section aria-labelledby="thesis-updates">
            <h2 id="thesis-updates" className="h-section">Updates for your thesis</h2>
            <div className="mt-2 space-y-2">
              {suggestions.length === 0 ? (
                <EmptyState title="No new evidence to review">{<Link href="/thesis">Open your theses</Link>}</EmptyState>
              ) : (
                suggestions.map((s) => (
                  <Link key={s.id} href={`/thesis/${s.thesisId}#suggestions`} className="card-link text-sm">
                    <p className="text-xs text-navy-700">{s.thesis.title}</p>
                    <p className="mt-1 font-medium">{s.announcement?.headline}</p>
                    <p className="mt-1 text-xs">Your assumption: “{s.assumption?.statement}”</p>
                  </Link>
                ))
              )}
            </div>
          </section>
          <section aria-labelledby="risks">
            <div className="flex items-baseline justify-between">
              <h2 id="risks" className="h-section">Key risks</h2>
              <Link href="/risks" className="text-sm">Risk center</Link>
            </div>
            <div className="mt-2 space-y-2">
              {risks.length === 0 && <EmptyState title="No reviewed risk entries yet" />}
              {risks.map((r) => (
                <div key={r.id} className="card">
                  <p className="text-xs text-navy-700">{riskCategoryLabel[r.category]} · updated {fmtDate(r.updatedAt)}</p>
                  <p className="mt-1 text-sm font-medium">{r.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1"><LevelBadge kind="Impact if it happens" level={r.severity} /><LevelBadge kind="Confidence it will happen" level={r.confidence} /></div>
                </div>
              ))}
            </div>
          </section>
          {conflicts.length > 0 && (
            <section aria-labelledby="conflicts">
              <h2 id="conflicts" className="h-section">Conflicting sources</h2>
              {conflicts.map((c) => (
                <div key={c.id} className="card mt-2 border-amber-600/30 bg-amber-50/40">
                  <p className="text-sm font-medium">{c.topic}</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {c.claims.map((x) => <li key={x.id}><strong>{x.claim}</strong> — {x.sourceLabel}, {fmtDate(x.sourceDate)}</li>)}
                  </ul>
                  <p className="mt-1 text-xs text-amber-800">Unresolved. RefineryLens has not chosen between these.</p>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
