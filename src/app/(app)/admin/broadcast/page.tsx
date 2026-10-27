import { requireRole } from "@/server/auth";
import { countRecipients, recentBroadcasts, SEGMENTS, type SegmentId } from "@/server/admin/broadcast";
import { sendBroadcastAction } from "@/app/actions/admin-tools";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { fmtDateTime } from "@/lib/format";
import { AdminForm } from "@/components/admin/forms";
import { Field, Select } from "@/components/admin/parts";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Broadcast · Administration" };
export const dynamic = "force-dynamic";

export default async function AdminBroadcast({ searchParams }: { searchParams: Promise<{ segment?: string; state?: string }> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const segment = (SEGMENTS.some((x) => x.id === sp.segment) ? sp.segment : "all") as SegmentId;
  const state = (NIGERIAN_STATES as readonly string[]).includes(sp.state ?? "") ? sp.state! : null;
  const [count, history] = await Promise.all([countRecipients(admin, segment, state), recentBroadcasts(admin)]);
  const segLabel = SEGMENTS.find((x) => x.id === segment)!.label;
  return (
    <>
      <PageHeader eyebrow="Communication" title="Broadcast" subtitle="Send a notice to a group: a price change, a safety warning, a new feature. It arrives as an in-app alert and a push notification on phones with notifications on. Never by SMS." />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section aria-labelledby="new-h" className="card space-y-4">
          <h2 id="new-h" className="h-section">1. Choose who</h2>
          <form action="/admin/broadcast" className="flex flex-wrap items-end gap-3">
            <Field label="Group"><Select name="segment" value={segment} options={SEGMENTS.map((x) => [x.id, x.label] as const)} all={null} /></Field>
            <Field label="State"><Select name="state" value={state ?? ""} options={NIGERIAN_STATES} all="All states" /></Field>
            <button className="btn-secondary btn-sm">Count</button>
          </form>
          <p className="rounded-xl bg-ink-50 p-3 text-sm"><strong className="num text-lg">{count.toLocaleString("en-GB")}</strong> {count === 1 ? "person" : "people"}: {segLabel.toLowerCase()}{state ? ` in ${state}` : ""}.</p>
          <h2 className="h-section">2. Write and send</h2>
          {count === 0 ? <p className="muted text-sm">Nobody is in this group.</p> : (
            <AdminForm action={sendBroadcastAction} submit={`Send to ${count.toLocaleString("en-GB")} ${count === 1 ? "person" : "people"}`} className="space-y-3">
              <input type="hidden" name="segment" value={segment} />
              <input type="hidden" name="state" value={state ?? ""} />
              <input type="hidden" name="confirmCount" value={count} />
              <Field label="Title (up to 80 characters)"><input name="title" required minLength={5} maxLength={80} className="input text-sm" placeholder="e.g. Cooking gas prices fell this week" /></Field>
              <Field label="Message (up to 400 characters)"><textarea name="body" required minLength={10} maxLength={400} rows={3} className="input text-sm" /></Field>
              <Field label="Opens (a page inside RefineryLens)"><input name="link" defaultValue="/today" className="input font-mono text-sm" /></Field>
            </AdminForm>
          )}
          <Notice title="Before you send">Broadcasts cannot be recalled. Send only what people in this group need, and never ask anyone to pay or share a password.</Notice>
        </section>
        <section aria-labelledby="hist-h">
          <h2 id="hist-h" className="h-section">Sent ({history.length})</h2>
          {history.length === 0 ? <p className="muted mt-2 text-sm">Nothing sent yet.</p> : (
            <ul className="mt-2 space-y-2">
              {history.map((b) => (
                <li key={b.id} className="card py-3 text-sm">
                  <p className="font-medium">{b.title}</p>
                  <p className="text-ink-700">{b.body}</p>
                  <p className="mt-1 text-xs text-ink-600">{SEGMENTS.find((x) => x.id === b.segment)?.label ?? b.segment}{b.state ? `, ${b.state}` : ""} · {b.recipients.toLocaleString("en-GB")} people · {b.read.toLocaleString("en-GB")} opened · {fmtDateTime(b.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
