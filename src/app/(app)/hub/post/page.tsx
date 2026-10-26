import Link from "next/link";
import { redirect } from "next/navigation";
import type { HubListingKind } from "@prisma/client";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { db } from "@/lib/db";
import { allowedKinds } from "@/lib/hub/catalog";
import { ListingForm } from "@/components/hub/forms";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Post a listing" };

export default async function PostListingPage({ searchParams }: { searchParams: Promise<{ kind?: string; edit?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const business = await getMyBusiness(user);
  if (!business) redirect("/hub/me");
  const listing = sp.edit ? await db.hubListing.findFirst({ where: { id: sp.edit, businessId: business.id } }) : null;
  const kinds = allowedKinds(business.roles);
  const initial = (kinds.includes(sp.kind as HubListingKind) ? sp.kind : kinds[0]) as HubListingKind | undefined;
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/me">← My business</Link></p>
      <PageHeader eyebrow="Trade hub" title={listing ? "Edit listing" : "Post a listing"} subtitle="Say what you are selling, what you need, or what you can carry. Other businesses contact you through your hub inbox." />
      {business.verification === "SUSPENDED" ? (
        <Notice tone="risk" title="Your business is suspended">Suspended businesses cannot post. {business.verificationNote}</Notice>
      ) : !initial ? (
        <Notice tone="warn" title="Choose a role first">Add seller, buyer, delivery partner or refinery to your <Link href="/hub/me">business profile</Link> to post.</Notice>
      ) : (
        <section className="card max-w-3xl">
          <ListingForm kinds={kinds} listing={listing} initialKind={initial} />
        </section>
      )}
    </>
  );
}
