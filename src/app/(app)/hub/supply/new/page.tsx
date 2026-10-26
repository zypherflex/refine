import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getBusiness, getMyBusiness } from "@/server/hub/business";
import { AgreementForm } from "@/components/hub/opsForms";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Propose a supply agreement" };

export default async function NewAgreementPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const mine = await getMyBusiness(user);
  if (!mine) redirect("/hub/me");
  if (!sp.with) redirect("/hub/supply");
  const other = await getBusiness(user, sp.with);
  const otherSells = other.roles.some((r) => r === "SELLER" || r === "REFINERY");
  const iSell = mine.roles.some((r) => r === "SELLER" || r === "REFINERY");
  // Buy from a seller by default; supply them if they only buy.
  const side = otherSells ? "BUYER" : "SELLER";
  return (
    <>
      <p className="mb-2 text-sm"><Link href={`/hub/businesses/${other.id}`}>← {other.name}</Link></p>
      <PageHeader eyebrow="Supply agreements" title={`Propose regular supply with ${other.name}`} subtitle="Set out what is delivered, how often and where. They accept or decline; once active, each delivery is logged and confirmed." />
      {other.id === mine.id ? (
        <Notice tone="warn" title="This is your own business">Choose another business.</Notice>
      ) : side === "SELLER" && !iSell ? (
        <Notice tone="warn" title="Neither business sells">{other.name} is not listed as a seller, and neither is your business. Add the seller role to your profile to supply them.</Notice>
      ) : (
        <section className="card max-w-3xl"><AgreementForm counterparty={{ id: other.id, name: other.name }} side={side} defaultTo={side === "BUYER" ? mine.state : other.state} /></section>
      )}
    </>
  );
}
