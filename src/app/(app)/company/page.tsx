import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { scopeLabel } from "@/lib/labels";
import { companyFacts, factsIn } from "@/lib/company-facts";
import { FactList, ScaleTiles } from "@/components/CompanyFacts";
import { EmptyState, FictionTag, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Company profile" };

const NOT_DISCLOSED = [
  "Actual crude throughput and capacity utilization",
  "Export volumes and destination markets",
  "Crude supply sources and mix",
  "Product output and domestic sales volumes",
  "Revenue, profit, cash flow and debt",
];

export default async function CompanyPage() {
  await requireUser();
  const company = await selectedCompany();
  if (!company) return <EmptyState title="No company selected" />;
  const [entities, counts] = await Promise.all([
    db.legalEntity.findMany({ where: { companyId: company.id } }),
    Promise.all([
      db.announcement.count({ where: { companyId: company.id, status: "PUBLISHED" } }),
      db.document.count({ where: { companyId: company.id, status: "APPROVED", visibility: "PUBLIC" } }),
      db.metric.count({ where: { companyId: company.id, status: "PUBLISHED", disclosureStatus: "DISCLOSED" } }),
    ]),
  ]);
  const facts = companyFacts(company.profileFacts);
  const scale = factsIn(facts, "scale");
  const global = factsIn(facts, "global");
  const facility = [...factsIn(facts, "facility"), ...factsIn(facts, "governance")];
  return (
    <>
      <PageHeader eyebrow="Research" title={company.name} subtitle={`${company.sector} · ${company.country}`} actions={company.isFictional ? <FictionTag /> : undefined} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h-section">About this coverage</h2>
            <p className="mt-2 text-sm leading-relaxed">{company.description}</p>
            <p className="mt-2 text-sm text-ink-700">{company.coverageNote}</p>
          </section>
          {facts.length > 0 && (
            <Notice tone="warn" title="Quoted from the company, not yet verified">
              Facts on this page are quoted from the company's own website and labelled company-disclosed. That means the company said it, not that it has been independently confirmed. A RefineryLens editor has not yet reviewed them.
            </Notice>
          )}
          {scale.length > 0 && (
            <section aria-labelledby="scale-h">
              <h2 id="scale-h" className="h-section mb-3">Scale at a glance</h2>
              <ScaleTiles facts={scale} />
            </section>
          )}
          {global.length > 0 && (
            <section className="card" aria-labelledby="global-h">
              <p className="eyebrow">Global positioning</p>
              <h2 id="global-h" className="mt-1 font-serif text-xl font-semibold">What the company says about its place in world refining</h2>
              <p className="muted mt-1">Rankings and reach below are the company's own claims. Where two pages describe size differently, both are shown.</p>
              <div className="mt-2"><FactList facts={global} /></div>
            </section>
          )}
          {!company.isFictional && (
            <section className="card" aria-labelledby="nd-h">
              <h2 id="nd-h" className="h-section">Not yet publicly disclosed</h2>
              <p className="muted mt-1">Needed to judge global competitiveness, and shown as missing rather than estimated.</p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {NOT_DISCLOSED.map((x) => <li key={x} className="rounded-lg border border-dashed border-ink-200 bg-ink-50/60 px-3 py-2 text-sm text-ink-700">{x}</li>)}
              </ul>
            </section>
          )}
          {facility.length > 0 && (
            <section className="card" aria-labelledby="fac-h">
              <h2 id="fac-h" className="h-section">Facility, products and leadership</h2>
              <div className="mt-2"><FactList facts={facility} /></div>
            </section>
          )}
        </div>
        <aside className="space-y-6">
          <section className="card">
            <h2 className="h-section">Legal entities</h2>
            <p className="hint">Figures are labelled with the entity and scope they describe. Group and refinery figures are never combined without a stated reconciliation.</p>
            <ul className="mt-2 space-y-2">
              {entities.map((e) => (
                <li key={e.id} className="text-sm"><p className="font-medium">{e.name}</p><p className="text-xs text-ink-700">{scopeLabel[e.scope]}{e.notes && ` · ${e.notes}`}</p></li>
              ))}
            </ul>
          </section>
          <section className="card text-sm">
            <h2 className="h-section">Coverage at a glance</h2>
            <ul className="mt-2 space-y-1">
              <li><Link href="/announcements">{counts[0]} reviewed announcements</Link></li>
              <li><Link href="/library">{counts[1]} approved documents</Link></li>
              <li><Link href="/financials">{counts[2]} disclosed figures</Link></li>
            </ul>
            <p className="mt-3 text-xs text-ink-700">Share prices, ticker symbols and offer deadlines are only shown when an editor has verified them against a primary source.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
