import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getOrder } from "@/server/everyday/orders";
import { NotFoundError } from "@/lib/errors";
import { naira } from "@/lib/hub/prices";
import { ORDER_STATUS } from "@/lib/everyday";
import { fmtDateTime } from "@/lib/format";
import { Notice, PageHeader } from "@/components/ui";
import { CancelOrderForm, RateForm } from "@/components/everyday/forms";
import { LiveMap } from "@/components/tracking/LiveMap";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gas order" };

const STEPS = ["PLACED", "ACCEPTED", "OUT_FOR_DELIVERY", "DELIVERED"] as const;

export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ placed?: string }> }) {
  const { id } = await params;
  const { placed } = await searchParams;
  const user = await requireUser(`/orders/${id}`);
  const o = await getOrder(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const isCustomer = o.userId === user.id;
  const at = STEPS.indexOf(o.status as (typeof STEPS)[number]);
  return (
    <>
      <p className="mb-2 text-sm"><Link href={isCustomer ? "/my-gas" : "/hub/orders"}>← {isCustomer ? "My gas" : "Gas orders"}</Link></p>
      <PageHeader eyebrow="Gas order" title={`${o.cylinders} × ${o.cylinderKg} kg refill`} subtitle={`From ${o.business.name} · placed ${fmtDateTime(o.createdAt)}`} actions={<span className={`rounded-full px-3 py-1 text-sm font-medium ${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span>} />
      {placed && <div className="mb-4"><Notice tone="ok" title="Order placed">{o.business.name} has been told. You will get an alert when they accept, with the price to pay on delivery.</Notice></div>}
      {["ACCEPTED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status) && (
        <div className="mb-6"><LiveMap kind="gas-order" id={o.id} waitingText={isCustomer ? "When the seller's driver starts sharing their location, you will see them on a map here." : "Send your driver a link from Home gas orders to show their location here."} /></div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="card">
          {at >= 0 ? (
            <ol className="space-y-3" aria-label="Progress">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${i <= at ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-500"}`}>{i + 1}</span>
                  <span className={i <= at ? "font-medium text-ink-950" : "text-ink-500"}>{ORDER_STATUS[s].label}{i === at ? " (now)" : ""}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-ink-700">This order was {ORDER_STATUS[o.status].label.toLowerCase()}.{o.sellerNote ? ` Seller's note: “${o.sellerNote}”` : ""}</p>}
          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-100 pt-4 text-sm">
            <div><dt className="text-xs text-ink-600">Estimate</dt><dd className="num font-semibold">{o.estimateNaira ? naira(o.estimateNaira) : "–"}</dd></div>
            <div><dt className="text-xs text-ink-600">To pay on delivery</dt><dd className="num text-lg font-semibold text-ink-950">{o.priceNaira ? naira(o.priceNaira) : "Seller confirms on accepting"}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-ink-600">Deliver to</dt><dd>{o.address}, {o.area}, {o.state} · {o.phone}</dd></div>
            {o.note && <div className="col-span-2"><dt className="text-xs text-ink-600">Note</dt><dd>{o.note}</dd></div>}
          </dl>
        </section>
        <aside className="space-y-4">
          {isCustomer && ["PLACED", "ACCEPTED"].includes(o.status) && <div className="card"><p className="mb-2 text-sm text-ink-700">Changed your mind? You can cancel until the gas leaves.</p><CancelOrderForm orderId={o.id} /></div>}
          {isCustomer && o.status === "DELIVERED" && (o.rating ? <div className="card text-sm">You rated this delivery <strong>{o.rating}★</strong>. Thank you.</div> : <div className="card"><RateForm orderId={o.id} /></div>)}
          {isCustomer && o.status === "DELIVERED" && <div className="card text-sm"><Link href="/my-gas">Log this refill on your tracker</Link> to keep your reminder accurate.</div>}
          <Notice title="Pay on delivery only">Pay the rider in cash or by transfer once you have checked the cylinder. RefineryLens never asks for payment in advance for gas orders.</Notice>
        </aside>
      </div>
    </>
  );
}
