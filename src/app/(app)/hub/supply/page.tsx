import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listDirectory } from "@/server/hub/business";
import { myAgreements } from "@/server/hub/supply";
import { FREQUENCIES, frequencyLabel, productLabel, stateName } from "@/lib/hub/catalog";
import { displayName } from "@/lib/hub/rules";
import { proposeAgreementAction } from "@/app/actions/hub";
import { EmptyState, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { hubT } from "@/server/hub/lang";
import { AGREEMENT_STATUS, BusinessName, ProductSelect, UnitSelect, isoDay, qty } from "@/components/hub/bits";

export const metadata = { title: "Recurring supply" };


export default async function SupplyPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const user = await requireUser();
  const { t } = await hubT();
  const sp = await searchParams;
  const [{ me, agreements }, directory] = await Promise.all([myAgreements(user), listDirectory()]);
  const others = directory.filter((b) => b.id !== me?.id);

  return (
    <>
      <PageHeader eyebrow={t("hub.eyebrow")} title={t("supply.title")} subtitle={t("supply.subtitle")} />
      {!me ? (
        <EmptyState title="Add your business first" action={<Link href="/hub/my" className="btn-primary btn-sm no-underline">Add my business</Link>}>Supply agreements are between two businesses on the hub.</EmptyState>
      ) : (
        <>
          <SectionHeader title="Your agreements" note={`${agreements.length} in total`} />
          {agreements.length ? (
            <ul className="space-y-3">
              {agreements.map((a) => {
                const other = a.buyerId === me.id ? a.seller : a.buyer;
                const confirmed = a.deliveries.filter((d) => d.buyerConfirmedAt && d.sellerConfirmedAt).length;
                return (
                  <li key={a.id} className="card">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold"><Link href={`/hub/supply/${a.id}`}>{productLabel(a.product)}: <span className="num">{qty(a.quantity)}</span> {a.unit} {frequencyLabel(a.frequency).toLowerCase()}</Link></h3>
                      <Pill className={a.status === "ACTIVE" ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/30" : "bg-ink-100 text-ink-800"}>{AGREEMENT_STATUS[a.status]}</Pill>
                    </div>
                    <p className="mt-1 text-sm text-ink-700">You {a.buyerId === me.id ? "buy from" : "supply"} <BusinessName b={other} t={t} /></p>
                    <p className="mt-1 text-xs text-ink-600"><span className="num">{confirmed}</span> deliveries confirmed by both sides · <span className="num">{a.deliveries.length - confirmed}</span> awaiting confirmation</p>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted">No agreements yet.</p>}

          <section id="propose" aria-labelledby="propose-h" className="mt-10">
            <SectionHeader id="propose-h" title="Propose a recurring supply" />
            <HubForm action={proposeAgreementAction} submit="Send proposal" className="card space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="myRole" className="label">You are the</label>
                  <select id="myRole" name="myRole" className="input" defaultValue={me.roles.includes("SELLER") && !me.roles.includes("BUYER") ? "SELLER" : "BUYER"}><option value="BUYER">Buyer</option><option value="SELLER">Seller</option></select>
                </div>
                <div>
                  <label htmlFor="counterpartyId" className="label">Other business</label>
                  <select id="counterpartyId" name="counterpartyId" className="input" required defaultValue={sp.with ?? ""}>
                    <option value="">Choose a business</option>
                    {others.map((b) => <option key={b.id} value={b.id}>{displayName(b)}{b.verification === "VERIFIED" ? " (verified)" : ""} · {stateName(b.state)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <ProductSelect value="LPG" />
                <div><label htmlFor="quantity" className="label">Quantity each delivery</label><input id="quantity" name="quantity" type="number" min="0" step="any" className="input num" required /></div>
                <UnitSelect value="kg" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label htmlFor="frequency" className="label">How often</label><select id="frequency" name="frequency" className="input" defaultValue="WEEKLY">{FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select></div>
                <div><label htmlFor="startsOn" className="label">Starting</label><input id="startsOn" name="startsOn" type="date" className="input" defaultValue={isoDay(new Date())} required /></div>
                <div><label htmlFor="deliverTo" className="label">Deliver to</label><input id="deliverTo" name="deliverTo" className="input" maxLength={160} placeholder="Site and town" /></div>
              </div>
              <p className="text-xs text-ink-600">Price and payment terms stay between the two of you and are not stored here. The other business must accept before the agreement starts.</p>
            </HubForm>
          </section>
        </>
      )}
    </>
  );
}
