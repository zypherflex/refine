import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { sellerOrders } from "@/server/everyday/orders";
import { naira } from "@/lib/hub/prices";
import { ORDER_STATUS } from "@/lib/everyday";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { HomeDeliveryForm, OrderStepForm, PaySellerFeesForm } from "@/components/everyday/forms";
import { sellerLedger } from "@/server/everyday/money";
import { feeRules, isPlus } from "@/lib/money";
import { isFeatured } from "@/lib/hub/catalog";
import { DriverLinkForm } from "@/components/tracking/DriverLinkForm";

export const metadata = { title: "Home gas orders" };

export default async function SellerOrdersPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const user = await requireUser();
  const b = await getMyBusiness(user);
  if (!b) return (<><PageHeader eyebrow="My business" title="Home gas orders" /><EmptyState title="Set up your business first" action={<Link href="/hub/me" className="btn-primary btn-sm no-underline">Set up business</Link>}>Gas sellers can deliver refills to households who order on RefineryLens.</EmptyState></>);
  const [orders, ledger, { payment }] = await Promise.all([sellerOrders(user), sellerLedger(user), searchParams]);
  const rules = feeRules();
  const pct = isFeatured(b) ? rules.commissionPercentBusiness : rules.commissionPercent;
  const open = orders.filter((o) => ["PLACED", "ACCEPTED", "OUT_FOR_DELIVERY"].includes(o.status));
  const done = orders.filter((o) => !open.includes(o));
  return (
    <>
      <PageHeader eyebrow="My business" title="Home gas orders" subtitle="Households near you, and Nigerians abroad sending gas to family, order LPG refills. Accept with the final price, then mark it on the way and delivered." />
      {payment === "success" && <div className="mb-4"><Notice tone="ok" title="Payment received">Thank you. Your commission is settled.</Notice></div>}
      {b.verification !== "VERIFIED" && <div className="mb-4"><Notice tone="warn" title="Only verified sellers receive orders">Your settings are saved, but households see your business once RefineryLens has verified it. <Link href="/hub/me">Request verification</Link>.</Notice></div>}
      <section aria-labelledby="open-h" className="mb-8">
        <h2 id="open-h" className="h-section">Open orders ({open.length})</h2>
        {open.length === 0 ? <p className="muted mt-2">No open orders.</p> : (
          <ul className="mt-2 space-y-3">
            {open.map((o) => (
              <li key={o.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-950"><span><Link href={`/orders/${o.id}`}>{o.cylinders} × {o.cylinderKg} kg</Link> for {o.recipientName ? `${o.recipientName} (ordered by ${o.user.name})` : o.user.name}</span>{isPlus(o.user) && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Plus</span>}{o.paidOnlineAt && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">Paid online: do not collect cash</span>}</p>
                    <p className="text-sm text-ink-700">{o.address}, {o.area}, {o.state} · <a href={`tel:${o.phone}`}>{o.phone}</a></p>
                    {o.note && <p className="text-sm text-ink-600">“{o.note}”</p>}
                    <p className="text-xs text-ink-500">{fmtDateTime(o.createdAt)} · estimate {o.estimateNaira ? naira(o.estimateNaira) : "–"}{o.priceNaira ? ` · agreed ${naira(o.priceNaira)}` : ""}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 border-t border-ink-100 pt-3">
                  {o.status === "PLACED" && <><OrderStepForm orderId={o.id} step="accept" estimate={o.estimateNaira} /><OrderStepForm orderId={o.id} step="decline" /></>}
                  {o.status === "ACCEPTED" && <><OrderStepForm orderId={o.id} step="dispatch" /><OrderStepForm orderId={o.id} step="deliver" /></>}
                  {o.status === "OUT_FOR_DELIVERY" && <OrderStepForm orderId={o.id} step="deliver" />}
                </div>
                {o.status !== "PLACED" && (
                  <div className="mt-3 space-y-2">
                    <DriverLinkForm kind="GAS_ORDER" id={o.id} hasLink={!!o.trip} compact />
                    {o.trip && <p className="text-xs text-ink-600">Driver {o.trip.status === "LIVE" ? "is sharing their location" : o.trip.status === "WAITING" ? "has a link but is not sharing yet" : "stopped sharing"}. <Link href={`/orders/${o.id}`}>Watch on the map</Link></p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="money-h" className="card mb-8 max-w-3xl">
        <h2 id="money-h" className="h-section">Your money with RefineryLens</h2>
        <p className="muted mt-1">RefineryLens charges {pct}% of each delivered order{isFeatured(b) ? " (Business plan rate)" : `, or ${rules.commissionPercentBusiness}% on the Business plan`}. For orders paid online we pay you the price less commission; for cash orders you settle the commission here.</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-600">Commission owed on cash orders ({ledger.owed.length})</dt><dd className="num text-xl font-semibold text-ink-950">{naira(ledger.owedNaira)}</dd></div>
          <div className="rounded-xl bg-brand-50 p-3"><dt className="text-xs text-ink-600">RefineryLens owes you for online orders ({ledger.payouts.length})</dt><dd className="num text-xl font-semibold text-brand-800">{naira(ledger.payoutNaira)}</dd></div>
        </dl>
        {ledger.owedNaira > 0 && <div className="mt-3"><PaySellerFeesForm label={`Pay ${naira(ledger.owedNaira)} commission`} /></div>}
      </section>
      <section aria-labelledby="settings-h" className="card mb-8 max-w-3xl">
        <h2 id="settings-h" className="h-section">Home delivery settings</h2>
        <div className="mt-3"><HomeDeliveryForm current={b} /></div>
      </section>
      {done.length > 0 && (
        <section aria-labelledby="done-h">
          <h2 id="done-h" className="h-section">Past orders</h2>
          <div className="table-wrap mt-2">
            <table className="tbl">
              <thead><tr><th>Placed</th><th>Order</th><th>Area</th><th className="text-right">Price</th><th className="text-right">Commission</th><th>Paid</th><th>Status</th><th>Rating</th></tr></thead>
              <tbody>{done.map((o) => <tr key={o.id}><td>{fmtDateTime(o.createdAt)}</td><td>{o.cylinders} × {o.cylinderKg} kg</td><td>{o.area}</td><td className="num text-right">{o.priceNaira ? naira(o.priceNaira) : "–"}</td><td className="num text-right">{o.commissionNaira ? naira(o.commissionNaira) : "–"}</td><td>{o.paidOnlineAt ? (o.payoutAt ? "Online · paid out" : "Online · payout due") : o.status === "DELIVERED" ? "Cash" : "–"}</td><td>{ORDER_STATUS[o.status].label}</td><td>{o.rating ? `${o.rating}★` : "–"}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
