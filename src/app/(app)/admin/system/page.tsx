import { requireRole } from "@/server/auth";
import { jobHealth } from "@/server/admin/system";
import { retryJobsAction } from "@/app/actions/admin-tools";
import { approveSourceAction, refreshOpenDataAction } from "@/app/actions/opendata";
import { db } from "@/lib/db";
import { latestIngestionRuns } from "@/server/services/market";
import { NOT_INGESTED, PROVIDERS } from "@/server/opendata/catalog";
import { PROVIDER_ORDER } from "@/server/opendata/ingest";
import { integrationStatus } from "@/server/integrations";
import { fmtDateTime } from "@/lib/format";
import { Badge, Stat } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Health & jobs · Administration" };
export const dynamic = "force-dynamic";

export default async function AdminSystem() {
  const admin = await requireRole("ADMIN");
  const [jobs, runs, sources] = await Promise.all([jobHealth(admin), latestIngestionRuns(), db.source.findMany({ where: { marketSeries: { some: {} } }, orderBy: [{ approved: "asc" }, { name: "asc" }], include: { _count: { select: { marketSeries: true } } } })]);
  const st = integrationStatus();
  const groups: [string, [string, boolean, string?][]][] = [
    ["Core", [["PostgreSQL database", st.database], ["Private file storage (local disk)", st.storage.driver === "local" && st.storage.available], ["S3-compatible object storage", st.storage.driver === "s3" && st.storage.available]]],
    ["Messages to people", [
      ["Email alerts", st.email.available, st.email.configured && !st.email.available ? "needs EMAIL_PROVIDER=smtp, SMTP_URL and EMAIL_FROM" : undefined],
      [`SMS / WhatsApp${st.text.provider ? ` (${st.text.provider})` : ""}`, !!st.text.provider, st.text.configured && !st.text.provider ? "provider set but keys missing" : undefined],
      ["Push, Android app (Firebase)", st.push.android], ["Push, iPhone app (APNs)", st.push.ios], ["USSD price check (Africa's Talking)", st.ussd],
    ]],
    ["Money and checks", [
      ["Card payments in naira (Paystack)", st.payments.available, st.payments.configured && !st.payments.available ? "needs PAYMENT_PROVIDER=paystack and PAYSTACK_SECRET_KEY" : undefined],
      ["US dollar payments (Paystack USD)", st.usd.paystack, !st.usd.paystack ? "needs Paystack's approval, a Zenith USD account and PAYSTACK_USD_ENABLED=true" : undefined],
      ["US dollar payments (Stripe, US entity)", st.usd.stripe, st.usd.stripe && !st.usd.stripeWebhook ? "set STRIPE_WEBHOOK_SECRET so webhooks are verified" : !st.usd.stripe ? "needs STRIPE_SECRET_KEY" : undefined],
      ["CAC registry lookup (Dojah)", st.registry],
    ]],
    ["Maps", [["Geocoding for gas sites and drop-off pins (Nominatim)", st.geocoder], ["Custom map tiles for live tracking", !!process.env.NEXT_PUBLIC_MAP_TILE_URL, !process.env.NEXT_PUBLIC_MAP_TILE_URL ? "using OpenStreetMap's public tiles (light use only)" : undefined]]],
    ["Open data", PROVIDER_ORDER.map((id) => [PROVIDERS[id].publisher, st.openData[id].available, st.openData[id].reason || undefined] as [string, boolean, string?])],
  ];
  return (
    <>
      <PageHeader eyebrow="System" title="Health & jobs" subtitle="Which services are connected, the background worker's queue, and the open data feeds." />
      <section aria-label="Background jobs" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {["QUEUED", "RUNNING", "DONE", "FAILED"].map((k) => <Stat key={k} label={`Jobs ${k.toLowerCase()}`} value={jobs.byStatus[k] ?? 0} tone={k === "FAILED" && jobs.byStatus[k] ? "warn" : "plain"} />)}
        <Stat label="Last job finished" value={jobs.lastDone ? fmtDateTime(jobs.lastDone) : "never"} sub="The worker runs with npm run worker" />
      </section>
      {jobs.failed.length > 0 && (
        <section aria-labelledby="failed-h" className="card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="failed-h" className="h-section">Failed jobs ({jobs.failed.length})</h2><form action={retryJobsAction}><button className="btn-secondary btn-sm">Retry all</button></form></div>
          <ul className="mt-2 divide-y divide-ink-100 text-sm">
            {jobs.failed.map((j) => <li key={j.id} className="flex flex-wrap items-start justify-between gap-2 py-2"><span><code className="text-xs">{j.type}</code> · {j.attempts} attempts · {fmtDateTime(j.createdAt)}<span className="block text-xs text-risk-800">{j.error.slice(0, 240)}</span></span><form action={retryJobsAction}><input type="hidden" name="id" value={j.id} /><button className="btn-ghost btn-sm">Retry</button></form></li>)}
          </ul>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="int-h" className="card">
          <h2 id="int-h" className="h-section">Integrations</h2>
          {groups.map(([g, items]) => (
            <div key={g} className="mt-3">
              <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-ink-500">{g}</p>
              <ul className="mt-1 space-y-1 text-sm">{items.map(([n, ok, why]) => <li key={n} className="flex justify-between gap-2"><span>{n}{why && <span className="block text-xs text-ink-500">{why}</span>}</span><Badge tone={ok ? "good" : "plain"}>{ok ? "working" : "not set up"}</Badge></li>)}</ul>
            </div>
          ))}
        </section>
        <section aria-labelledby="od-h" className="card">
          <h2 id="od-h" className="h-section">Open data feeds</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {PROVIDER_ORDER.map((id) => {
              const r = runs.get(id);
              return (
                <li key={id}>
                  <p className="flex justify-between gap-2"><span>{PROVIDERS[id].publisher}</span><Badge tone={!r ? "plain" : r.status === "OK" ? "good" : r.status === "FAILED" ? "bad" : "plain"}>{r ? r.status.toLowerCase() : "never run"}</Badge></p>
                  {r && <p className="text-xs text-ink-700">{fmtDateTime(r.startedAt)} · {r.itemsUpserted} items · {r.message.slice(0, 200)}</p>}
                </li>
              );
            })}
          </ul>
          <h3 className="mt-4 text-sm font-semibold">Sources</h3>
          <p className="text-xs text-ink-600">Readers only see series from an approved source. Check the figures on the market page first.</p>
          <ul className="mt-1 space-y-2 text-sm">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{s.name} <span className="text-xs text-ink-600">· {s._count.marketSeries} series</span></span>
                <form action={approveSourceAction} className="flex items-center gap-2"><input type="hidden" name="id" value={s.id} /><Badge tone={s.approved ? "good" : "plain"}>{s.approved ? "approved" : "awaiting approval"}</Badge><button name="approve" value={s.approved ? "0" : "1"} className="btn-secondary btn-sm">{s.approved ? "Revoke" : "Approve"}</button></form>
              </li>
            ))}
          </ul>
          <form action={refreshOpenDataAction} className="mt-3"><button className="btn-secondary btn-sm">Refresh open data now</button></form>
          <details className="mt-2 text-xs"><summary className="text-brand-700">Free sources checked and not ingested</summary><ul className="mt-1 space-y-1">{NOT_INGESTED.map((n) => <li key={n.name}><span className="font-medium">{n.name}:</span> {n.reason}</li>)}</ul></details>
        </section>
      </div>
    </>
  );
}
