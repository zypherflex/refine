import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getAgreement, reliability } from "@/server/hub/supply";
import { agreementStatusAction, respondAgreementAction } from "@/app/actions/hub";
import { productLabel } from "@/lib/hub/catalog";
import { agreementStatus, agreementStyle, every } from "@/lib/hub/supply";
import { fmtDate } from "@/lib/format";
import { LogDeliveryForm, ReviewDeliveryForm } from "@/components/hub/opsForms";
import { SafetyNote } from "@/components/hub/parts";
import { Notice, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Supply agreement" };

const deliveryStyle = { LOGGED: "bg-amber-100 text-amber-800", CONFIRMED: "bg-teal-100 text-teal-800", DISPUTED: "bg-risk-100 text-risk-800" } as const;
const deliveryLabel = { LOGGED: "Waiting for buyer", CONFIRMED: "✓ Confirmed", DISPUTED: "! Disputed" } as const;

export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { agreement: a, side, awaitingMe, deliveries, next } = await getAgreement(user, id);
  const record = await reliability(a.sellerId);
  const hidden = (k: string, v: string) => <input type="hidden" name={k} value={v} />;
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/supply">← Supply agreements</Link></p>
      <PageHeader
        eyebrow={`${a.buyer.name} buys from ${a.seller.name}`}
        title={`${a.quantity.toLocaleString("en-GB")} ${a.unit} of ${productLabel(a.product)}, ${every[a.frequency]}`}
        subtitle={`Delivered to ${a.deliverTo}, from ${fmtDate(a.startDate)}${a.endDate ? ` to ${fmtDate(a.endDate)}` : ""}`}
        actions={<Pill className={agreementStyle[a.status]}>{agreementStatus[a.status]}</Pill>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {awaitingMe && (
            <Notice tone="info" title={`${side === "BUYER" ? a.seller.name : a.buyer.name} proposed this agreement`}>
              <p className="mb-2">Check the terms, then accept or decline.</p>
              <div className="flex gap-2">
                <form action={respondAgreementAction}>{hidden("agreementId", a.id)}{hidden("accept", "1")}<button className="btn-primary btn-sm">Accept</button></form>
                <form action={respondAgreementAction}>{hidden("agreementId", a.id)}{hidden("accept", "0")}<button className="btn-secondary btn-sm">Decline</button></form>
              </div>
            </Notice>
          )}
          {a.status === "PROPOSED" && !awaitingMe && <Notice title="Waiting for a reply">The other business has been asked to accept or decline.</Notice>}

          <section className="card">
            <h2 className="h-section">Terms</h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-navy-600">Price terms</dt><dd>{a.priceNote || "Not stated"}</dd></div>
              <div><dt className="text-navy-600">Next delivery due</dt><dd className="font-medium">{next ? fmtDate(next) : "–"}</dd></div>
            </dl>
            {a.notes && <p className="mt-3 whitespace-pre-line text-sm text-navy-800">{a.notes}</p>}
          </section>

          {side === "SELLER" && a.status === "ACTIVE" && (
            <section className="card"><h2 className="h-section mb-3">Log a delivery</h2><LogDeliveryForm agreementId={a.id} quantity={a.quantity} unit={a.unit} /></section>
          )}

          <section aria-labelledby="del-h">
            <h2 id="del-h" className="h-section">Deliveries ({deliveries.length})</h2>
            {deliveries.length === 0 ? <p className="muted">{side === "SELLER" ? "Log each delivery after it arrives." : "The seller logs each delivery; you confirm it here."}</p> : (
              <ul className="mt-2 divide-y divide-navy-100 rounded-xl border border-navy-100 bg-white">
                {deliveries.map((d) => (
                  <li key={d.id} className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><span className="font-medium">{fmtDate(d.deliveredOn)}</span> · <span className="num">{d.quantity.toLocaleString("en-GB")} {a.unit}</span></span>
                      <Pill className={deliveryStyle[d.status]}>{deliveryLabel[d.status]}</Pill>
                    </div>
                    {d.buyerNote && <p className="mt-1 text-navy-700">Buyer: {d.buyerNote}</p>}
                    {side === "BUYER" && d.status === "LOGGED" && <ReviewDeliveryForm agreementId={a.id} deliveryId={d.id} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="space-y-4">
          <section className="card">
            <p className="eyebrow">{a.seller.name}&apos;s delivery record</p>
            <p className="num mt-1 text-2xl font-semibold">{record.rate === null ? "No reviews yet" : `${record.rate}% confirmed`}</p>
            <p className="text-xs text-navy-600">{record.confirmed} confirmed, {record.disputed} disputed, across all agreements · {record.activeBuyers} active buyer{record.activeBuyers === 1 ? "" : "s"}</p>
          </section>
          {(a.status === "ACTIVE" || a.status === "PAUSED") && (
            <section className="card flex flex-wrap gap-2">
              {a.status === "ACTIVE" ? (
                <form action={agreementStatusAction}>{hidden("agreementId", a.id)}{hidden("status", "PAUSED")}<button className="btn-secondary btn-sm">Pause</button></form>
              ) : (
                <form action={agreementStatusAction}>{hidden("agreementId", a.id)}{hidden("status", "ACTIVE")}<button className="btn-primary btn-sm">Resume</button></form>
              )}
              <form action={agreementStatusAction}>{hidden("agreementId", a.id)}{hidden("status", "ENDED")}<button className="btn-ghost btn-sm">End agreement</button></form>
            </section>
          )}
          <section className="card"><SafetyNote /></section>
        </aside>
      </div>
    </>
  );
}
