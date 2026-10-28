import Link from "next/link";
import { requireUser } from "@/server/auth";
import { myAgreements } from "@/server/hub/supply";
import { productLabel } from "@/lib/hub/catalog";
import { agreementStatus, agreementStyle as style, every } from "@/lib/hub/supply";
import { fmtDate } from "@/lib/format";
import { EmptyState, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Supply agreements" };


export default async function SupplyPage() {
  const user = await requireUser();
  const list = await myAgreements(user);
  return (
    <>
      <PageHeader eyebrow="Trade hub" title="Supply agreements" subtitle="Standing arrangements between a buyer and a seller. The seller logs each delivery and the buyer confirms it, building a delivery record both sides can rely on. Start one from any business's profile." />
      {list.length === 0 ? (
        <EmptyState title="No agreements yet" action={<Link href="/hub" className="btn-secondary btn-sm no-underline">Find a supplier or buyer</Link>}>Open a business profile on the hub and choose “Propose a supply agreement”.</EmptyState>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((a) => {
            const iAmBuyer = a.buyer.ownerId === user.id;
            const other = iAmBuyer ? a.seller : a.buyer;
            return (
              <li key={a.id} className="card">
                <div className="flex flex-wrap items-center gap-2"><Pill className={style[a.status]}>{agreementStatus[a.status]}</Pill><span className="text-xs text-navy-600">You {iAmBuyer ? "buy from" : "supply"} {other.name}</span></div>
                <h2 className="mt-2 text-base font-semibold"><Link href={`/hub/supply/${a.id}`}>{a.quantity.toLocaleString("en-GB")} {a.unit} of {productLabel(a.product)}, {every[a.frequency]}</Link></h2>
                <p className="text-sm text-navy-700">To {a.deliverTo} · from {fmtDate(a.startDate)}{a.endDate ? ` to ${fmtDate(a.endDate)}` : ""}</p>
                <p className="mt-2 text-xs text-navy-600">{a._count.deliveries} deliver{a._count.deliveries === 1 ? "y" : "ies"} logged</p>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
