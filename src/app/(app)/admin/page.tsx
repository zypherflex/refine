import Link from "next/link";
import { requireRole } from "@/server/auth";
import { attentionCounts } from "@/server/admin/attention";
import { dailySeries, overviewStats, usersByState } from "@/server/admin/overview";
import { naira } from "@/lib/hub/prices";
import { DailyBars, Stat } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const admin = await requireRole("ADMIN");
  const [s, a, series, states] = await Promise.all([overviewStats(admin), attentionCounts(admin), dailySeries(admin), usersByState(admin)]);
  const growth = s.newPrev7 ? Math.round(((s.new7 - s.newPrev7) / s.newPrev7) * 100) : null;
  const todo = [
    [a.verifications, "business verification requests", "/admin/hub"],
    [a.hubReports, "open reports about businesses", "/admin/hub"],
    [a.flags, "flagged station reports or places", "/admin/everyday"],
    [a.stuckOrders, "gas orders stuck (no answer in 2 h, or open over a day)", "/admin/orders?view=stuck"],
    [a.staleTrips, "live trips with no position for 30 min", "/admin/trips"],
    [a.failedPayments, "failed payments this week", "/admin/payments?status=FAILED"],
    [a.failedJobs, "failed background jobs", "/admin/system"],
  ] as const;
  const waiting = todo.filter(([n]) => n > 0);

  return (
    <>
      <PageHeader eyebrow="Administration" title="Overview" subtitle="What is happening on RefineryLens, and what needs your attention. Administrators cannot open private files, theses or business messages." />
      <section aria-labelledby="todo-h" className="card mb-6">
        <h2 id="todo-h" className="h-section">Needs attention</h2>
        {waiting.length === 0 ? <p className="mt-2 text-sm text-brand-800">All clear. Nothing is waiting.</p> : (
          <ul className="mt-2 divide-y divide-ink-100">
            {waiting.map(([n, label, href]) => (
              <li key={label}><Link href={href} className="flex items-center justify-between py-2 text-sm no-underline hover:no-underline"><span className="text-ink-800">{label}</span><span className="num rounded-full bg-amber-100 px-2 font-semibold text-amber-800">{n}</span></Link></li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Key numbers" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Accounts" value={s.users} sub={`${s.households.toLocaleString("en-GB")} households · ${s.businessesUsers.toLocaleString("en-GB")} business`} href="/admin/users" />
        <Stat label="New accounts, 7 days" value={s.new7} sub={growth === null ? "no accounts the week before" : `${growth >= 0 ? "+" : ""}${growth}% on the week before`} tone={growth !== null && growth < 0 ? "warn" : "plain"} href="/admin/users?sort=new" />
        <Stat label="Businesses" value={s.businesses} sub={`${s.verified} verified · ${s.activePlans} on the Business plan`} href="/admin/businesses" />
        <Stat label="Live listings" value={s.listings} href="/admin/listings" />
        <Stat label="Gas orders, 7 days" value={s.orders7} sub={`${s.delivered7} delivered`} href="/admin/orders" />
        <Stat label="Drivers sharing now" value={s.liveTrips} href="/admin/trips" tone={s.liveTrips ? "good" : "plain"} />
        <Stat label="Station reports" value={s.reports24} sub={`last 24 h · ${s.reports7} in 7 days · ${s.outlets} places`} href="/admin/outlets" />
        <Stat label="Revenue, 30 days" value={`$${s.revenue30Usd.toLocaleString("en-US")}`} sub={`plus ${naira(s.revenue30Naira)} · ${s.paid30} payment${s.paid30 === 1 ? "" : "s"}`} href="/admin/payments" tone={s.revenue30Usd ? "good" : "plain"} />
      </section>

      <section aria-label="Last 14 days" className="mb-6 grid gap-3 lg:grid-cols-3">
        <div className="card"><h2 className="h-section">New accounts</h2><div className="mt-3"><DailyBars data={series.signups} label="New accounts per day" /></div></div>
        <div className="card"><h2 className="h-section">Gas orders</h2><div className="mt-3"><DailyBars data={series.orders} label="Gas orders per day" /></div></div>
        <div className="card"><h2 className="h-section">Station reports</h2><div className="mt-3"><DailyBars data={series.reports} label="Station reports per day" /></div></div>
      </section>

      <section aria-labelledby="states-h" className="card">
        <h2 id="states-h" className="h-section">Where people are (home state)</h2>
        {states.length === 0 ? <p className="muted mt-2">Nobody has chosen a state yet.</p> : (
          <ul className="mt-3 space-y-1.5">
            {states.map((x) => (
              <li key={x.state} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0">{x.state}</span>
                <span className="h-2 rounded-full bg-navy-500" style={{ width: `${(x.n / states[0].n) * 60}%` }} aria-hidden />
                <span className="num text-ink-700">{x.n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
