import { requireUser } from "@/server/auth";
import { listCompanies, selectedCompany } from "@/server/services/companies";
import { unreadCount } from "@/server/services/alerts";
import { Shell } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [companies, company, unread] = await Promise.all([listCompanies(), selectedCompany(), unreadCount(user.id)]);
  return (
    <Shell user={user} companies={companies} current={company?.slug ?? ""} unread={unread} company={company ?? { name: "No company", isFictional: false, coverageStatus: "" }}>
      {children}
    </Shell>
  );
}
