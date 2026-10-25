import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { changePlanAction, changeRoleAction } from "@/app/actions/admin";
import { fmtDateTime } from "@/lib/format";
import { integrationStatus } from "@/server/integrations";
import { PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Administration" };

export default async function AdminPage() {
  const admin = await requireRole("ADMIN");
  const [users, logs, jobs] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { theses: true, documents: true } } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { actor: { select: { name: true } } } }),
    db.job.groupBy({ by: ["status"], _count: true }),
  ]);
  const st = integrationStatus();
  const integrations = [
    ["PostgreSQL database", st.database],
    ["Private document storage (local disk)", st.storage.driver === "local" && st.storage.available],
    ["S3-compatible object storage", st.storage.driver === "s3" && st.storage.available],
    ["Language model for the assistant", st.languageModel],
    ["Email alert delivery" + (st.email.configured && !st.email.available ? " (incomplete: needs EMAIL_PROVIDER=smtp, SMTP_URL and EMAIL_FROM)" : ""), st.email.available],
    ["Payment collection" + (st.payments.configured && !st.payments.available ? " (provider set, no adapter)" : ""), st.payments.available],
  ] as const;
  return (
    <>
      <PageHeader eyebrow="Administration" title="Administration" subtitle="Users, roles, plans, background jobs and the audit log. Administrators cannot open users' private files or theses." />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="h-section">Users</h2>
          <div className="table-wrap mt-2">
            <table className="tbl">
              <thead><tr><th>User</th><th>Role</th><th>Plan</th><th>Private items</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><p className="font-medium">{u.name}</p><p className="text-xs text-navy-700">{u.email}</p></td>
                    <td>
                      <form action={changeRoleAction} className="flex gap-1"><input type="hidden" name="userId" value={u.id} />
                        <select name="role" defaultValue={u.role} className="input py-1" aria-label={`Role for ${u.name}`} disabled={u.id === admin.id}>{["USER", "ANALYST", "EDITOR", "ADMIN"].map((r) => <option key={r}>{r}</option>)}</select>
                        {u.id !== admin.id && <button className="btn-secondary btn-sm">Set</button>}
                      </form>
                    </td>
                    <td>
                      <form action={changePlanAction} className="flex gap-1"><input type="hidden" name="userId" value={u.id} />
                        <select name="plan" defaultValue={u.plan} className="input py-1" aria-label={`Plan for ${u.name}`}>{["FREE", "PRO", "TEAM"].map((r) => <option key={r}>{r}</option>)}</select>
                        <button className="btn-secondary btn-sm">Set</button>
                      </form>
                    </td>
                    <td className="text-xs">{u._count.theses} theses, {u._count.documents} files (contents not viewable)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="space-y-6">
          <section className="card">
            <h2 className="h-section">Integrations</h2>
            <ul className="mt-2 space-y-1 text-sm">{integrations.map(([n, ok]) => <li key={n} className="flex justify-between gap-2"><span>{n}</span><Pill className={ok ? "bg-teal-100 text-teal-800" : "bg-navy-100 text-navy-800"}>{ok ? "Working" : "Not configured"}</Pill></li>)}</ul>
          </section>
          <section className="card">
            <h2 className="h-section">Background jobs</h2>
            <ul className="mt-2 text-sm">{jobs.length === 0 ? <li>No jobs yet.</li> : jobs.map((j) => <li key={j.status}>{j.status.toLowerCase()}: {j._count}</li>)}</ul>
          </section>
        </aside>
      </div>
      <section className="card mt-6">
        <h2 className="h-section">Audit log</h2>
        <div className="table-wrap mt-2">
          <table className="tbl">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th></tr></thead>
            <tbody>{logs.map((l) => <tr key={l.id}><td className="whitespace-nowrap text-xs">{fmtDateTime(l.createdAt)}</td><td>{l.actor?.name ?? "System"}</td><td><code className="text-xs">{l.action}</code></td><td className="text-xs">{l.entityType} {l.entityId.slice(0, 10)}…</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
