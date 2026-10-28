import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { fmtDate } from "@/lib/format";
import { scopeLabel } from "@/lib/labels";
import { EmptyState, FictionTag, Notice, PageHeader, Pill, SourceLink } from "@/components/ui";

export const metadata = { title: "Company profile" };

type Fact = { label: string; value: string; sourceUrl: string; retrievedAt: string };

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
  const facts = (company.profileFacts as Fact[] | null) ?? [];
  return (
    <>
      <PageHeader eyebrow="Research" title={company.name} subtitle={`${company.sector} · ${company.country}`} actions={company.isFictional ? <FictionTag /> : undefined} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="h-section">About this coverage</h2>
            <p className="mt-2 text-sm leading-relaxed">{company.description}</p>
            <p className="mt-2 text-sm text-navy-700">{company.coverageNote}</p>
          </section>
          {facts.length > 0 && (
            <section className="card">
              <h2 className="h-section">Company-stated facts</h2>
              <div className="mt-2"><Notice tone="warn">These facts are quoted from the company's own website. They are labelled company-disclosed and have not yet been verified by a RefineryLens editor. Company-disclosed means the company said it, not that it is independently confirmed.</Notice></div>
              <dl className="mt-3 divide-y divide-navy-50">
                {facts.map((f) => (
                  <div key={f.label} className="grid gap-1 py-2 sm:grid-cols-3">
                    <dt className="text-sm font-medium text-navy-800">{f.label}</dt>
                    <dd className="text-sm sm:col-span-2">
                      {f.value}
                      <span className="mt-0.5 block text-xs text-navy-700"><Pill className="bg-navy-100 text-navy-900">Company-disclosed</Pill> <SourceLink href={f.sourceUrl}>{new URL(f.sourceUrl).pathname || "/"}</SourceLink> · retrieved {fmtDate(f.retrievedAt)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
        <aside className="space-y-6">
          <section className="card">
            <h2 className="h-section">Legal entities</h2>
            <p className="hint">Figures are labelled with the entity and scope they describe. Group and refinery figures are never combined without a stated reconciliation.</p>
            <ul className="mt-2 space-y-2">
              {entities.map((e) => (
                <li key={e.id} className="text-sm"><p className="font-medium">{e.name}</p><p className="text-xs text-navy-700">{scopeLabel[e.scope]}{e.notes && ` · ${e.notes}`}</p></li>
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
            <p className="mt-3 text-xs text-navy-700">Share prices, ticker symbols and offer deadlines are only shown when an editor has verified them against a primary source.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
