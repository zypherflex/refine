import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { OPERATIONAL_KEYS, listMetrics, toCalcInput } from "@/server/services/metrics";
import { capacityUtilization } from "@/lib/calculations";
import { MetricTable } from "@/components/MetricTable";
import { CalcCard } from "@/components/CalcCard";
import { PeriodChart } from "@/components/PeriodChart";
import { EmptyState, Explainer, Notice, PageHeader, Unavailable } from "@/components/ui";

export const metadata = { title: "Operational indicators" };

const PLAIN: Record<string, string> = {
  nameplate_capacity: "The maximum crude the plant is designed to process. Capacity is not output.",
  throughput: "Crude oil actually processed, as an average rate over the period.",
  utilization: "Throughput divided by capacity.",
  production_volume: "Refined products that came out of the plant. Differs from throughput because of yields and losses.",
  product_yield: "The share of output that is each product.",
  domestic_sales: "Volumes delivered or sold in the home market. Deliveries are not the same as invoiced sales.",
  exports: "Volumes shipped abroad.",
  crude_mix: "Where the crude comes from.",
  maintenance: "Disclosed planned maintenance and unplanned outages.",
  expansion: "Disclosed project milestones.",
  refining_margin: "The difference between product value and crude cost per barrel. Only shown where disclosed or transparently estimated.",
};

export default async function OperationsPage() {
  const user = await requireUser();
  const company = await selectedCompany();
  if (!company) return <EmptyState title="No company selected" />;
  const rows = await listMetrics(user, company.id, "OPERATIONAL");
  const company_rows = rows.filter((r) => r.scope !== "NATIONAL_SECTOR");
  const sector = rows.filter((r) => r.scope === "NATIONAL_SECTOR");
  const known = new Set<string>(OPERATIONAL_KEYS.map(([k]) => k));
  const other = company_rows.filter((r) => !known.has(r.key));
  const pub = company_rows.filter((r) => r.status === "PUBLISHED" && r.disclosureStatus === "DISCLOSED" && r.value !== null);
  const capacity = pub.find((m) => m.key === "nameplate_capacity");
  const thrSameH1 = pub.filter((m) => m.key === "throughput" && m.periodType === "H1");

  return (
    <>
      <PageHeader eyebrow="Research" title="Operational indicators" subtitle="Disclosed operating data with source, period, units and last update. Capacity, throughput, production, deliveries and sales are kept separate." />
      <div className="mb-5"><Notice title="No live plant data">RefineryLens has no access to plant control or monitoring systems. Every figure comes from a published document and is only as current as that document.</Notice></div>

      {thrSameH1.length > 1 && capacity && (
        <section className="mb-6" aria-labelledby="util-h">
          <h2 id="util-h" className="h-section">Utilization under each throughput claim</h2>
          <p className="muted">Sources disagree on throughput for the same period, so utilization is shown for each claim rather than one chosen value.</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {thrSameH1.map((t) => <CalcCard key={t.id} name={`${t.periodLabel} using ${t.provenance === "INDEPENDENT_REPORT" ? "the independent report" : "the company figure"}`} result={capacityUtilization(toCalcInput(t), toCalcInput(capacity))} />)}
          </div>
        </section>
      )}

      <div className="space-y-6">
        {OPERATIONAL_KEYS.map(([key, label]) => {
          const list = company_rows.filter((r) => r.key === key);
          const chartPts = pub.filter((m) => m.key === key && (key === "throughput" || key === "utilization") && m.provenance !== "INDEPENDENT_REPORT").sort((a, b) => (a.periodEnd?.getTime() ?? 0) - (b.periodEnd?.getTime() ?? 0));
          return (
            <section key={key} id={key} className="card" aria-labelledby={`h-${key}`}>
              <h2 id={`h-${key}`} className="h-section">{label}</h2>
              <p className="muted mt-0.5">{PLAIN[key]}</p>
              {list.length === 0 ? (
                <div className="mt-3"><Unavailable title="Not publicly disclosed">No reviewed source discloses {label.toLowerCase()} for this company. RefineryLens does not estimate it.</Unavailable></div>
              ) : (
                <>
                  {chartPts.length >= 2 && <PeriodChart title={label} unit={chartPts[0].unit} points={chartPts.map((m) => ({ period: m.periodLabel, value: Number(m.value) }))} description="Average rates for each period from company disclosures. Average daily rates are comparable across periods of different length; totals would not be." />}
                  <div className="mt-3"><MetricTable rows={list} /></div>
                </>
              )}
            </section>
          );
        })}
        {other.length > 0 && (
          <section className="card">
            <h2 className="h-section">Other disclosed indicators</h2>
            <div className="mt-3"><MetricTable rows={other} /></div>
          </section>
        )}
        <section className="card border-ink-600/30">
          <h2 className="h-section">National sector context</h2>
          <p className="muted">Sector totals cover all suppliers in the market, including imports. They are not company figures and are never combined with them.</p>
          {sector.length === 0 ? <div className="mt-3"><Unavailable title="No sector data published" /></div> : <div className="mt-3"><MetricTable rows={sector} /></div>}
        </section>
      </div>
      <section className="card mt-6">
        <h2 className="h-section">Definitions</h2>
        <Explainer title="Capacity, throughput, production, deliveries and sales">
          <p>Nameplate capacity is what the plant is designed to process. Throughput is what it actually processed. Production is the refined output, which depends on yields. Deliveries are volumes that left the gate; sales are volumes invoiced. Each can differ from the next, and a company that discloses capacity has not disclosed throughput.</p>
        </Explainer>
        <Explainer title="How refining margins are estimated">
          <p>Where a company does not disclose margins, an estimate must state its method: product yields multiplied by assessed product prices, minus crude cost, usually before operating costs. Estimates are labelled “Estimate” and show their assumptions.</p>
        </Explainer>
      </section>
    </>
  );
}
