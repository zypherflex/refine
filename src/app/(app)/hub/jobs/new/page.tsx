import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { JobForm } from "@/components/hub/opsForms";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Post a delivery job" };

export default async function NewJobPage() {
  const user = await requireUser();
  const business = await getMyBusiness(user);
  if (!business) redirect("/hub/me");
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/jobs">← Delivery jobs</Link></p>
      <PageHeader eyebrow="Delivery jobs" title="Post a job" subtitle="Delivery partners on the hub see your load and send quotes. You choose one." />
      {business.verification === "SUSPENDED" ? (
        <Notice tone="risk" title="Your business is suspended">Suspended businesses cannot post jobs.</Notice>
      ) : (
        <section className="card max-w-3xl"><JobForm defaultFrom={business.state} /></section>
      )}
    </>
  );
}
