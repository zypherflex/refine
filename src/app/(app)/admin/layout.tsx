import { requireRole } from "@/server/auth";
import { attentionCounts } from "@/server/admin/attention";
import { AdminNav, type AdminNavGroup } from "@/components/admin/AdminNav";

/** The admin console: every page under /admin shares this navigation, grouped by area, with counts of work waiting. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireRole("ADMIN");
  const a = await attentionCounts(admin);
  const groups: AdminNavGroup[] = [
    { label: "Console", items: [{ href: "/admin", label: "Overview" }] },
    { label: "People", items: [{ href: "/admin/users", label: "Users" }] },
    {
      label: "Trade hub",
      items: [
        { href: "/admin/hub", label: "Verification & reports", badge: a.verifications + a.hubReports },
        { href: "/admin/businesses", label: "Businesses" },
        { href: "/admin/listings", label: "Listings" },
        { href: "/admin/jobs", label: "Delivery jobs" },
      ],
    },
    {
      label: "Everyday",
      items: [
        { href: "/admin/everyday", label: "Flagged content", badge: a.flags },
        { href: "/admin/outlets", label: "Stations & shops" },
        { href: "/admin/prices", label: "Price watch" },
        { href: "/admin/orders", label: "Gas orders", badge: a.stuckOrders },
        { href: "/admin/trips", label: "Live trips", badge: a.staleTrips },
      ],
    },
    {
      label: "Money",
      items: [
        { href: "/admin/payments", label: "Payments & plans", badge: a.failedPayments },
        { href: "/admin/data", label: "Data customers" },
        { href: "/admin/sponsors", label: "Sponsorships" },
      ],
    },
    { label: "Communication", items: [{ href: "/admin/broadcast", label: "Broadcast" }] },
    {
      label: "System",
      items: [
        { href: "/admin/system", label: "Health & jobs", badge: a.failedJobs },
        { href: "/admin/audit", label: "Audit log" },
        { href: "/admin/exports", label: "Exports" },
      ],
    },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
      <AdminNav groups={groups} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
