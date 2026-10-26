import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { db } from "@/lib/db";
import { allowedSiteKinds } from "@/lib/hub/gas";
import { SiteForm } from "@/components/hub/forms";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Gas site" };

export default async function NewSitePage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = await requireUser();
  const { edit } = await searchParams;
  const business = await getMyBusiness(user);
  if (!business) redirect("/hub/me");
  const site = edit ? await db.gasSite.findFirst({ where: { id: edit, businessId: business.id } }) : null;
  const kinds = allowedSiteKinds(business.roles);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/gas">← Gas network</Link></p>
      <PageHeader eyebrow="Gas network" title={site ? `Edit ${site.name}` : "Add a site"} subtitle="List a terminal, depot, refill plant, retail point, CNG station or gas truck base so buyers can find you by state." />
      {business.verification === "SUSPENDED" ? (
        <Notice tone="risk" title="Your business is suspended">Suspended businesses cannot add or change sites.</Notice>
      ) : kinds.length === 0 && !site ? (
        <Notice tone="warn" title="Add a role first">Add seller, refinery or delivery partner to your <Link href="/hub/me">business profile</Link> to list gas sites.</Notice>
      ) : (
        <section className="card max-w-3xl"><SiteForm kinds={kinds} site={site} /></section>
      )}
    </>
  );
}
