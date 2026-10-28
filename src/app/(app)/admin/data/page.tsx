import Link from "next/link";
import { requireRole } from "@/server/auth";
import { listDataAccounts } from "@/server/admin/data";
import { backfillIndexAction, setDataPlanAction } from "@/app/actions/admin-tools";
import { dataPlans, fmtMoney } from "@/lib/data-plans";
import { fmtDate } from "@/lib/format";
import { AdminForm } from "@/components/admin/forms";
import { Badge, Field, Select, Stat } from "@/components/admin/parts";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Data customers · Administration" };
export const dynamic = "force-dynamic";

export default async function AdminData() {
  const admin = await requireRole("ADMIN");
  const d = await listDataAccounts(admin);
  return (
    <>
      <PageHeader eyebrow="Money" title="Data customers" subtitle="Companies using the RefineryLens Data API. Foreign customers pay in US dollars; customers billed in Nigeria pay in naira." actions={<Link href="/data" className="btn-secondary btn-sm no-underline">Public data page</Link>} />
      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Recurring revenue, USD" value={fmtMoney(d.mrr.USD * 100, "USD")} sub="a month, at list price" tone={d.mrr.USD ? "good" : "plain"} />
        <Stat label="Recurring revenue, naira" value={fmtMoney(d.mrr.NGN * 100, "NGN")} sub="a month, at list price" />
        <Stat label="Paying accounts" value={d.paying} />
        <Stat label="On trial" value={d.trials} />
        <Stat label="Index rows" value={d.indexRows} sub={d.lastDay ? `latest ${d.lastDay.toISOString().slice(0, 10)}` : "not built yet"} />
      </section>
      <section className="card mb-6 max-w-xl">
        <h2 className="h-section">Rebuild the price index</h2>
        <p className="muted text-sm">The worker rebuilds yesterday and today every hour. Rebuild further back after setting up, or after hiding many reports.</p>
        <AdminForm action={backfillIndexAction} submit="Rebuild" className="mt-2"><Field label="Days back"><input name="days" type="number" min={1} max={365} defaultValue={30} className="input w-28 py-1 text-sm" /></Field></AdminForm>
      </section>
      {d.rows.length === 0 ? <EmptyState title="No data customers yet">People start a trial at /account/data.</EmptyState> : (
        <ul className="space-y-3">
          {d.rows.map((a) => (
            <li key={a.id} className="card text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold">{a.organisation}<Badge tone={a.plan === "trial" ? "navy" : "good"}>{a.plan}</Badge>{!a.active && <Badge tone="bad">ended</Badge>}<Badge>{a.currency}</Badge></p>
                  <p className="text-xs text-ink-600"><Link href={`/admin/users/${a.user.id}`}>{a.user.name}</Link> ({a.user.email}) · billed in {a.billingCountry} · until {fmtDate(a.paidUntil)} · {a.keys.filter((k) => !k.revokedAt).length} active keys · {a.requests30.toLocaleString("en-GB")} requests in 30 days</p>
                </div>
                <details className="text-xs"><summary className="cursor-pointer font-medium text-brand-700">Set plan (after an invoice is paid)…</summary>
                  {/* Keyed on the plan so the form shows the new plan after saving, not the one it was opened with. */}
                  <AdminForm key={`${a.plan}-${a.paidUntil.getTime()}`} action={setDataPlanAction} submit="Set plan" className="mt-2 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <Field label="Plan"><Select name="plan" value={a.plan} options={dataPlans().map((p) => [p.id, p.name] as const)} all={null} /></Field>
                    <Field label="Days to add"><input name="days" type="number" min={1} max={800} defaultValue={365} className="input w-24 py-1 text-sm" /></Field>
                  </AdminForm>
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
