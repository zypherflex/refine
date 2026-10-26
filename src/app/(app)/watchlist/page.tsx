import { integrationStatus } from "@/server/integrations";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { listAlerts } from "@/server/services/alerts";
import { markReadAction, saveWatchAction, setEmailAlertsAction } from "@/app/actions/watchlist";
import { topicLabel, TOPICS } from "@/lib/labels";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, Notice, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Watchlist and alerts" };

const kindLabel: Record<string, string> = { NEW_ANNOUNCEMENT: "New", CORRECTION: "Correction", RETRACTION: "Retraction", SUPERSESSION: "Superseded", THESIS_MATCH: "Thesis evidence" };
const kindStyle: Record<string, string> = { NEW_ANNOUNCEMENT: "bg-brand-100 text-brand-800", CORRECTION: "bg-amber-100 text-amber-800", RETRACTION: "bg-risk-100 text-risk-800", SUPERSESSION: "bg-ink-100 text-ink-800", THESIS_MATCH: "bg-ink-900 text-white" };

export default async function WatchlistPage() {
  const user = await requireUser();
  const [companies, watches, alerts, me] = await Promise.all([db.company.findMany({ orderBy: [{ isFictional: "asc" }, { name: "asc" }] }), db.watchlist.findMany({ where: { userId: user.id } }), listAlerts(user.id), db.user.findUniqueOrThrow({ where: { id: user.id }, select: { emailAlerts: true, email: true } })]);
  const emailConfigured = integrationStatus().email.available;
  return (
    <>
      <PageHeader eyebrow="Your work" title="Watchlist and alerts" subtitle="Choose companies, topics and how often to hear about them. Duplicate alerts are suppressed, and you are told when something you were alerted about is corrected or retracted." />
      <Notice title="How alerts are delivered">
        Alerts appear here in the app. {emailConfigured ? "You can also receive them by email." : "Email and push delivery are not configured in this installation, so RefineryLens does not send alerts outside the app."} Daily and weekly choices group new announcements into a digest; corrections and retractions always arrive immediately.
        {emailConfigured && (
          <form action={setEmailAlertsAction} className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" name="enabled" defaultChecked={me.emailAlerts} className="h-4 w-4 accent-brand-700" />
              Email my alerts to {me.email}
            </label>
            <button className="btn-secondary btn-sm">Save</button>
            {me.emailAlerts && <span className="text-xs text-brand-800">On. New alerts are emailed within a few minutes of appearing here.</span>}
          </form>
        )}
      </Notice>

      <section className="mt-6" aria-labelledby="alerts-h">
        <div className="flex items-baseline justify-between">
          <h2 id="alerts-h" className="h-section">Alerts</h2>
          {alerts.visible.some((a) => !a.readAt) && <form action={markReadAction}><button className="text-sm text-brand-700 hover:underline">Mark all as read</button></form>}
        </div>
        {alerts.queued > 0 && <p className="muted mt-1">{alerts.queued} alert(s) are queued for your next digest.</p>}
        {alerts.visible.length === 0 ? <div className="mt-2"><EmptyState title="No alerts yet" /></div> : (
          <ul className="mt-2 space-y-2">
            {alerts.visible.map((a) => (
              <li key={a.id} className={`card flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between ${a.readAt ? "opacity-75" : "border-brand-600/40"}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2"><Pill className={kindStyle[a.kind] ?? ""}>{kindLabel[a.kind] ?? a.kind}</Pill><span className="text-xs text-ink-700">{fmtDateTime(a.createdAt)}</span>{!a.readAt && <span className="text-xs font-semibold text-brand-800">Unread</span>}</div>
                  <p className="mt-1 font-medium"><Link href={a.link} className="text-ink-950">{a.title}</Link></p>
                  <p className="text-sm text-ink-800">{a.body}</p>
                </div>
                {!a.readAt && <form action={markReadAction}><input type="hidden" name="id" value={a.id} /><button className="btn-secondary btn-sm">Mark read</button></form>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="watch-h">
        <h2 id="watch-h" className="h-section">Companies you follow</h2>
        <div className="mt-2 space-y-3">
          {companies.map((c) => {
            const w = watches.find((x) => x.companyId === c.id);
            return (
              <form key={c.id} action={saveWatchAction} className="card">
                <input type="hidden" name="companyId" value={c.id} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{c.name}</p>
                  {w ? <Pill className="bg-brand-100 text-brand-800">Following</Pill> : <Pill className="bg-ink-100 text-ink-800">Not following</Pill>}
                </div>
                <fieldset className="mt-3">
                  <legend className="label">Topics (leave all unticked for everything)</legend>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {TOPICS.map((t) => <label key={t} className="text-sm"><input type="checkbox" name="topics" value={t} defaultChecked={w?.topics.includes(t)} className="mr-1" />{topicLabel[t]}</label>)}
                  </div>
                </fieldset>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <div><label className="label" htmlFor={`f-${c.id}`}>Frequency</label>
                    <select id={`f-${c.id}`} name="frequency" defaultValue={w?.frequency ?? "IMMEDIATE"} className="input"><option value="IMMEDIATE">As it happens</option><option value="DAILY">Daily digest</option><option value="WEEKLY">Weekly digest</option></select>
                  </div>
                  <button className="btn-primary">{w ? "Save" : "Follow"}</button>
                  {w && <button name="remove" value="1" className="btn-secondary">Stop following</button>}
                </div>
              </form>
            );
          })}
        </div>
      </section>
    </>
  );
}
