import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { userDetail } from "@/server/admin/users";
import { NotFoundError } from "@/lib/errors";
import { changeAudienceAction, changePlanAction, changeRoleAction, revokeSessionsAction } from "@/app/actions/admin";
import { setReportingBlockedAction } from "@/app/actions/everyday";
import { naira } from "@/lib/hub/prices";
import { fmtMoney } from "@/lib/data-plans";
import { EVERYDAY_LABEL, ORDER_STATUS, problemLabel } from "@/lib/everyday";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { Badge, Stat } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "User · Administration" };
export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 py-2.5 last:border-0"><span className="text-sm text-ink-600">{label}</span><span className="text-sm">{children}</span></div>;
}

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const d = await userDetail(admin, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const u = d.user;
  const self = u.id === admin.id;
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin/users">← Users</Link></p>
      <PageHeader eyebrow={u.audience === "PERSONAL" ? "Household" : "Business account"} title={u.name} subtitle={`${u.email}${u.phone ? ` · ${u.phone}` : ""} · joined ${fmtDate(u.createdAt)}${u.homeState ? ` · ${u.homeState}` : ""}`} actions={<span className="flex gap-1">{u.role !== "USER" && <Badge tone="navy">{u.role.toLowerCase()}</Badge>}{u.reportingBlocked && <Badge tone="bad">stopped from reporting</Badge>}</span>} />

      <section aria-label="Activity" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Gas orders" value={u._count.gasOrders} />
        <Stat label="Station reports" value={u._count.outletReports} sub={`${u._count.outletsAdded} places added`} />
        <Stat label="Flags sent" value={u._count.contentFlags} />
        <Stat label="Signed in on" value={`${d.sessions.length} device${d.sessions.length === 1 ? "" : "s"}`} sub={`${u._count.devices} with notifications`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="acct-h" className="card">
          <h2 id="acct-h" className="h-section">Account controls</h2>
          <div className="mt-2">
            <Row label="Role">
              <form action={changeRoleAction} className="flex gap-1"><input type="hidden" name="userId" value={u.id} />
                <select name="role" defaultValue={u.role} className="input py-1" aria-label="Role" disabled={self}>{["USER", "ANALYST", "EDITOR", "ADMIN"].map((r) => <option key={r}>{r}</option>)}</select>
                {!self && <button className="btn-secondary btn-sm">Set</button>}
              </form>
            </Row>
            <Row label="Research plan">
              <form action={changePlanAction} className="flex gap-1"><input type="hidden" name="userId" value={u.id} />
                <select name="plan" defaultValue={u.plan} className="input py-1" aria-label="Plan">{["FREE", "PRO", "TEAM"].map((r) => <option key={r}>{r}</option>)}</select>
                <button className="btn-secondary btn-sm">Set</button>
              </form>
            </Row>
            <Row label="Starts on">
              <form action={changeAudienceAction} className="flex gap-1"><input type="hidden" name="userId" value={u.id} />
                <select name="audience" defaultValue={u.audience} className="input py-1" aria-label="Starts on"><option value="PERSONAL">Today&apos;s prices (household)</option><option value="BUSINESS">Trade hub (business)</option></select>
                <button className="btn-secondary btn-sm">Set</button>
              </form>
            </Row>
            <Row label="Station reports">
              {self ? <span className="text-ink-500">–</span> : (
                <form action={setReportingBlockedAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="blocked" value={u.reportingBlocked ? "no" : "yes"} />
                  <button className={u.reportingBlocked ? "btn-secondary btn-sm" : "btn-ghost btn-sm text-risk-700"}>{u.reportingBlocked ? "Allow reporting again" : "Stop this person reporting"}</button>
                </form>
              )}
            </Row>
            <Row label={`Signed in on ${d.sessions.length} device${d.sessions.length === 1 ? "" : "s"}`}>
              <form action={revokeSessionsAction}><input type="hidden" name="userId" value={u.id} /><button className="btn-ghost btn-sm text-risk-700" disabled={!d.sessions.length}>Sign out everywhere</button></form>
            </Row>
          </div>
          <p className="mt-3 text-xs text-ink-600">Private files ({u._count.documents}), theses ({u._count.theses}) and business conversations ({u._count.hubThreads}) are counted but never shown to administrators.</p>
        </section>

        <section aria-labelledby="biz-h" className="card">
          <h2 id="biz-h" className="h-section">Business</h2>
          {u.hubBusiness ? (
            <div className="mt-2 text-sm">
              <p><Link href={`/hub/businesses/${u.hubBusiness.id}`} className="font-medium">{u.hubBusiness.name}</Link> <Badge tone={u.hubBusiness.verification === "VERIFIED" ? "good" : u.hubBusiness.verification === "SUSPENDED" ? "bad" : "plain"}>{u.hubBusiness.verification.toLowerCase().replace("_", " ")}</Badge></p>
              <p className="mt-1 text-ink-600">{u.hubBusiness.roles.join(", ").toLowerCase()} · {u.hubBusiness.state}{u.hubBusiness.planUntil && u.hubBusiness.planUntil > new Date() ? ` · Business plan until ${fmtDate(u.hubBusiness.planUntil)}` : ""}</p>
              <p className="mt-2"><Link href={`/admin/businesses?q=${encodeURIComponent(u.hubBusiness.name)}`}>Manage in Businesses</Link></p>
            </div>
          ) : <p className="muted mt-2">No business profile.</p>}
          <h3 className="mt-5 text-sm font-semibold">Payments</h3>
          {d.payments.length ? <ul className="mt-1 space-y-1 text-sm">{d.payments.map((p) => <li key={p.id} className="flex justify-between"><span>{p.purpose.toLowerCase().replace(/_/g, " ")} · {fmtDate(p.createdAt)}</span><span className="num">{fmtMoney(p.amountKobo, p.currency)} <Badge tone={p.status === "SUCCESS" ? "good" : p.status === "FAILED" ? "bad" : "plain"}>{p.status.toLowerCase()}</Badge></span></li>)}</ul> : <p className="muted mt-1 text-sm">None.</p>}
        </section>

        <section aria-labelledby="orders-h" className="card">
          <h2 id="orders-h" className="h-section">Recent gas orders</h2>
          {d.orders.length ? <ul className="mt-2 divide-y divide-ink-100 text-sm">{d.orders.map((o) => <li key={o.id} className="flex justify-between py-1.5"><Link href={`/orders/${o.id}`}>{o.cylinders} × {o.cylinderKg} kg from {o.business.name}</Link><span className={`rounded-full px-2 text-xs ${ORDER_STATUS[o.status].tone}`}>{ORDER_STATUS[o.status].label}</span></li>)}</ul> : <p className="muted mt-2 text-sm">None.</p>}
        </section>

        <section aria-labelledby="reports-h" className="card">
          <h2 id="reports-h" className="h-section">Recent station reports</h2>
          {d.reports.length ? <ul className="mt-2 divide-y divide-ink-100 text-sm">{d.reports.map((r) => <li key={r.id} className="py-1.5"><Link href={`/stations/${r.outlet.id}`}>{r.outlet.name}</Link>: {r.kind === "PRICE" ? `${EVERYDAY_LABEL[r.item as keyof typeof EVERYDAY_LABEL]} ${naira(r.priceNaira!)}` : r.kind === "PROBLEM" ? problemLabel(r.problem) : `${EVERYDAY_LABEL[r.item as keyof typeof EVERYDAY_LABEL]} ${r.available ? "selling" : "not selling"}`} {r.hidden && <Badge tone="bad">hidden</Badge>} <span className="text-xs text-ink-500">{fmtDateTime(r.createdAt)}</span></li>)}</ul> : <p className="muted mt-2 text-sm">None.</p>}
        </section>

        <section aria-labelledby="about-h" className="card">
          <h2 id="about-h" className="h-section">Actions on this account</h2>
          {d.aboutThem.length ? <ul className="mt-2 space-y-1 text-xs">{d.aboutThem.map((l) => <li key={l.id}><code>{l.action}</code> by {l.actor?.name ?? "system"} · {fmtDateTime(l.createdAt)}</li>)}</ul> : <p className="muted mt-2 text-sm">None.</p>}
        </section>
        <section aria-labelledby="by-h" className="card">
          <h2 id="by-h" className="h-section">What they did recently</h2>
          {d.byThem.length ? <ul className="mt-2 space-y-1 text-xs">{d.byThem.map((l) => <li key={l.id}><code>{l.action}</code> on {l.entityType} · {fmtDateTime(l.createdAt)}</li>)}</ul> : <p className="muted mt-2 text-sm">Nothing logged.</p>}
          <p className="mt-2"><Link href={`/admin/audit?actor=${encodeURIComponent(u.email)}`} className="text-sm">Full history in the audit log</Link></p>
        </section>
      </div>
    </>
  );
}
