import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { selectedCompany } from "@/server/services/companies";
import { can } from "@/lib/permissions";
import { fmtDate } from "@/lib/format";
import { riskCategoryLabel } from "@/lib/labels";
import type { RiskCategory } from "@prisma/client";
import { EmptyState, Explainer, LevelBadge, PageHeader, Pill, Unavailable } from "@/components/ui";

export const metadata = { title: "Risk center" };

export default async function RisksPage() {
  const user = await requireUser();
  const company = await selectedCompany();
  if (!company) return <EmptyState title="No company selected" />;
  const risks = await db.risk.findMany({
    where: { companyId: company.id, status: can.viewEditorial(user) ? { in: ["PUBLISHED", "DRAFT"] } : "PUBLISHED" },
    include: { evidence: { include: { announcement: { select: { id: true, headline: true, status: true } } } } },
    orderBy: { updatedAt: "desc" },
  });
  const cats = Object.keys(riskCategoryLabel) as RiskCategory[];
  return (
    <>
      <PageHeader eyebrow="Research" title="Risk center" subtitle="Risks are grouped into ten categories. Each entry separates how serious the impact could be from how confident we are that it will happen. There are no numerical risk scores." />
      <Explainer title="How to read these ratings">
        <p><strong>Impact if it happens</strong> describes how much the issue could affect the business. <strong>Confidence it will happen</strong> describes how strongly the evidence suggests it will occur. A high-impact risk can have low confidence, and the reverse. Both are editorial judgements based on the evidence shown.</p>
      </Explainer>
      <div className="mt-5 space-y-6">
        {cats.map((c) => {
          const list = risks.filter((r) => r.category === c);
          return (
            <section key={c} aria-labelledby={`r-${c}`}>
              <h2 id={`r-${c}`} className="h-section">{riskCategoryLabel[c]}</h2>
              {list.length === 0 ? (
                <div className="mt-2"><Unavailable title="No reviewed risk entry">No evidence-based entry has been published for this category yet. That does not mean the risk is absent.</Unavailable></div>
              ) : (
                list.map((r) => (
                  <article key={r.id} className="card mt-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <LevelBadge kind="Impact if it happens" level={r.severity} />
                      <LevelBadge kind="Confidence it will happen" level={r.confidence} />
                      {r.status === "DRAFT" && <Pill className="bg-amber-100 text-amber-800">Draft, staff only</Pill>}
                      {r.isFictional && <Pill className="bg-amber-100 text-amber-800">Fictional</Pill>}
                    </div>
                    <h3 className="mt-2 font-semibold">{r.title}</h3>
                    <p className="mt-1 text-sm">{r.summary}</p>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div><dt className="text-xs font-semibold uppercase tracking-wide text-ink-700">Supporting evidence</dt><dd className="mt-0.5">{r.evidenceSummary}{r.evidence.length > 0 && <ul className="mt-1">{r.evidence.map((e) => e.announcement && <li key={e.id}><Link href={`/announcements/${e.announcement.id}`}>{e.announcement.headline}</Link></li>)}</ul>}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase tracking-wide text-ink-700">How it could affect the business</dt><dd className="mt-0.5">{r.impactPathway}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase tracking-wide text-ink-700">Time horizon</dt><dd className="mt-0.5">{r.horizon}</dd></div>
                      <div><dt className="text-xs font-semibold uppercase tracking-wide text-ink-700">Evidence quality and uncertainty</dt><dd className="mt-0.5">{r.evidenceQuality} {r.uncertainty}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-ink-700">What would clarify it</dt><dd className="mt-0.5">{r.clarifyingDisclosure}</dd></div>
                    </dl>
                    <p className="mt-2 text-xs text-ink-700">Updated {fmtDate(r.updatedAt)}</p>
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
