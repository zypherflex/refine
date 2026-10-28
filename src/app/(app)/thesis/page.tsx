import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listTheses } from "@/server/services/thesis";
import { fmtDate } from "@/lib/format";
import { EmptyState, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "My investment thesis" };

export default async function ThesisList() {
  const user = await requireUser();
  const theses = await listTheses(user);
  return (
    <>
      <PageHeader eyebrow="Your work" title="My investment thesis" subtitle="Record your rationale and assumptions, then revisit them as evidence arrives. Theses are private to you. RefineryLens suggests evidence for review; it never changes your thesis or tells you to buy or sell." actions={<Link href="/thesis/new" className="btn-primary">New thesis</Link>} />
      {theses.length === 0 ? (
        <EmptyState title="You have not saved a thesis yet" action={<Link href="/thesis/new" className="btn-primary">Create your first thesis</Link>}>
          Example assumption: “Improved utilization should support operating cash flow.”
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {theses.map((t) => (
            <li key={t.id}>
              <Link href={`/thesis/${t.id}`} className="card block text-navy-900 no-underline hover:border-brand-600">
                <p className="text-xs text-navy-700">{t.company.name}</p>
                <p className="mt-1 font-semibold">{t.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-navy-800">{t.rationale}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-navy-700">
                  <span>Version {t.version}</span>
                  <span>Updated {fmtDate(t.updatedAt)}</span>
                  {t.reviewDate && <span>Review by {fmtDate(t.reviewDate)}</span>}
                  {t._count.evidence > 0 && <Pill className="bg-amber-100 text-amber-800">{t._count.evidence} to review</Pill>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
