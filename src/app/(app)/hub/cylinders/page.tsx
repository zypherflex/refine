import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { cylinderOverview, MAX_BATCH, RETEST_YEARS, SIZES_KG } from "@/server/hub/cylinders";
import { recordCylindersAction, registerCylindersAction } from "@/app/actions/hub";
import { EmptyState, Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { BusinessName, day, isoDay } from "@/components/hub/bits";

export const metadata = { title: "Cylinder tracking" };

const EVENT_LABEL: Record<string, string> = { REGISTERED: "Registered", FILLED: "Filled", DISPATCHED: "Handed on", RETURNED: "Returned to owner", TESTED: "Tested", CONDEMNED: "Condemned" };

export default async function CylindersPage() {
  const user = await requireUser();
  const o = await cylinderOverview(user);
  const today = isoDay(new Date());
  const isSeller = !!o && (o.business.roles.includes("SELLER") || o.business.roles.includes("REFINERY"));
  const partners = o ? await db.hubBusiness.findMany({ where: { id: { not: o.business.id }, verification: { not: "SUSPENDED" } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 300 }) : [];
  return (
    <>
      <PageHeader eyebrow="Cylinder recirculation" title="Cylinder tracking" subtitle="Know where every LPG cylinder is, when it was filled and when it is due for its safety test. Buyers can check any serial at the public check page." actions={<Link href="/check-cylinder" className="btn-secondary btn-sm no-underline">Public check page</Link>} />
      {!o ? (
        <EmptyState title="Add your business first" action={<Link href="/hub/my" className="btn-primary btn-sm no-underline">My business</Link>} />
      ) : (
        <>
          <dl className="mb-6 grid gap-3 sm:grid-cols-4">
            <div className="card"><dt className="text-sm text-ink-600">You own</dt><dd className="num text-2xl font-semibold">{o.owned}</dd></div>
            <div className="card"><dt className="text-sm text-ink-600">With you now</dt><dd className="num text-2xl font-semibold">{o.held.length}</dd></div>
            <div className="card"><dt className="text-sm text-ink-600">Test due in 90 days</dt><dd className="num text-2xl font-semibold">{o.dueSoon}</dd></div>
            <div className="card"><dt className="text-sm text-ink-600">Past test date</dt><dd className={`num text-2xl font-semibold ${o.overdue ? "text-amber-800" : ""}`}>{o.overdue}</dd></div>
          </dl>
          {o.overdue > 0 && <div className="mb-6"><Notice tone="warn" title={`${o.overdue} of your cylinders are past their test date`}>They cannot be recorded as filled. Bring them back, test them and record the test, or condemn them.</Notice></div>}

          <section className="mb-8" aria-labelledby="rec-h">
            <SectionHeader id="rec-h" title="Record fills and movements" note={`Up to ${MAX_BATCH} serials at a time, separated by spaces, commas or new lines.`} />
            <HubForm action={recordCylindersAction} submit="Record" className="card space-y-3">
              <div><label htmlFor="serials" className="label">Serial numbers</label><textarea id="serials" name="serials" className="input num" rows={3} required placeholder="IKG-000001 IKG-000002" /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label htmlFor="action" className="label">What happened</label><select id="action" name="action" className="input">{isSeller && <option value="FILL">Filled</option>}<option value="DISPATCH">Handed to another business</option><option value="RETURN">Returned to the owner</option>{o.owned > 0 && <option value="TEST">Tested (owner)</option>}{o.owned > 0 && <option value="CONDEMN">Condemned (owner)</option>}</select></div>
                <div><label htmlFor="toBusinessId" className="label">Handed to (if handed on)</label><select id="toBusinessId" name="toBusinessId" className="input"><option value="">-</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                <div><label htmlFor="testedOn" className="label">Test date (if tested)</label><input id="testedOn" name="testedOn" type="date" className="input" max={today} /></div>
              </div>
              <div><label htmlFor="cnote" className="label">Note (optional)</label><input id="cnote" name="note" className="input" maxLength={300} /></div>
            </HubForm>
          </section>

          {isSeller && (
            <section className="mb-8" aria-labelledby="reg-h">
              <SectionHeader id="reg-h" title="Register cylinders you own" note={`Numbered batches. Next test is set ${RETEST_YEARS} years after the last test.`} />
              <HubForm action={registerCylindersAction} submit="Register" className="card grid gap-3 sm:grid-cols-5 sm:items-end">
                <div><label htmlFor="prefix" className="label">Prefix</label><input id="prefix" name="prefix" className="input num uppercase" required maxLength={12} placeholder="IKG" /></div>
                <div><label htmlFor="from" className="label">First number</label><input id="from" name="from" type="number" min={0} className="input num" required defaultValue={1} /></div>
                <div><label htmlFor="count" className="label">How many</label><input id="count" name="count" type="number" min={1} max={MAX_BATCH} className="input num" required defaultValue={50} /></div>
                <div><label htmlFor="sizeKg" className="label">Size</label><select id="sizeKg" name="sizeKg" className="input" defaultValue="12.5">{SIZES_KG.map((s) => <option key={s} value={s}>{s} kg</option>)}</select></div>
                <div><label htmlFor="lastTestOn" className="label">Last tested</label><input id="lastTestOn" name="lastTestOn" type="date" className="input" max={today} required /></div>
              </HubForm>
            </section>
          )}

          {o.byHolder.length > 0 && (
            <section className="mb-8" aria-labelledby="where-h">
              <SectionHeader id="where-h" title="Where your cylinders are" />
              <ul className="grid gap-2 sm:grid-cols-2">{o.byHolder.map((h) => <li key={h.name} className="flex justify-between rounded-xl border border-ink-100 p-3 text-sm"><span>{h.self ? "With you" : h.name}</span><span className="num">{h.count}</span></li>)}</ul>
            </section>
          )}

          <section className="mb-8" aria-labelledby="held-h">
            <SectionHeader id="held-h" title="With you now" note={o.held.length >= 200 ? "First 200" : undefined} />
            {o.held.length ? (
              <div className="table-wrap">
                <table className="tbl min-w-0">
                  <thead><tr><th scope="col">Serial</th><th scope="col">Owner</th><th scope="col" className="text-right">Size</th><th scope="col">Next test</th></tr></thead>
                  <tbody>{o.held.map((c) => <tr key={c.id}><td className="num">{c.serial}</td><td>{c.ownerId === o.business.id ? "You" : <BusinessName b={c.owner} />}</td><td className="num text-right">{c.sizeKg} kg</td><td className="num">{day(c.nextTestDue)} {c.nextTestDue <= new Date() && <Pill className="bg-amber-100 text-amber-800">Overdue</Pill>}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="muted">None.</p>}
          </section>

          <section aria-labelledby="log-h">
            <SectionHeader id="log-h" title="Recent activity" />
            {o.recent.length ? (
              <ul className="space-y-1 text-sm">{o.recent.map((e) => <li key={e.id}><span className="num">{day(e.at)}</span> · <span className="num">{e.cylinder.serial}</span> · {EVENT_LABEL[e.kind] ?? e.kind} by {e.by.name}{e.note ? ` · ${e.note}` : ""}</li>)}</ul>
            ) : <p className="muted">Nothing yet.</p>}
          </section>
        </>
      )}
    </>
  );
}
