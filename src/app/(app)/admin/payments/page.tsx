import Link from "next/link";
import { requireRole } from "@/server/auth";
import { gasEarnings, listPayments } from "@/server/admin/money";
import { payoutsDue } from "@/server/everyday/money";
import { markPaidOutAction } from "@/app/actions/admin-tools";
import { PAGE_SIZE, pageOf } from "@/server/admin/guard";
import { grantBusinessPlanAction } from "@/app/actions/hub";
import { naira } from "@/lib/hub/prices";
import { fmtMoney } from "@/lib/data-plans";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Badge, Field, FilterBar, Pager, Select, Stat } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Payments · Administration" };
export const dynamic = "force-dynamic";

type SP = { status?: string; purpose?: string; q?: string; page?: string };

export default async function AdminPayments({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const [{ total, rows, months, purposes, expiring }, gas, payouts] = await Promise.all([listPayments(admin, { ...sp, page }), gasEarnings(admin), payoutsDue()]);
  const payoutTotal = payouts.reduce((a, o) => a + o.payoutNaira, 0);
  const year = months.reduce((a, m) => a + m.naira, 0);
  const yearUsd = months.reduce((a, m) => a + m.usd, 0);
  const max = Math.max(1, ...months.map((m) => m.naira));
  const maxUsd = Math.max(1, ...months.map((m) => m.usd));
  return (
    <>
      <PageHeader eyebrow="Money" title="Payments & plans" subtitle="Plus, Business and Data plans, gas orders paid online and sellers' commission, in naira through Paystack and in US dollars through Paystack USD or Stripe. Revenue charts leave out gas order payments, which are mostly the seller's money; fees and commission are counted separately. Sponsorships are listed under Sponsorships." />
      <section aria-labelledby="gas-h" className="mb-6">
        <h2 id="gas-h" className="sr-only">Gas order earnings</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Service fees, 12 months" value={naira(gas.serviceFees)} sub={`${gas.paidOnline} orders paid online`} tone={gas.serviceFees > 0 ? "good" : "plain"} />
          <Stat label="Commission collected, 12 months" value={naira(gas.commission)} sub={`${gas.commissionOrders} orders`} tone={gas.commission > 0 ? "good" : "plain"} />
          <Stat label="Commission owed by sellers" value={naira(gas.commissionOwed)} sub={`${gas.commissionOwedOrders} cash orders`} />
          <Stat label="Held for sellers" value={naira(payoutTotal)} sub={`${payouts.length} payouts due`} tone={payouts.length ? "warn" : "plain"} />
        </div>
      </section>
      <section className="mb-6 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Naira, last 12 months" value={naira(year)} sub={`this month ${naira(months.at(-1)?.naira ?? 0)}`} />
          <Stat label="US dollars, last 12 months" value={fmtMoney(Math.round(yearUsd * 100), "USD")} sub={`this month ${fmtMoney(Math.round((months.at(-1)?.usd ?? 0) * 100), "USD")}`} tone={yearUsd > 0 ? "good" : "plain"} />
        </div>
        <div className="card">
          <h2 className="h-section">By month</h2>
          {/* Two separate scales: naira and dollar revenue are never added together. */}
          <p className="mt-2 text-[11px] text-ink-500">Naira</p>
          <div role="img" aria-label={`Naira revenue by month: ${months.map((m) => `${m.key} ${naira(m.naira)}`).join(", ")}`} className="flex h-16 items-end gap-1">
            {months.map((m) => <div key={m.key} title={`${m.key}: ${naira(m.naira)}`} className="flex-1 rounded-t bg-navy-500" style={{ height: `${Math.max(2, (m.naira / max) * 100)}%` }} />)}
          </div>
          <p className="mt-2 text-[11px] text-ink-500">US dollars</p>
          <div role="img" aria-label={`Dollar revenue by month: ${months.map((m) => `${m.key} $${m.usd}`).join(", ")}`} className="flex h-16 items-end gap-1">
            {months.map((m) => <div key={m.key} title={`${m.key}: $${m.usd.toLocaleString("en-US")}`} className="flex-1 rounded-t bg-brand-600" style={{ height: `${Math.max(2, (m.usd / maxUsd) * 100)}%` }} />)}
          </div>
          <p className="mt-1 flex justify-between text-[10px] text-ink-500"><span>{months[0].key}</span><span>{months.at(-1)!.key}</span></p>
        </div>
      </section>
      {payouts.length > 0 && (
        <section aria-labelledby="po-h" className="card mb-6">
          <h2 id="po-h" className="h-section">Payouts due to sellers ({payouts.length})</h2>
          <p className="muted mt-1">Delivered orders paid online. Transfer the amount to the seller's bank account, then mark it paid out.</p>
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {payouts.map((o) => <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><Link href={`/hub/businesses/${o.business.id}`}>{o.business.name}</Link> · {o.cylinders} × {o.cylinderKg} kg · delivered {fmtDate(o.deliveredAt)} · price {naira(o.priceNaira ?? 0)} less {naira(o.commissionNaira ?? 0)} commission</span><form action={markPaidOutAction} className="flex items-center gap-2"><span className="num font-semibold">{naira(o.payoutNaira)}</span><input type="hidden" name="orderId" value={o.id} /><button className="btn-secondary btn-sm">Mark paid out</button></form></li>)}
          </ul>
        </section>
      )}
      {expiring.length > 0 && (
        <section aria-labelledby="exp-h" className="card mb-6">
          <h2 id="exp-h" className="h-section">Business plans ending within 14 days ({expiring.length})</h2>
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {expiring.map((b) => <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><Link href={`/hub/businesses/${b.id}`}>{b.name}</Link> · ends {fmtDate(b.planUntil)} · {b.owner.email}</span><form action={grantBusinessPlanAction}><input type="hidden" name="businessId" value={b.id} /><button className="btn-secondary btn-sm">Add 30 days</button></form></li>)}
          </ul>
        </section>
      )}
      <FilterBar action="/admin/payments">
        <Field label="Search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Reference or email" className="input w-56 py-1.5 text-sm" /></Field>
        <Field label="Status"><Select name="status" value={sp.status} options={[["SUCCESS", "Paid"], ["PENDING", "Pending"], ["FAILED", "Failed"]]} /></Field>
        <Field label="Purpose"><Select name="purpose" value={sp.purpose} options={purposes} /></Field>
      </FilterBar>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>When</th><th>Who</th><th>Purpose</th><th>Reference</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(p.createdAt)}</td>
                <td><Link href={`/admin/users/${p.user.id}`}>{p.user.name}</Link><p className="text-xs text-ink-600">{p.user.email}</p></td>
                <td>{p.purpose.toLowerCase().replace(/_/g, " ")}</td>
                <td className="font-mono text-xs">{p.reference}</td>
                <td className="num text-right">{fmtMoney(p.amountKobo, p.currency)}</td>
                <td><Badge tone={p.status === "SUCCESS" ? "good" : p.status === "FAILED" ? "bad" : "plain"}>{p.status.toLowerCase()}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/payments" params={{ ...sp, page: undefined }} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
