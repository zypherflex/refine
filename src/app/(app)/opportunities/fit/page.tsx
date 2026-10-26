import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getProfile } from "@/server/opportunities/board";
import { FitForm } from "@/components/opportunities/FitForm";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Find my fit" };

export default async function FitPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const profile = await getProfile(user);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/opportunities">← All opportunities</Link></p>
      <PageHeader eyebrow="Opportunities" title="Find my fit" subtitle="Three quick questions. RefineryLens ranks the opportunities that suit your size, puts your areas of interest first, and tells you why each one is on your list. Your answers are private and you can change them any time." />
      {sp.welcome && <div className="mb-4"><Notice tone="ok" title="Welcome to RefineryLens">Start here: tell us about your business and we will point you to the opportunities that fit. You can skip this and <Link href="/opportunities">browse everything</Link>.</Notice></div>}
      <section className="card"><FitForm profile={profile} /></section>
    </>
  );
}
