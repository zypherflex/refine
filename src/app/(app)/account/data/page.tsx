import Link from "next/link";
import { requireUser } from "@/server/auth";
import { myDataAccount } from "@/server/data/accounts";
import { checkoutAvailable } from "@/server/data/billing";
import { db } from "@/lib/db";
import { revokeKeyAction } from "@/app/actions/data";
import { BILLING_COUNTRIES, currencyFor, dataPlans, fmtMoney, planPrice } from "@/lib/data-plans";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { BuyPlan, NewKeyForm, TrialForm } from "@/components/data/forms";
import { Badge, Stat } from "@/components/admin/parts";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "RefineryLens Data" };
export const dynamic = "force-dynamic";

export default async function DataAccountPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const user = await requireUser("/account/data");
  const { payment } = await searchParams;
  const d = await myDataAccount(user);
  const header = <PageHeader eyebrow="RefineryLens Data" title="Data & API" subtitle="Nigeria's daily pump and cooking-gas price index by state, through a REST API and CSV." actions={<Link href="/data/docs" className="btn-secondary btn-sm no-underline">API documentation</Link>} />;
  if (!d) return (<>{header}<div className="card max-w-2xl"><h2 className="h-section">Start a free trial</h2><p className="muted mb-4">14 days, all states and products, last 30 days of history. No card needed.</p><TrialForm /></div></>);

  const { account: a, plan, active } = d;
  const currency = currencyFor(a.billingCountry);
  const canPay = checkoutAvailable(currency);
  const daysLeft = Math.ceil((a.paidUntil.getTime() - Date.now()) / 86_400_000);
  const activeKeys = a.keys.filter((k) => !k.revokedAt);
  const payments = await db.payment.findMany({ where: { dataAccountId: a.id }, orderBy: { createdAt: "desc" }, take: 12 });
  return (
    <>
      {header}
      {payment === "success" && <div className="mb-4"><Notice tone="ok" title="Payment received">Your plan is active. Thank you.</Notice></div>}
      {payment === "failed" && <div className="mb-4"><Notice tone="warn" title="Payment not completed">Nothing was charged, or the payment is still being confirmed. Try again or contact us.</Notice></div>}
      {!active && <div className="mb-4"><Notice tone="warn" title="Your access has ended">API keys return 402 until you choose a plan below.</Notice></div>}
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Plan" value={plan.name} sub={a.organisation} />
        <Stat label={active ? "Access until" : "Ended"} value={fmtDate(a.paidUntil)} sub={active ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : "renew to continue"} tone={active && daysLeft > 5 ? "plain" : "warn"} />
        <Stat label="Requests today" value={d.usedToday} sub={`of ${plan.requestsPerDay.toLocaleString("en-GB")} a day`} />
        <Stat label="Requests, 30 days" value={d.used30} sub={`Billing: ${BILLING_COUNTRIES.find(([c]) => c === a.billingCountry)?.[1] ?? a.billingCountry} (${currency})`} />
      </section>

      <section aria-labelledby="keys-h" className="card mb-6">
        <h2 id="keys-h" className="h-section">API keys ({activeKeys.length} of {plan.keys})</h2>
        <div className="mt-3"><NewKeyForm disabled={activeKeys.length >= plan.keys} /></div>
        {a.keys.length > 0 && (
          <div className="table-wrap mt-4">
            <table className="tbl">
              <thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th /></tr></thead>
              <tbody>{a.keys.map((k) => (
                <tr key={k.id}><td>{k.name}</td><td className="font-mono text-xs">{k.prefix}…</td><td className="text-xs">{fmtDate(k.createdAt)}</td><td className="text-xs">{k.lastUsedAt ? fmtDateTime(k.lastUsedAt) : "never"}</td>
                  <td>{k.revokedAt ? <Badge>revoked</Badge> : <form action={revokeKeyAction}><input type="hidden" name="keyId" value={k.id} /><button className="btn-ghost btn-sm text-risk-700">Revoke</button></form>}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {active && <p className="mt-4 text-sm"><a href="/api/data/export" download className="btn-secondary btn-sm no-underline">Download the index as CSV</a> <span className="text-xs text-ink-600">Everything your plan covers{plan.historyDays ? ` (last ${plan.historyDays} days)` : ""}.</span></p>}
        <pre className="mt-4 overflow-x-auto rounded-xl bg-ink-950 p-4 text-xs text-ink-100"><code>{`curl -H "Authorization: Bearer rl_live_..." \\\n  "${(process.env.APP_URL ?? "https://app.refinerylens.ng").replace(/\/$/, "")}/api/v1/latest?item=lpg_cyl_12_5&source=PUBLIC"`}</code></pre>
      </section>

      <section aria-labelledby="plans-h" className="mb-6">
        <h2 id="plans-h" className="h-section">Plans · prices in {currency === "USD" ? "US dollars" : "naira"}</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-3">
          {dataPlans().filter((p) => p.id !== "trial").map((p) => {
            const m = planPrice(p, currency, "month");
            const y = planPrice(p, currency, "year");
            return (
              <li key={p.id} className={`card flex flex-col gap-3 ${p.id === a.plan ? "ring-2 ring-brand-600" : ""}`}>
                <div>
                  <p className="flex items-center gap-2 font-semibold text-ink-950">{p.name}{p.id === a.plan && <Badge tone="good">current</Badge>}</p>
                  <p className="text-xs text-ink-600">{p.who}</p>
                  <p className="num mt-2 text-2xl font-semibold">{m !== null ? fmtMoney(m, currency) : p.usdMonthly ? `from $${p.usdMonthly.toLocaleString("en-US")}` : "Ask us"}<span className="text-sm font-normal text-ink-600"> / month</span></p>
                  <ul className="mt-2 space-y-1 text-sm text-ink-700">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
                </div>
                <div className="mt-auto">{m !== null && y !== null ? <BuyPlan plan={p.id} monthly={fmtMoney(m, currency)} yearly={fmtMoney(y, currency)} available={canPay} /> : <a href={`mailto:${process.env.SUPPORT_EMAIL ?? "data@refinerylens.ng"}?subject=RefineryLens%20Data%20Enterprise`} className="btn-secondary btn-sm no-underline">Talk to us</a>}</div>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-600">12 months cost the same as 10. Plans do not renew automatically; we remind you before access ends.</p>
      </section>

      {payments.length > 0 && (
        <section aria-labelledby="pay-h" className="card">
          <h2 id="pay-h" className="h-section">Payments</h2>
          <ul className="mt-2 divide-y divide-ink-100 text-sm">{payments.map((p) => <li key={p.id} className="flex justify-between py-2"><span>{p.planId} · {p.periodDays} days · {fmtDate(p.createdAt)}</span><span className="num">{fmtMoney(p.amountKobo, p.currency)} <Badge tone={p.status === "SUCCESS" ? "good" : p.status === "FAILED" ? "bad" : "plain"}>{p.status.toLowerCase()}</Badge></span></li>)}</ul>
        </section>
      )}
    </>
  );
}
