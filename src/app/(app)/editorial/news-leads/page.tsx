import Link from "next/link";
import { requireRole } from "@/server/auth";
import { newsLeadAction } from "@/app/actions/opendata";
import { fmtDateTime } from "@/lib/format";
import { integrationStatus } from "@/server/integrations";
import { listNewsLeads } from "@/server/services/market";
import { PROVIDERS } from "@/server/opendata/catalog";
import { EditorialNav } from "@/components/EditorialNav";
import { EmptyState, Notice, PageHeader, Pill, SourceLink } from "@/components/ui";

export const metadata = { title: "News leads" };

const TABS = [["NEW", "New"], ["DRAFTED", "Drafted"], ["DISMISSED", "Dismissed"]] as const;

export default async function NewsLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const user = await requireRole("ANALYST");
  const status = TABS.some(([k]) => k === sp.status) ? sp.status! : "NEW";
  const leads = await listNewsLeads(user, null, status);
  const gdelt = integrationStatus().openData.gdelt;
  return (
    <>
      <PageHeader eyebrow="Editorial desk" title="News leads" subtitle="Articles found by news monitoring for covered companies. A lead is not evidence: open the article, check it against a primary source, and only then draft an announcement." />
      <EditorialNav />
      <div className="mb-4"><Notice>Leads come from the <SourceLink href={PROVIDERS.gdelt.homepageUrl}>GDELT Project</SourceLink> and are only visible to editorial staff. Only the headline, link and outlet are stored; never copy article text that the publisher has not licensed. Fictional demo companies never get leads. {!gdelt.available && <strong>News monitoring is off: {gdelt.reason}.</strong>}</Notice></div>
      <nav aria-label="Lead status" className="mb-4 flex gap-2 text-sm">{TABS.map(([k, l]) => <Link key={k} href={`/editorial/news-leads?status=${k}`} aria-current={k === status ? "page" : undefined} className={k === status ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{l}</Link>)}</nav>
      {leads.length === 0 ? <EmptyState title="No leads here">New leads appear after the next news-monitoring run, for companies with a news query.</EmptyState> : (
        <ul className="space-y-2">
          {leads.map((l) => (
            <li key={l.id} className="card">
              <div className="flex flex-wrap items-center gap-1.5"><Pill className="bg-ink-100 text-ink-800">{l.company.shortName}</Pill><Pill className="bg-amber-100 text-amber-800">Unverified lead</Pill>{l.sourceCountry && <span className="text-xs text-ink-600">{l.sourceCountry}</span>}{l.language && <span className="text-xs text-ink-600">· {l.language}</span>}</div>
              <p className="mt-1 font-medium"><SourceLink href={l.url}>{l.title}</SourceLink></p>
              <p className="text-xs text-ink-700">{l.domain} · seen {fmtDateTime(l.seenAt)}</p>
              <form action={newsLeadAction} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={l.id} />
                {status !== "DRAFTED" && <button name="op" value="draft" className="btn-primary btn-sm">Draft announcement</button>}
                {status === "NEW" && <button name="op" value="dismiss" className="btn-secondary btn-sm">Dismiss</button>}
                {status === "DISMISSED" && <button name="op" value="restore" className="btn-secondary btn-sm">Restore</button>}
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
