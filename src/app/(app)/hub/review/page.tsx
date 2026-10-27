import Link from "next/link";
import { requireRole } from "@/server/auth";
import { reviewQueue, REPORT_REASONS } from "@/server/hub/business";
import { db } from "@/lib/db";
import { productLabel, roleLabel, stateName, STATES_BY_NAME } from "@/lib/hub/catalog";
import { activePlan, isProtectedName } from "@/lib/hub/rules";
import { can } from "@/lib/permissions";
import { programmeOverview, PROGRAMME_STATES } from "@/server/hub/field";
import { priceDataSubscribers } from "@/server/hub/priceindex";
import { listPartners } from "@/server/hub/finance";
import { assignVisitAction, decideVisitAction, markPaidAction, promoteListingAction, resolveReportAction, reviewBusinessAction, setBusinessPlanAction, setFieldAgentAction, setPriceDataAction, createPartnerAction, setPartnerActiveAction, setPartnerStaffAction } from "@/app/actions/hub";
import { EmptyState, Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { BusinessName, day, naira, qty } from "@/components/hub/bits";

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

function AssignVisit({ businessId, open, agents }: { businessId: string; open?: string; agents: { id: string; name: string }[] }) {
  if (open) return <p className="mt-2 text-sm text-ink-700">Field visit assigned to {open}.</p>;
  if (!agents.length) return <p className="muted mt-2 text-sm">No field agent covers this state. Check by phone.</p>;
  return (
    <HubForm action={assignVisitAction} submit="Send an agent" buttonClass="btn-secondary btn-sm" className="mt-3 flex flex-wrap items-end gap-2">
      <input type="hidden" name="businessId" value={businessId} />
      <div><label className="label" htmlFor={`a-${businessId}`}>Field visit</label><select id={`a-${businessId}`} name="agentId" className="input w-auto">{agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
    </HubForm>
  );
}

export default async function ReviewPage() {
  const user = await requireRole("EDITOR");
  const isAdmin = can.manageUsers(user);
  const [{ pending, reports, suspended }, listings, field, verified] = await Promise.all([
    reviewQueue(user),
    db.hubListing.findMany({ where: { active: true, expiresAt: { gt: new Date() } }, include: { business: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    programmeOverview(user),
    isAdmin ? db.hubBusiness.findMany({ where: { verification: "VERIFIED" }, orderBy: { name: "asc" }, take: 100 }) : Promise.resolve([]),
  ]);
  const [subscribers, partners] = isAdmin ? await Promise.all([priceDataSubscribers(), listPartners(false)]) : [[], []];
  const openVisit = new Map(field.open.map((v) => [v.businessId, v]));
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
                <AssignVisit businessId={b.id} open={openVisit.get(b.id)?.agent.name} agents={field.agents.filter((a) => a.agentAreas.includes(b.state) && a.hubBusiness?.id !== b.id)} />
                <Decide businessId={b.id} decisions={[["VERIFY", "Verify"], ["REJECT", "Not yet: send back with a note"], ["SUSPEND", "Suspend"]]} />
              </li>
            ))}
          </ul>
        ) : <EmptyState title="Nothing waiting" />}
      </section>

      <section className="mb-10" aria-labelledby="visits-h">
        <SectionHeader id="visits-h" title="Field visit reports" note={`${field.submitted.length} to review`} />
        {field.submitted.length ? (
          <ul className="space-y-3">
            {field.submitted.map((v) => (
              <li key={v.id} className="card">
                <p className="font-semibold"><BusinessName b={v.business} /> · {stateName(v.business.state)}</p>
                <p className="text-xs text-ink-600">{v.agent.name} visited {v.visitedOn ? day(v.visitedOn) : "-"}</p>
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                  {([["CAC certificate seen", v.cacSeen], ["Licences seen", v.licenceSeen], ["Premises visited", v.premisesSeen], ["Phone answered", v.phoneAnswered], ["Product on site", v.productSeen]] as const).map(([l, ok]) => (
                    <li key={l}>{ok ? "✓" : "✗"} {l}</li>
                  ))}
                </ul>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-700">{v.notes}</p>
                <HubForm action={decideVisitAction} submit="Save decision" className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                  <input type="hidden" name="visitId" value={v.id} />
                  <div><label className="label" htmlFor={`vd-${v.id}`}>Decision</label><select id={`vd-${v.id}`} name="decision" className="input"><option value="ACCEPT">Accept and verify the business</option><option value="REJECT">Do not verify: send back</option></select></div>
                  <div><label className="label" htmlFor={`vn-${v.id}`}>Note</label><input id={`vn-${v.id}`} name="note" className="input" maxLength={500} placeholder="Required to send back" /></div>
                </HubForm>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No visit reports waiting" />}
        {field.open.length > 0 && <p className="muted mt-3 text-sm">Out for a visit: {field.open.map((v) => `${v.business.name} (${v.agent.name})`).join(", ")}.</p>}
      </section>

      <section className="mb-10" aria-labelledby="agents-h">
        <SectionHeader id="agents-h" title="Field agents" note={`Programme starts in ${PROGRAMME_STATES.map(stateName).join(" and ")}`} />
        {field.agents.length ? (
          <ul className="mb-4 space-y-2">
            {field.agents.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                <span>{a.name} · {a.email} · {a.agentAreas.map(stateName).join(", ")}</span>
                <HubForm action={setFieldAgentAction} submit="Remove" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="email" value={a.email} /><input type="hidden" name="enabled" value="0" />{a.agentAreas.map((s) => <input key={s} type="hidden" name="areas" value={s} />)}</HubForm>
              </li>
            ))}
          </ul>
        ) : <p className="muted mb-4">No agents yet.</p>}
        <HubForm action={setFieldAgentAction} submit="Add or update agent" className="card space-y-3">
          <input type="hidden" name="enabled" value="1" />
          <div><label className="label" htmlFor="agent-email">Agent's account email</label><input id="agent-email" name="email" type="email" className="input" required /></div>
          <fieldset><legend className="label">States they cover</legend>
            <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">{STATES_BY_NAME.map((s) => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" name="areas" value={s.id} defaultChecked={(PROGRAMME_STATES as readonly string[]).includes(s.id)} /> {s.name}</label>)}</div>
          </fieldset>
        </HubForm>
      </section>

      {isAdmin && (
        <section className="mb-10" aria-labelledby="payouts-h">
          <SectionHeader id="payouts-h" title="Agent payouts" note="Pay by bank transfer, then mark it here." />
          {field.accepted.length ? (
            <ul className="space-y-2">
              {field.accepted.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                  <span>{v.agent.name} · {v.business.name} · <span className="num">{naira(v.payoutNgn)}</span></span>
                  {v.paidAt ? <span className="muted">Paid {day(v.paidAt)}</span> : <HubForm action={markPaidAction} submit="Mark paid" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="visitId" value={v.id} /></HubForm>}
                </li>
              ))}
            </ul>
          ) : <p className="muted">No accepted visits yet.</p>}
        </section>
      )}

      {isAdmin && (
        <section className="mb-10" aria-labelledby="plan-h">
          <SectionHeader id="plan-h" title="Verified Business plan" note="Online payment is not switched on. Set the plan only after payment is agreed and received offline." />
          {verified.length ? (
            <ul className="space-y-2">
              {verified.map((b) => {
                const plan = activePlan(b);
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                    <span>{b.name} · {plan === "VERIFIED_BUSINESS" ? `Verified Business${b.planUntil ? ` until ${day(b.planUntil)}` : ""}` : "Free"}</span>
                    <HubForm action={setBusinessPlanAction} submit="Save plan" buttonClass="btn-secondary btn-sm" className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="businessId" value={b.id} />
                      <select name="plan" aria-label={`Plan for ${b.name}`} className="input w-auto py-1 text-sm" defaultValue={plan}><option value="FREE">Free</option><option value="VERIFIED_BUSINESS">Verified Business</option></select>
                      <select name="months" aria-label={`Months for ${b.name}`} className="input w-auto py-1 text-sm" defaultValue="12">{[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} mo</option>)}</select>
                    </HubForm>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted">No verified businesses yet.</p>}
        </section>
      )}

      {isAdmin && (
        <section className="mb-10" aria-labelledby="pricedata-h">
          <SectionHeader id="pricedata-h" title="Price data subscribers" note="History, CSV and API access. Set after payment is agreed offline; 0 months turns it off and revokes keys." />
          {subscribers.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm">{subscribers.map((s) => <li key={s.id}>{s.name} · {s.email} · {s.priceDataUntil && s.priceDataUntil > new Date() ? `until ${day(s.priceDataUntil)}` : "ended"}</li>)}</ul>
          )}
          <HubForm action={setPriceDataAction} submit="Save access" className="card flex flex-wrap items-end gap-2">
            <div><label className="label" htmlFor="pd-email">Account email</label><input id="pd-email" name="email" type="email" className="input" required /></div>
            <div><label className="label" htmlFor="pd-months">Months</label><select id="pd-months" name="months" className="input w-auto" defaultValue="12">{[0, 1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m === 0 ? "Turn off" : `${m} mo`}</option>)}</select></div>
          </HubForm>
        </section>
      )}

      {isAdmin && (
        <section className="mb-10" aria-labelledby="lenders-h">
          <SectionHeader id="lenders-h" title="Finance pilot lenders" note="Only licensed lenders. RefineryLens shares records with consent; it never lends or holds money." />
          <ul className="mb-4 space-y-3">
            {partners.map((p) => (
              <li key={p.id} className="card text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{p.name} {!p.active && <Pill className="bg-ink-100 text-ink-700">Paused</Pill>}</p>
                  <HubForm action={setPartnerActiveAction} submit={p.active ? "Pause" : "Resume"} buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="partnerId" value={p.id} /><input type="hidden" name="active" value={p.active ? "0" : "1"} /></HubForm>
                </div>
                <p className="text-ink-700">{p.states.length ? p.states.map(stateName).join(", ") : "All states"} · staff: {p.staff.map((s) => s.email).join(", ") || "none yet"}</p>
                <HubForm action={setPartnerStaffAction} submit="Add staff" buttonClass="btn-secondary btn-sm" className="mt-2 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="partnerId" value={p.id} /><input type="hidden" name="add" value="1" />
                  <div><label className="label" htmlFor={`ps-${p.id}`}>Staff account email</label><input id={`ps-${p.id}`} name="email" type="email" className="input" required /></div>
                </HubForm>
              </li>
            ))}
          </ul>
          <HubForm action={createPartnerAction} submit="Add lender" className="card space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label" htmlFor="lp-name">Lender name</label><input id="lp-name" name="name" className="input" required minLength={3} /></div>
              <div><label className="label" htmlFor="lp-desc">What they finance</label><input id="lp-desc" name="description" className="input" maxLength={600} /></div>
            </div>
            <fieldset><legend className="label">States they lend in (none ticked means all)</legend>
              <div className="grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">{STATES_BY_NAME.map((s) => <label key={s.id} className="flex items-center gap-2"><input type="checkbox" name="states" value={s.id} /> {s.name}</label>)}</div>
            </fieldset>
          </HubForm>
        </section>
      )}

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
