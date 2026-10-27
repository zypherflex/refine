import { requireUser } from "@/server/auth";
import { myVisits, payoutNgn } from "@/server/hub/field";
import { stateName } from "@/lib/hub/catalog";
import { submitVisitAction } from "@/app/actions/hub";
import { EmptyState, Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { day, naira } from "@/components/hub/bits";
import { redirect } from "next/navigation";

export const metadata = { title: "Field visits" };

const STATUS: Record<string, [string, string]> = {
  ASSIGNED: ["To visit", "bg-ink-100 text-ink-800"],
  SUBMITTED: ["Waiting for review", "bg-amber-100 text-amber-800"],
  ACCEPTED: ["Accepted", "bg-brand-100 text-brand-800"],
  REJECTED: ["Not accepted", "bg-red-100 text-red-800"],
  CANCELLED: ["Cancelled", "bg-ink-100 text-ink-600"],
};

const CHECKS: [string, string][] = [
  ["cacSeen", "I saw the CAC certificate and the name and number match"],
  ["licenceSeen", "I saw current licences for the products they list"],
  ["premisesSeen", "I visited the premises at the address given"],
  ["phoneAnswered", "I called the listed phone and the business answered"],
  ["productSeen", "I saw product, tanks or trucks on site"],
];

export default async function FieldPage() {
  const user = await requireUser();
  if (!user.fieldAgent) redirect("/hub");
  const { visits, earnings } = await myVisits(user);
  const todo = visits.filter((v) => v.status === "ASSIGNED");
  const done = visits.filter((v) => v.status !== "ASSIGNED");
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader eyebrow="Field verification" title="Your visits" subtitle="Visit each business, check what is on the list, and report only what you saw yourself. Never take money or gifts from a business you visit." />
      <dl className="mb-8 grid gap-3 sm:grid-cols-3">
        <div className="card"><dt className="text-sm text-ink-600">Accepted visits</dt><dd className="num text-2xl font-semibold">{earnings.accepted}</dd></div>
        <div className="card"><dt className="text-sm text-ink-600">Owed to you</dt><dd className="num text-2xl font-semibold">{naira(earnings.owed)}</dd></div>
        <div className="card"><dt className="text-sm text-ink-600">Paid so far</dt><dd className="num text-2xl font-semibold">{naira(earnings.paid)}</dd></div>
      </dl>
      <p className="muted mb-6 text-sm">Each accepted visit pays {naira(payoutNgn())}. The team pays by bank transfer and marks it here; RefineryLens does not move money in the app.</p>

      <section className="mb-10" aria-labelledby="todo-h">
        <SectionHeader id="todo-h" title="To visit" note={`${todo.length}`} />
        {todo.length ? (
          <ul className="space-y-4">
            {todo.map((v) => (
              <li key={v.id} className="card">
                <p className="font-semibold">{v.business.name}</p>
                <p className="text-sm text-ink-700">{v.business.town ? `${v.business.town}, ` : ""}{stateName(v.business.state)} · phone <span className="num">{v.business.phone}</span> · CAC <span className="num">{v.business.cacNumber}</span></p>
                <p className="text-xs text-ink-600">Assigned {day(v.createdAt)}</p>
                <HubForm action={submitVisitAction} submit="Send report" className="mt-4 space-y-3">
                  <input type="hidden" name="visitId" value={v.id} />
                  <fieldset className="space-y-2">
                    <legend className="label">What you checked</legend>
                    {CHECKS.map(([k, l]) => (
                      <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" name={k} className="mt-1" /> {l}</label>
                    ))}
                  </fieldset>
                  <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                    <div><label className="label" htmlFor={`d-${v.id}`}>Date of visit</label><input id={`d-${v.id}`} type="date" name="visitedOn" className="input" max={today} defaultValue={today} required /></div>
                    <div><label className="label" htmlFor={`n-${v.id}`}>What you saw</label><textarea id={`n-${v.id}`} name="notes" className="input" rows={3} minLength={10} maxLength={2000} required placeholder="Who you met, what was on site, anything that did not match" /></div>
                  </div>
                </HubForm>
              </li>
            ))}
          </ul>
        ) : <EmptyState title="No visits assigned">The review team assigns visits in your states. You will see them here.</EmptyState>}
      </section>

      <section aria-labelledby="done-h">
        <SectionHeader id="done-h" title="Past visits" />
        {done.length ? (
          <ul className="space-y-2">
            {done.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                <span><Pill className={STATUS[v.status][1]}>{STATUS[v.status][0]}</Pill> {v.business.name} · visited {v.visitedOn ? day(v.visitedOn) : "-"}{v.reviewNote ? ` · “${v.reviewNote}”` : ""}</span>
                {v.status === "ACCEPTED" && <span className="num">{naira(v.payoutNgn)} {v.paidAt ? `paid ${day(v.paidAt)}` : "owed"}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="muted">None yet.</p>}
      </section>
      <div className="mt-8"><Notice tone="warn" title="Stay safe">Visit in daylight, tell the team before you go, and leave if anyone asks you to approve a business without the checks.</Notice></div>
    </>
  );
}
