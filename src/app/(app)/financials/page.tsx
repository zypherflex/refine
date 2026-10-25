import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { FINANCIAL_KEYS, listMetrics, toCalcInput } from "@/server/services/metrics";
import { growth, operatingMargin, freeCashFlow, netDebt, cashConversion, unitLabel } from "@/lib/calculations";
import { MetricTable } from "@/components/MetricTable";
import { CalcCard } from "@/components/CalcCard";
import { PeriodChart } from "@/components/PeriodChart";
import { EmptyState, Explainer, PageHeader, Unavailable } from "@/components/ui";

export const metadata = { title: "Financial reports" };

const PLAIN: Record<string, string> = {
  revenue: "Money received or receivable from selling refined products, before costs.",
  operating_profit: "What is left from operations after crude, running costs and depreciation, before interest, currency effects and tax.",
  net_profit: "The bottom line after all costs, finance costs, currency gains or losses and tax.",
  operating_cash_flow: "Cash the business actually generated from operations in the period.",
  capex: "Cash spent on building, expanding and maintaining the plant.",
  total_debt: "Money owed to banks and bondholders at the period end.",
  cash: "Cash held at the period end.",
  finance_costs: "Interest and similar charges on borrowings.",
  fx_gain_loss: "Accounting gains or losses from exchange-rate movements, mostly on foreign-currency debt. Often non-cash.",
  dividends: "Cash paid or declared to shareholders.",
};

export default async function FinancialsPage() {
  const user = await requireUser();
  const company = await selectedCompany();
  if (!company) return <EmptyState title="No company selected" />;
  const rows = await listMetrics(user, company.id, "FINANCIAL");
  const pub = rows.filter((r) => r.status === "PUBLISHED" && r.disclosureStatus === "DISCLOSED" && r.value !== null);
  const get = (key: string, period: string, scope = "GROUP") => pub.find((m) => m.key === key && m.periodLabel === period && m.scope === scope);
  const fyPeriods = [...new Set(pub.filter((m) => m.periodType === "FY" && m.scope === "GROUP").map((m) => m.periodLabel))].sort();
  const latestFy = fyPeriods.at(-1);
  const priorFy = fyPeriods.at(-2);
  const h1 = pub.find((m) => m.periodType === "H1" && m.scope === "GROUP")?.periodLabel;

  const calcs: { name: string; r: ReturnType<typeof growth>; plain?: string }[] = [];
  if (latestFy) {
    const [rev, op, ocf, capex, debt, cash, np] = ["revenue", "operating_profit", "operating_cash_flow", "capex", "total_debt", "cash", "net_profit"].map((k) => get(k, latestFy));
    if (rev && op) calcs.push({ name: `Operating margin, ${latestFy}`, r: operatingMargin(toCalcInput(op), toCalcInput(rev)), plain: "How much of each unit of revenue is left after operating costs." });
    if (ocf && capex) calcs.push({ name: `Free cash flow, ${latestFy}`, r: freeCashFlow(toCalcInput(ocf), toCalcInput(capex)), plain: "Cash left after investing in the plant, available for debt and shareholders." });
    if (debt && cash) calcs.push({ name: `Net debt, ${latestFy}`, r: netDebt(toCalcInput(debt), toCalcInput(cash)) });
    if (ocf && np) calcs.push({ name: `Cash conversion, ${latestFy}`, r: cashConversion(toCalcInput(ocf), toCalcInput(np)), plain: "Operating cash flow for each unit of net profit. Below 1x means profit was not fully turned into cash." });
    const priorRev = priorFy && get("revenue", priorFy);
    if (rev && priorRev) calcs.push({ name: `Revenue growth, ${priorFy} to ${latestFy}`, r: growth(toCalcInput(rev), toCalcInput(priorRev)) });
    // Show the guard rails explicitly: these comparisons are refused.
    const h1Rev = h1 && get("revenue", h1);
    if (rev && h1Rev) calcs.push({ name: `Revenue growth, ${latestFy} to ${h1}`, r: growth(toCalcInput(h1Rev), toCalcInput(rev)) });
    const refRev = h1 && get("revenue", h1, "REFINERY");
    if (h1Rev && refRev) calcs.push({ name: `Group revenue vs refinery revenue, ${h1}`, r: growth(toCalcInput(refRev), toCalcInput(h1Rev)) });
  }

  return (
    <>
      <PageHeader eyebrow="Research" title="Financial reports" subtitle="Reported figures in plain language, with the document and page each one comes from. Currency, units, period, scope and audit status are kept with every figure." />
      <nav aria-label="Jump to metric" className="sticky top-[5.6rem] z-20 -mx-4 mb-6 overflow-x-auto border-y border-navy-100 bg-navy-50/90 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <ul className="flex gap-1 whitespace-nowrap text-xs font-medium">
          {FINANCIAL_KEYS.map(([key, label]) => (
            <li key={key}><a href={`#${key}`} className="block rounded-md px-2.5 py-1 text-navy-700 no-underline hover:bg-white hover:text-navy-950 hover:no-underline">{label}</a></li>
          ))}
          <li><a href="#calc-h" className="block rounded-md px-2.5 py-1 text-teal-700 no-underline hover:bg-white hover:no-underline">Calculated</a></li>
        </ul>
      </nav>
      {rows.length === 0 && (
        <Unavailable title="No financial figures have been published for this company.">
          RefineryLens only shows figures supported by a reviewed source. {company.coverageNote}
        </Unavailable>
      )}
      <div className="space-y-6">
        {FINANCIAL_KEYS.map(([key, label]) => {
          const list = rows.filter((r) => r.key === key);
          const chart = pub.filter((m) => m.key === key && m.periodType === "FY" && m.scope === "GROUP").sort((a, b) => a.periodLabel.localeCompare(b.periodLabel));
          return (
            <section key={key} id={key} className="card scroll-mt-40" aria-labelledby={`h-${key}`}>
              <h2 id={`h-${key}`} className="h-section">{label}</h2>
              <p className="muted mt-0.5">{PLAIN[key]}</p>
              {list.length === 0 ? (
                <div className="mt-3"><Unavailable title="No published figure">No reviewed source for {label.toLowerCase()} has been published. This is shown as missing rather than estimated.</Unavailable></div>
              ) : (
                <>
                  {chart.length >= 2 && <PeriodChart title={label} unit={unitLabel(chart[0])} points={chart.map((m) => ({ period: m.periodLabel, value: Number(m.value) }))} description={`Full financial years only, group level, ${chart[0].currency}. Half-year and refinery-entity figures are excluded because they are not comparable.`} />}
                  <div className="mt-3"><MetricTable rows={list} /></div>
                </>
              )}
            </section>
          );
        })}
      </div>

      {calcs.length > 0 && (
        <section className="mt-8" aria-labelledby="calc-h">
          <h2 id="calc-h" className="h-section">Calculated metrics</h2>
          <p className="muted">Calculated by RefineryLens from the reported figures above, with the formula and inputs shown. Some comparisons are deliberately refused when periods or scopes are not comparable.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{calcs.map((c) => <CalcCard key={c.name} name={c.name} result={c.r} plain={c.plain} />)}</div>
        </section>
      )}

      <section className="card mt-8">
        <h2 className="h-section">Understanding the numbers</h2>
        <Explainer title="Why profit and cash flow can differ">
          <p>Profit counts sales when they are made and costs when they are incurred. Cash flow counts money when it actually moves. They differ when customers pay late (receivables rise), when inventory is built up, when large non-cash charges such as depreciation or currency revaluation are included in profit, and when tax or interest is paid in a different period from when it is recorded.</p>
          <p>Capital expenditure is a cash outflow that does not appear as a cost in profit for the year; it is spread over time as depreciation.</p>
        </Explainer>
        <Explainer title="Group-level versus refinery-level figures">
          <p>A group's accounts include every subsidiary (for example trading, logistics or other businesses). A refinery entity's figures include only the refinery. RefineryLens never adds, subtracts or compares the two without a reconciliation published by the company.</p>
        </Explainer>
        <Explainer title="Audited, unaudited and restated">
          <p>Audited figures have been checked by an external auditor. Unaudited interim figures can be revised. Restated figures replace earlier published numbers; the earlier versions remain in the corrections log.</p>
        </Explainer>
        <Explainer title="Why some growth rates are not shown">
          <p>Growth is only calculated between periods of the same length, the same currency and the same reporting scope. A six-month figure cannot be compared with a twelve-month figure, and annualising it would assume the second half looks like the first.</p>
        </Explainer>
      </section>
    </>
  );
}
