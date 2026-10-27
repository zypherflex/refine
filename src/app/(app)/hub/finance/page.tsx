import Link from "next/link";
import { requireUser } from "@/server/auth";
import { myBusiness } from "@/server/hub/business";
import { financeEligibility, listPartners, myFinanceRequests, PURPOSES, SHARE_DAYS, tradeRecord } from "@/server/hub/finance";
import { PRODUCTS, stateName } from "@/lib/hub/catalog";
import { requestFinanceAction, withdrawFinanceAction } from "@/app/actions/hub";
import { EmptyState, Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { TradeRecord } from "@/components/hub/TradeRecord";
import { day, FINANCE_STATUS, naira } from "@/components/hub/bits";

export const metadata = { title: "Stock finance" };

export default async function FinancePage() {
  const user = await requireUser();
  const b = await myBusiness(user);
  const [allPartners, requests] = await Promise.all([listPartners(), myFinanceRequests(user)]);
  const partners = allPartners.filter((p) => !b || !p.states.length || p.states.includes(b.state));
  const elig = b ? await financeEligibility(b.id, b.verification) : null;
  const record = b && elig?.eligible ? await tradeRecord(b.id) : null;
  return (
    <>
      <PageHeader eyebrow="Finance pilot" title="Money for stock, backed by your record" subtitle="Share your confirmed trade record with a licensed lender in the pilot and ask for stock or working-capital finance. The lender decides and lends directly." />
      <div className="mb-6">
        <Notice tone="warn" title="RefineryLens does not lend or hold money">
          We share your record only with the lender you choose, only with your consent, and for {SHARE_DAYS} days unless you withdraw sooner. Any offer, rate and repayment terms come from the lender. Never pay anyone a fee to “unlock” a loan.
        </Notice>
      </div>

      {!b ? (
        <EmptyState title="Add your business first" action={<Link href="/hub/my" className="btn-primary btn-sm no-underline">My business</Link>}>Finance requests come from businesses with a trade record on RefineryLens.</EmptyState>
      ) : !elig!.eligible ? (
        <section className="card mb-8" aria-labelledby="ready-h">
          <h2 id="ready-h" className="h-section">Not ready yet</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{elig!.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="muted mt-2 text-sm">Confirmed delivery jobs and recurring supply deliveries build your record. Ask your customers and hauliers to confirm each delivery.</p>
        </section>
      ) : (
        <>
          <section className="mb-8" aria-labelledby="record-h">
            <SectionHeader id="record-h" title="What the lender will see" note="Your profile, verification, reliability score and this record. Not your customers' names or your messages." />
            <div className="card"><TradeRecord record={record!} /></div>
          </section>
          <section className="mb-8" aria-labelledby="ask-h">
            <SectionHeader id="ask-h" title="Ask a lender" />
            {partners.length ? (
              <HubForm action={requestFinanceAction} submit="Share my record and send" className="card space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor="partnerId" className="label">Lender</label><select id="partnerId" name="partnerId" className="input" required>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}{p.states.length ? ` (${p.states.map(stateName).join(", ")})` : ""}</option>)}</select></div>
                  <div><label htmlFor="amountNgn" className="label">Amount (₦)</label><input id="amountNgn" name="amountNgn" className="input num" inputMode="numeric" placeholder="2,000,000" required /></div>
                  <div><label htmlFor="purpose" className="label">What it is for</label><select id="purpose" name="purpose" className="input">{PURPOSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
                  <div><label htmlFor="fproduct" className="label">Product</label><select id="fproduct" name="product" className="input" defaultValue={b.products[0]}>{PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
                </div>
                <div><label htmlFor="notes" className="label">Anything the lender should know (optional)</label><textarea id="notes" name="notes" className="input" rows={2} maxLength={1000} /></div>
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="consent" className="mt-1" /> I agree to share my business profile, verification, reliability score and 12-month confirmed trade record with this lender for {SHARE_DAYS} days. I can withdraw at any time.</label>
                <ul className="muted text-xs">{partners.map((p) => p.description && <li key={p.id}><span className="font-medium">{p.name}:</span> {p.description}</li>)}</ul>
              </HubForm>
            ) : <EmptyState title="No lender has joined the pilot yet">We will show lenders here as they sign up. Your record keeps building in the meantime.</EmptyState>}
          </section>
        </>
      )}

      <section aria-labelledby="mine-h">
        <SectionHeader id="mine-h" title="Your requests" />
        {requests.length ? (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-xl border border-ink-100 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><Pill className={FINANCE_STATUS[r.status]![1]}>{FINANCE_STATUS[r.status]![0]}</Pill> {r.partner.name} · <span className="num">{naira(r.amountNgn)}</span> · sent {day(r.createdAt)}{r.status !== "WITHDRAWN" ? ` · shared until ${day(r.shareUntil)}` : ""}</span>
                  {r.status !== "WITHDRAWN" && <HubForm action={withdrawFinanceAction} submit="Withdraw and stop sharing" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={r.id} /></HubForm>}
                </div>
                {r.partnerNote && <p className="mt-1 text-ink-700">“{r.partnerNote}”</p>}
              </li>
            ))}
          </ul>
        ) : <p className="muted">None yet.</p>}
      </section>
    </>
  );
}
