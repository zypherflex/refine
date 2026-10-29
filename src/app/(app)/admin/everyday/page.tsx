import Link from "next/link";
import { requireRole } from "@/server/auth";
import { blockedReporters, flagQueue } from "@/server/everyday/moderation";
import { resolveFlagsAction, setReportingBlockedAction } from "@/app/actions/everyday";
import { naira } from "@/lib/hub/prices";
import { AUTO_HIDE_FLAGS, EVERYDAY_LABEL, flagReasonLabel, problemLabel, queueLabel } from "@/lib/everyday";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Station report moderation" };

type Person = { id: string; name: string; email: string; reportingBlocked: boolean } | null;

function BlockButton({ person }: { person: Person }) {
  if (!person) return <span className="text-xs text-ink-500">account deleted</span>;
  return (
    <form action={setReportingBlockedAction} className="inline">
      <input type="hidden" name="userId" value={person.id} />
      <input type="hidden" name="blocked" value={person.reportingBlocked ? "no" : "yes"} />
      <span className="text-xs text-ink-600">{person.name} ({person.email}) </span>
      <button className="text-xs font-medium text-risk-700 underline">{person.reportingBlocked ? "Allow reporting again" : "Stop this person reporting"}</button>
    </form>
  );
}

function Decide({ target, id, hidden }: { target: "REPORT" | "OUTLET"; id: string; hidden: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(["HIDE", hidden ? "RESTORE" : "DISMISS"] as const).map((r) => (
        <form key={r} action={resolveFlagsAction}>
          <input type="hidden" name="target" value={target} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="resolution" value={r} />
          <button className={r === "HIDE" ? "btn-primary btn-sm" : "btn-secondary btn-sm"}>{r === "HIDE" ? (hidden ? "Keep hidden" : "Hide") : r === "RESTORE" ? "Restore, flags were wrong" : "Dismiss flags"}</button>
        </form>
      ))}
    </div>
  );
}

export default async function EverydayModerationPage() {
  const admin = await requireRole("ADMIN");
  const [groups, blocked] = await Promise.all([flagQueue(admin), blockedReporters(admin)]);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin">← Administration</Link></p>
      <PageHeader eyebrow="Administration" title="Station report moderation" subtitle={`Reports and places people have flagged. A report flagged by ${AUTO_HIDE_FLAGS} different people is already hidden until you decide; places are hidden only by you.`} />
      <section aria-labelledby="flags-h" className="mb-8">
        <h2 id="flags-h" className="h-section">Flagged ({groups.length})</h2>
        {groups.length === 0 ? <EmptyState title="Nothing flagged" /> : (
          <ul className="mt-3 space-y-4">
            {groups.map((g) => {
              const f0 = g.flags[0];
              const r = f0.report;
              const o = f0.outlet;
              const hidden = r ? r.hidden : !!o?.hidden;
              return (
                <li key={g.key} className="card space-y-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-eyebrow text-ink-500">{r ? "Station report" : "Place"}{hidden ? " · hidden now" : ""}</p>
                      {r ? (
                        <>
                          <p className="mt-1 font-medium">{r.kind === "PRICE" ? `${EVERYDAY_LABEL[r.item as keyof typeof EVERYDAY_LABEL]}: ${naira(r.priceNaira!)}` : r.kind === "AVAILABILITY" ? `${EVERYDAY_LABEL[r.item as keyof typeof EVERYDAY_LABEL]}: ${r.available ? `selling ${queueLabel(r.queue)}` : "not selling"}` : problemLabel(r.problem)}{r.note && <span className="font-normal text-ink-700"> · “{r.note}”</span>}</p>
                          <p className="text-xs text-ink-600">At <Link href={`/stations/${r.outlet.id}`}>{r.outlet.name}</Link>, {r.outlet.area}, {r.outlet.state} · {fmtDateTime(r.createdAt)}</p>
                          <p className="mt-1">Reported by <BlockButton person={r.user} /></p>
                        </>
                      ) : o && (
                        <>
                          <p className="mt-1 font-medium"><Link href={`/stations/${o.id}`}>{o.name}</Link>, {o.area}, {o.state}</p>
                          <p className="mt-1">Added by <BlockButton person={o.addedBy} /></p>
                        </>
                      )}
                    </div>
                    <Decide target={g.target} id={g.id} hidden={hidden} />
                  </div>
                  <ul className="space-y-1 border-t border-ink-100 pt-2 text-xs text-ink-700">
                    {g.flags.map((f) => <li key={f.id}><strong>{flagReasonLabel(f.reason)}</strong>{f.note && ` · “${f.note}”`} · {f.user ? `${f.user.name} (${f.user.email})` : "deleted account"} · {fmtDateTime(f.createdAt)}</li>)}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section aria-labelledby="blocked-h">
        <h2 id="blocked-h" className="h-section">Stopped from reporting ({blocked.length})</h2>
        {blocked.length === 0 ? <p className="muted">Nobody.</p> : (
          <ul className="mt-2 space-y-1">{blocked.map((u) => <li key={u.id}><BlockButton person={{ ...u, reportingBlocked: true }} /></li>)}</ul>
        )}
      </section>
    </>
  );
}
