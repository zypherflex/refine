import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { lenderQueue, PURPOSES } from "@/server/hub/finance";
import { productLabel, stateName } from "@/lib/hub/catalog";
import { EmptyState, Notice, PageHeader, Pill } from "@/components/ui";
import { BusinessName, day, FINANCE_STATUS, naira } from "@/components/hub/bits";

export const metadata = { title: "Lender desk" };

export default async function LenderPage() {
  const user = await requireUser();
  if (!user.financePartnerId) redirect("/hub");
  const { partner, requests } = await lenderQueue(user);
  return (
    <>
      <PageHeader eyebrow="Finance pilot" title={`Lender desk: ${partner.name}`} subtitle="Businesses that chose to share their confirmed trade record with you. Access ends when they withdraw or after 90 days." />
      <div className="mb-6"><Notice title="How to use these records">The record shows trades both sides confirmed on RefineryLens. It is not audited and is not a credit rating. Do your own checks, agree terms with the business directly, and never ask for an upfront fee through RefineryLens.</Notice></div>
      {requests.length ? (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold"><BusinessName b={r.business} /></p>
                <Pill className={FINANCE_STATUS[r.status]![1]}>{FINANCE_STATUS[r.status]![0]}</Pill>
              </div>
              <p className="mt-1 text-sm text-ink-700"><span className="num">{naira(r.amountNgn)}</span> · {PURPOSES.find((p) => p.id === r.purpose)?.label} · {productLabel(r.product)} · {stateName(r.business.state)} · sent {day(r.createdAt)}</p>
              <Link href={`/hub/lender/${r.id}`} className="mt-2 inline-block text-sm">Open the shared record</Link>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="No shared records yet" />}
    </>
  );
}
