import { requireRole } from "@/server/auth";
import { listSponsorships, PLACEMENTS } from "@/server/sponsor";
import { createSponsorshipAction, toggleSponsorshipAction } from "@/app/actions/admin-tools";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { fmtMoney } from "@/lib/data-plans";
import { fmtDate } from "@/lib/format";
import { AdminForm } from "@/components/admin/forms";
import { Badge, Field, Stat } from "@/components/admin/parts";
import { EmptyState, Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Sponsorships · Administration" };
export const dynamic = "force-dynamic";

export default async function AdminSponsors() {
  const admin = await requireRole("ADMIN");
  const { rows, live, monthlyUsd, bookedUsd } = await listSponsorships(admin);
  const now = new Date();
  return (
    <>
      <PageHeader eyebrow="Money" title="Sponsorships" subtitle="Labelled placements sold to equipment makers and service providers, invoiced in US dollars. One sponsor is shown per placement at a time, rotating by exposure." />
      <section className="mb-6 grid grid-cols-3 gap-3">
        <Stat label="Running now" value={live} />
        <Stat label="Monthly value running" value={fmtMoney(Math.round(monthlyUsd * 100), "USD")} tone={monthlyUsd ? "good" : "plain"} />
        <Stat label="Booked, all time" value={fmtMoney(Math.round(bookedUsd * 100), "USD")} />
      </section>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section aria-labelledby="new-h" className="card">
          <h2 id="new-h" className="h-section">Add a sponsorship</h2>
          <AdminForm action={createSponsorshipAction} submit="Add sponsorship" className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Sponsor"><input name="sponsor" required className="input text-sm" placeholder="e.g. Jiangsu CNG Kits Co." /></Field>
              <Field label="Link (https)"><input name="url" required type="url" className="input text-sm" placeholder="https://" /></Field>
            </div>
            <Field label="Headline (up to 80)"><input name="headline" required maxLength={80} className="input text-sm" /></Field>
            <Field label="Text (up to 220)"><textarea name="body" required maxLength={220} rows={2} className="input text-sm" /></Field>
            <fieldset><legend className="label">Placements</legend><div className="grid gap-1 text-sm sm:grid-cols-2">{PLACEMENTS.map((p) => <label key={p.id} className="flex items-start gap-2"><input type="checkbox" name="placements" value={p.id} className="mt-1" /><span>{p.label}<span className="block text-xs text-ink-500">{p.fits}</span></span></label>)}</div></fieldset>
            <fieldset><legend className="label">States (none ticked = all)</legend><div className="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-ink-100 p-2 text-xs sm:grid-cols-3">{NIGERIAN_STATES.map((st) => <label key={st} className="flex items-center gap-1.5"><input type="checkbox" name="states" value={st} />{st}</label>)}</div></fieldset>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Price, USD"><input name="priceUsd" required inputMode="decimal" className="input text-sm" placeholder="e.g. 1500" /></Field>
              <Field label="Starts"><input name="startsAt" required type="date" className="input text-sm" /></Field>
              <Field label="Ends"><input name="endsAt" required type="date" className="input text-sm" /></Field>
            </div>
          </AdminForm>
          <div className="mt-4"><Notice title="Rules">Every placement says &quot;Sponsored&quot; with the sponsor&apos;s name, links are marked rel=&quot;sponsored&quot;, and sponsors never affect prices, rankings or verification. No sponsor may sell fuel or gas to consumers through a placement.</Notice></div>
        </section>
        <section aria-labelledby="list-h">
          <h2 id="list-h" className="h-section">All sponsorships ({rows.length})</h2>
          {rows.length === 0 ? <EmptyState title="None yet" /> : (
            <ul className="mt-2 space-y-3">
              {rows.map((r) => {
                const running = r.active && r.startsAt <= now && r.endsAt > now;
                return (
                  <li key={r.id} className="card text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="flex flex-wrap items-center gap-1.5 font-semibold">{r.sponsor}<Badge tone={running ? "good" : r.active ? "navy" : "plain"}>{running ? "running" : !r.active ? "paused" : r.endsAt <= now ? "ended" : "scheduled"}</Badge></p>
                        <p className="mt-0.5">{r.headline}</p>
                        <p className="text-xs text-ink-600">{r.placements.join(", ")} · {r.states.length ? r.states.join(", ") : "all states"} · {fmtDate(r.startsAt)} to {fmtDate(r.endsAt)} · {fmtMoney(Math.round(r.priceUsd * 100), "USD")}</p>
                        <p className="text-xs text-ink-600">{r.impressions.toLocaleString("en-GB")} views · {r.clicks.toLocaleString("en-GB")} clicks · {r.impressions ? ((r.clicks / r.impressions) * 100).toFixed(1) : "0.0"}% click rate</p>
                      </div>
                      <form action={toggleSponsorshipAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="active" value={r.active ? "no" : "yes"} /><button className="btn-ghost btn-sm">{r.active ? "Pause" : "Resume"}</button></form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
