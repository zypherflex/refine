import { requireUser } from "@/server/auth";
import { listCompanies, selectedCompany } from "@/server/services/companies";
import { unreadCount } from "@/server/services/alerts";
import { unreadThreadCount } from "@/server/hub/messages";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [companies, company, unread, hubUnread] = await Promise.all([listCompanies(), selectedCompany(), unreadCount(user.id), unreadThreadCount(user)]);
  return (
    <Shell user={user} companies={companies} current={company?.slug ?? ""} unread={unread} hubUnread={hubUnread} company={company ?? { name: "No company", isFictional: false, coverageStatus: "" }}>
      {children}
    </Shell>
  );
}
