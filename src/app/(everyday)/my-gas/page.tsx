import Link from "next/link";
import { requireUser } from "@/server/auth";
import { myCylinders } from "@/server/everyday/cylinders";
import { myOrders } from "@/server/everyday/orders";
import { naira } from "@/lib/hub/prices";
import { ORDER_STATUS, REMIND_DAYS_BEFORE } from "@/lib/everyday";
import { fmtDate } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/ui";
import { CylinderForm, RefillForm } from "@/components/everyday/forms";
import { deleteCylinderAction, setReminderAction } from "@/app/actions/everyday";

export const metadata = { title: "My cooking gas" };

export default async function MyGasPage() {
  const user = await requireUser("/my-gas");
  const [cylinders, orders] = await Promise.all([myCylinders(user), myOrders(user)]);
  return (
    <>
      <PageHeader eyebrow="Everyday" title="My cooking gas" subtitle={`Log each refill and we work out how long your gas lasts, then remind you ${REMIND_DAYS_BEFORE} days before it is likely to run out.`} actions={<Link href="/order" className="btn-primary btn-sm no-underline">Order a refill</Link>} />
      {cylinders.length === 0 ? (
        <div className="card max-w-2xl"><h2 className="h-section">Track your cylinder</h2><div className="mt-3"><CylinderForm /></div></div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {cylinders.map((c) => {
            const o = c.outlook;
            const low = o.daysLeft !== null && o.daysLeft <= REMIND_DAYS_BEFORE;
            const spend = c.refills.filter((r) => r.priceNaira).slice(0, 6);
            return (
              <li key={c.id} className="card">
                <div className="flex items-start justify-between">
                  <div><p className="font-semibold text-ink-950">{c.label}</p><p className="text-xs text-ink-600">{c.sizeKg} kg cylinder</p></div>
                  <form action={deleteCylinderAction}><input type="hidden" name="cylinderId" value={c.id} /><button className="text-xs text-ink-500 hover:text-risk-700">Remove</button></form>
                </div>
                {o.percentLeft !== null ? (
                  <>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={o.percentLeft} aria-label="Estimated gas left">
                      <div className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-brand-600"}`} style={{ width: `${o.percentLeft}%` }} />
                    </div>
                    <p className="mt-2 text-sm"><strong className="num">About {o.percentLeft}% left</strong> · {o.daysLeft! <= 0 ? "may be empty now" : `runs out around ${fmtDate(o.emptyBy)} (${o.daysLeft} day${o.daysLeft === 1 ? "" : "s"})`}</p>
                    <p className="mt-1 text-xs text-ink-600">Last refilled {fmtDate(o.lastFilled)}. A fill lasts about {o.lastsDays} days ({o.measured ? "measured from your refills" : "your estimate"}).</p>
                  </>
                ) : <p className="mt-3 text-sm text-ink-600">Log your last refill to start the estimate.</p>}
                {spend.length > 0 && <p className="mt-2 text-xs text-ink-600">Recent refills: {spend.map((r) => naira(r.priceNaira!)).join(", ")}</p>}
                <div className="mt-4 border-t border-ink-100 pt-4"><RefillForm cylinderId={c.id} /></div>
                <form action={setReminderAction} className="mt-3 flex items-center gap-2 text-sm">
                  <input type="hidden" name="cylinderId" value={c.id} />
                  <input type="hidden" name="remind" value={c.remind ? "" : "on"} />
                  <span className="text-ink-700">Reminder {c.remind ? "on" : "off"}</span>
                  <button className="text-xs font-medium text-brand-700 underline">{c.remind ? "Turn off" : "Turn on"}</button>
                </form>
              </li>
            );
          })}
          {cylinders.length < 5 && (
            <li className="card"><details><summary className="cursor-pointer font-medium">Add another cylinder</summary><div className="mt-3"><CylinderForm /></div></details></li>
          )}
        </ul>
      )}

      <section aria-labelledby="orders-h" className="mt-8">
        <h2 id="orders-h" className="h-section">My gas orders</h2>
        {orders.length === 0 ? (
          <EmptyState title="No orders yet" action={<Link href="/order" className="btn-primary btn-sm no-underline">Order a refill</Link>}>Order from a verified seller and pay the rider when the gas arrives.</EmptyState>
        ) : (
          <ul className="mt-2 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
            {orders.map((o) => (
              <li key={o.id}><Link href={`/orders/${o.id}`} className="flex items-center justify-between px-4 py-3 text-sm no-underline hover:bg-ink-50 hover:no-underline">
                <span><span className="font-medium text-ink-950">{o.cylinders} × {o.cylinderKg} kg</span> <span className="text-ink-600">from {o.business.name} · {fmtDate(o.createdAt)}</span></span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span>
              </Link></li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
