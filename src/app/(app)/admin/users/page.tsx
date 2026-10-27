import Link from "next/link";
import { requireRole } from "@/server/auth";
import { searchUsers } from "@/server/admin/users";
import { PAGE_SIZE, pageOf } from "@/server/admin/guard";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { fmtDate } from "@/lib/format";
import { Badge, Field, FilterBar, Pager, Select } from "@/components/admin/parts";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Users · Administration" };
export const dynamic = "force-dynamic";

type SP = { q?: string; role?: string; plan?: string; audience?: string; state?: string; blocked?: string; sort?: string; page?: string };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const page = pageOf(sp.page);
  const { total, rows } = await searchUsers(admin, { ...sp, page });
  return (
    <>
      <PageHeader eyebrow="People" title="Users" subtitle="Find anyone by name, email or phone. Open a person to change their role or plan, stop them reporting, or sign them out everywhere." />
      <FilterBar action="/admin/users">
        <Field label="Search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Name, email or phone" className="input w-56 py-1.5 text-sm" /></Field>
        <Field label="Kind"><Select name="audience" value={sp.audience} options={[["PERSONAL", "Households"], ["BUSINESS", "Businesses"]]} /></Field>
        <Field label="Role"><Select name="role" value={sp.role} options={["USER", "ANALYST", "EDITOR", "ADMIN"]} /></Field>
        <Field label="Plan"><Select name="plan" value={sp.plan} options={["FREE", "PRO", "TEAM"]} /></Field>
        <Field label="Home state"><Select name="state" value={sp.state} options={NIGERIAN_STATES} /></Field>
        <Field label="Reporting"><Select name="blocked" value={sp.blocked} options={[["yes", "Stopped from reporting"]]} all="Any" /></Field>
        <Field label="Sort"><Select name="sort" value={sp.sort} options={[["new", "Newest first"], ["old", "Oldest first"], ["name", "Name"]]} all={null} /></Field>
      </FilterBar>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Person</th><th>Kind</th><th>Role · plan</th><th>State</th><th>Business</th><th className="text-right">Orders</th><th className="text-right">Reports</th><th>Joined</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/users/${u.id}`} className="font-medium">{u.name}</Link><p className="text-xs text-ink-600">{u.email}</p></td>
                <td>{u.audience === "PERSONAL" ? "Household" : "Business"}</td>
                <td><span className="flex flex-wrap gap-1">{u.role !== "USER" && <Badge tone="navy">{u.role.toLowerCase()}</Badge>}<Badge>{u.plan.toLowerCase()}</Badge>{u.reportingBlocked && <Badge tone="bad">no reporting</Badge>}</span></td>
                <td>{u.homeState ?? "–"}</td>
                <td className="text-xs">{u.hubBusiness ? <>{u.hubBusiness.name} <Badge tone={u.hubBusiness.verification === "VERIFIED" ? "good" : u.hubBusiness.verification === "SUSPENDED" ? "bad" : "plain"}>{u.hubBusiness.verification.toLowerCase().replace("_", " ")}</Badge></> : "–"}</td>
                <td className="num text-right">{u._count.gasOrders}</td>
                <td className="num text-right">{u._count.outletReports}</td>
                <td className="whitespace-nowrap text-xs">{fmtDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager base="/admin/users" params={{ ...sp, page: undefined }} page={page} total={total} size={PAGE_SIZE} />
    </>
  );
}
