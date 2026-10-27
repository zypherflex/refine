import Link from "next/link";
import { requireRole } from "@/server/auth";
import { reviewQueue, REPORT_REASONS } from "@/server/hub/business";
import { db } from "@/lib/db";
import { productLabel, roleLabel, stateName } from "@/lib/hub/catalog";
import { isProtectedName } from "@/lib/hub/rules";
import { promoteListingAction, resolveReportAction, reviewBusinessAction } from "@/app/actions/hub";
import { EmptyState, Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { BusinessName, day, qty } from "@/components/hub/bits";

export const metadata = { title: "Hub review" };

const reasonLabel = Object.fromEntries(REPORT_REASONS.map((r) => [r.id, r.label]));

function Decide({ businessId, decisions }: { businessId: string; decisions: [string, string][] }) {
  return (
    <HubForm action={reviewBusinessAction} submit="Save decision" className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <input type="hidden" name="businessId" value={businessId} />
      <div><label className="label" htmlFor={`d-${businessId}`}>Decision</label><select id={`d-${businessId}`} name="decision" className="input">{decisions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
      <div><label className="label" htmlFor={`n-${businessId}`}>Note to the business</label><input id={`n-${businessId}`} name="note" className="input" maxLength={500} placeholder="Required to reject or suspend" /></div>
    </HubForm>
  );
}

export default async function ReviewPage() {
  const user = await requireRole("EDITOR");
  const [{ pending, reports, suspended }, listings] = await Promise.all([reviewQueue(user), db.hubListing.findMany({ where: { active: true, expiresAt: { gt: new Date() } }, include: { business: true }, orderBy: { createdAt: "desc" }, take: 30 })]);
  return (
    <>
      <PageHeader eyebrow="Staff" title="Trade hub review" subtitle="Verify businesses after checking CAC registration, licences and phone in person or by call. Keep it strict: never let an unverified business look official." />
      <div className="mb-6"><Notice title="Checklist before verifying">CAC certificate matches the name and number. Licences are current for the products listed. The phone is answered by the business. Names of well-known companies need proof of the relationship.</Notice></div>

      <section className="mb-10" aria-labelledby="pending-h">
        <SectionHeader id="pending-h" title="Waiting for verification" note={`${pending.length}`} />
        {pending.length ? (
          <ul className="space-y-3">
            {pending.map((b) => (
              <li key={b.id} className="card">
                <p className="font-semibold"><BusinessName b={b} /> {isProtectedName(b.name) && <Pill className="bg-amber-100 text-amber-800">Uses a well-known name: “{b.name}”</Pill>}</p>
                <p className="mt-1 text-sm text-ink-700">{b.roles.map(roleLabel).join(", ")} · {stateName(b.state)} · CAC <span className="num">{b.cacNumber}</span> · licences {b.licenceNumbers || "none stated"} · phone <span className="num">{b.phone}</span></p>
                <p className="text-xs text-ink-600">Owner {b.owner.name} ({b.owner.email}) · asked {day(b.verificationAskedAt!)}</p>
                <Decide businessId={b.id} decisions={[["VERIFY", "Verify"], ["REJECT", "Not yet: send back with a note"], ["SUSPEND", "Suspend"]]} />
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Nothing waiting" />}
      </section>

      <section className="mb-10" aria-labelledby="reports-h">
        <SectionHeader id="reports-h" title="Open reports" note={`${reports.length}`} />
        {reports.length ? (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="card">
                <p className="text-sm"><BusinessName b={r.business} /> · <span className="font-medium">{reasonLabel[r.reason] ?? r.reason}</span> · {day(r.createdAt)}</p>
                {r.details && <p className="mt-1 text-sm text-ink-700">{r.details}</p>}
                <div className="mt-2 flex flex-wrap gap-2"><HubForm action={resolveReportAction} submit="Close report" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={r.id} /></HubForm></div>
                <Decide businessId={r.businessId} decisions={[["SUSPEND", "Suspend the business"], ["REJECT", "Remove verification"]]} />
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No open reports" />}
      </section>

      <section className="mb-10" aria-labelledby="promo-h">
        <SectionHeader id="promo-h" title="Paid placement" note="Mark a listing promoted only once it is paid for. It is always labelled." />
        <ul className="space-y-2">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
              <span>{l.promoted && <Pill className="mr-1 bg-ink-800 text-white">Promoted</Pill>}{productLabel(l.product)} · <span className="num">{qty(l.quantity)}</span> {l.unit} · {stateName(l.state)} · <BusinessName b={l.business} /></span>
              <HubForm action={promoteListingAction} submit={l.promoted ? "Remove promotion" : "Promote"} buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={l.id} /><input type="hidden" name="promoted" value={l.promoted ? "0" : "1"} /></HubForm>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="susp-h">
        <SectionHeader id="susp-h" title="Suspended" />
        {suspended.length ? (
          <ul className="space-y-3">{suspended.map((b) => <li key={b.id} className="card"><p className="text-sm"><Link href={`/hub/business/${b.id}`}>{b.name}</Link> · {b.verificationNote}</p><Decide businessId={b.id} decisions={[["REINSTATE", "Reinstate (unverified)"]]} /></li>)}</ul>
        ) : <p className="muted">None.</p>}
      </section>
    </>
  );
}
