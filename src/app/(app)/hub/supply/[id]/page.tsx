import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getAgreement } from "@/server/hub/supply";
import { AppError, NotFoundError } from "@/lib/errors";
import { frequencyLabel, productLabel } from "@/lib/hub/catalog";
import { confirmSupplyDeliveryAction, endAgreementAction, recordDeliveryAction, respondAgreementAction } from "@/app/actions/hub";
import { EmptyState, Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { BusinessName, day, isoDay, qty } from "@/components/hub/bits";
import { AGREEMENT_STATUS } from "@/components/hub/bits";

export const metadata = { title: "Supply agreement" };

export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getAgreement(user, id).catch((e) => { if (e instanceof NotFoundError || e instanceof AppError) notFound(); throw e; });
  const { me, agreement: a, side, deliveries } = data;
  const other = side === "buyer" ? a.seller : a.buyer;
  const confirmed = deliveries.filter((d) => d.buyerConfirmedAt && d.sellerConfirmedAt);
  const mine = side === "buyer" ? "buyerConfirmedAt" : "sellerConfirmedAt";

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/supply">← All agreements</Link></p>
      <PageHeader eyebrow="Recurring supply" title={`${productLabel(a.product)}: ${qty(a.quantity)} ${a.unit} ${frequencyLabel(a.frequency).toLowerCase()}`} subtitle={<>{side === "buyer" ? "Supplied by" : "Supplying"} <BusinessName b={other} /> · from {day(a.startsOn)}{a.deliverTo ? ` · to ${a.deliverTo}` : ""}</>} actions={<Pill className="bg-ink-100 text-ink-900">{AGREEMENT_STATUS[a.status]}</Pill>} />

      {a.status === "PROPOSED" && (
        a.proposedById === me.id ? <Notice title="Waiting for the other business">They will see this proposal in their recurring supply list and can accept or decline it.</Notice> : (
          <div className="card flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">This business proposed a recurring supply with you.</p>
            <div className="flex gap-2">
              <HubForm action={respondAgreementAction} submit="Accept" inline><input type="hidden" name="id" value={a.id} /><input type="hidden" name="accept" value="1" /></HubForm>
              <HubForm action={respondAgreementAction} submit="Decline" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={a.id} /><input type="hidden" name="accept" value="0" /></HubForm>
            </div>
          </div>
        )
      )}

      <dl className="my-6 grid grid-cols-3 gap-3">
        {[["Confirmed by both", confirmed.length], ["Awaiting confirmation", deliveries.length - confirmed.length], ["Quantity confirmed", qty(confirmed.reduce((s, d) => s + d.quantity, 0))]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-ink-100 bg-ink-50 p-3"><dt className="text-xs text-ink-600">{k}</dt><dd className="num mt-1 text-xl font-semibold">{v}</dd></div>
        ))}
      </dl>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="deliveries-h">
          <SectionHeader id="deliveries-h" title="Deliveries" />
          {deliveries.length ? (
            <ul className="space-y-2">
              {deliveries.map((d) => (
                <li key={d.id} className="flex flex-col gap-2 rounded-xl border border-ink-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <p><span className="font-medium">{day(d.deliveredOn)}</span> · <span className="num">{qty(d.quantity)}</span> {a.unit}{d.note ? ` · ${d.note}` : ""}</p>
                    <p className="text-xs text-ink-600">{d.sellerConfirmedAt ? "✓" : "○"} Seller · {d.buyerConfirmedAt ? "✓" : "○"} Buyer</p>
                  </div>
                  {d.buyerConfirmedAt && d.sellerConfirmedAt ? <Pill className="bg-brand-50 text-brand-800">Confirmed by both</Pill> : !d[mine] ? <HubForm action={confirmSupplyDeliveryAction} submit="Confirm this delivery" inline><input type="hidden" name="id" value={d.id} /></HubForm> : <Pill className="bg-ink-50 text-ink-700">Waiting for the other side</Pill>}
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No deliveries recorded yet" />}
        </section>

        {a.status === "ACTIVE" && (
          <aside className="space-y-4">
            <section aria-labelledby="record-h" className="card">
              <h2 id="record-h" className="h-section mb-3">Record a delivery</h2>
              <HubForm action={recordDeliveryAction} submit="Record delivery">
                <input type="hidden" name="agreementId" value={a.id} />
                <div><label htmlFor="deliveredOn" className="label">Delivered on</label><input id="deliveredOn" name="deliveredOn" type="date" className="input" max={isoDay(new Date())} defaultValue={isoDay(new Date())} required /></div>
                <div><label htmlFor="quantity" className="label">Quantity ({a.unit})</label><input id="quantity" name="quantity" type="number" min="0" step="any" className="input num" defaultValue={a.quantity} required /></div>
                <div><label htmlFor="note" className="label">Note</label><input id="note" name="note" className="input" maxLength={500} placeholder="Waybill number, shortfall" /></div>
              </HubForm>
              <p className="mt-2 text-xs text-ink-600">Your side is confirmed when you record it. It counts once the other side confirms too.</p>
            </section>
            <HubForm action={endAgreementAction} submit="End agreement" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={a.id} /></HubForm>
          </aside>
        )}
      </div>
    </>
  );
}
