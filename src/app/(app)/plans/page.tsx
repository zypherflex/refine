import Link from "next/link";
import { requireUser } from "@/server/auth";
import { myInterests } from "@/server/hub/plans";
import { REVENUE_LINES, WHEN_LABEL } from "@/lib/hub/plans";
import { integrationStatus } from "@/server/integrations";
import { registerInterestAction } from "@/app/actions/hub";
import { Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";

export const metadata = { title: "Plans and pricing" };

export default async function PlansPage() {
  const user = await requireUser();
  const interests = new Set(await myInterests(user));
  const payments = integrationStatus().payments;
  const now = REVENUE_LINES.filter((l) => l.when === "NOW");
  const later = REVENUE_LINES.filter((l) => l.when !== "NOW");

  return (
    <>
      <PageHeader eyebrow="Plans" title="Free to find. Paid to scale." subtitle="Small businesses never pay to be found or to talk. Businesses pay for verification, reach, data and services that save them more than they cost. RefineryLens never trades fuel itself, so it never competes with its users." />
      <div className="mb-8">
        <Notice title="Pricing is set at launch">{payments?.available ? "Payments are available." : "Payments are not switched on yet, so no plan can be bought online today."} Register interest below and the team will contact you with pricing before anything is charged. No payment is taken on this page.</Notice>
      </div>

      <section aria-labelledby="free-h" className="mb-10 rounded-xl border border-ink-100 bg-ink-50 p-5">
        <h2 id="free-h" className="h-section">Always free</h2>
        <ul className="mt-2 grid gap-1 text-sm text-ink-800 sm:grid-cols-2">
          {["Business profile and directory listing", "Price board medians by state", "Gas network map", "Offers, requests and messages", "Posting delivery jobs and collecting quotes", "Recurring supply agreements and delivery records"].map((f) => <li key={f}>✓ {f}</li>)}
        </ul>
      </section>

      <SectionHeader title="Available now" />
      <ul className="grid gap-4 md:grid-cols-2">
        {now.map((l) => (
          <li key={l.id} className="card flex flex-col">
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{l.title}</h3><Pill className="bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/30">{WHEN_LABEL[l.when]}</Pill></div>
            <p className="text-xs text-ink-600">For {l.who.toLowerCase()}</p>
            <p className="mt-2 text-sm text-ink-800">{l.summary}</p>
            <ul className="mt-3 flex-1 space-y-1 text-sm text-ink-700">{l.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
            <div className="mt-4 border-t border-ink-100 pt-3">
              {interests.has(l.id) ? <p className="text-sm text-brand-800" role="status">You have registered interest. We will be in touch.</p> : (
                <HubForm action={registerInterestAction} submit="Register interest">
                  <input type="hidden" name="line" value={l.id} />
                  <label htmlFor={`m-${l.id}`} className="sr-only">Anything we should know</label>
                  <input id={`m-${l.id}`} name="message" className="input" maxLength={1000} placeholder="Optional: your business and volumes" />
                </HubForm>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10"><SectionHeader title="Coming next" /></div>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {later.map((l) => (
          <li key={l.id} className="rounded-xl border border-dashed border-ink-300 bg-white p-4">
            <Pill className="bg-ink-100 text-ink-800">{l.when === "PARTNER" ? "Coming soon · licensed partner" : "Coming next"}</Pill>
            <h3 className="mt-2 font-semibold">{l.title}</h3>
            <p className="mt-1 text-sm text-ink-700">{l.summary}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-600">Escrow, payments, lending and insurance need licensed partners under Central Bank of Nigeria and NAICOM rules. RefineryLens will not hold customer money or lend itself; it stays the software and data layer. Nothing here is financial advice. See also <Link href="/settings">your account</Link>.</p>
    </>
  );
}
