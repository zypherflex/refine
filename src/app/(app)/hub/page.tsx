import Link from "next/link";
import { BadgeCheck, CircleDollarSign, Map, Repeat, Truck, Store } from "lucide-react";
import { requireUser } from "@/server/auth";
import { myBusiness } from "@/server/hub/business";
import { listListings } from "@/server/hub/market";
import { priceBoard } from "@/server/hub/prices";
import { db } from "@/lib/db";
import { productLabel, stateName } from "@/lib/hub/catalog";
import { PageHeader, Notice, Pill } from "@/components/ui";
import { AdvanceWarning, BusinessName, PromotedTag, naira, qty, day } from "@/components/hub/bits";

export const metadata = { title: "Trade hub" };

const TOOLS = [
  { href: "/hub/directory", icon: BadgeCheck, title: "Verified directory", body: "Sellers, buyers, hauliers and refineries. Verified businesses come first; unverified ones never look official." },
  { href: "/hub/prices", icon: CircleDollarSign, title: "Price board", body: "What LPG, diesel, petrol, kerosene and CNG really cost by state: medians of seller-stated prices, with dates." },
  { href: "/hub/gas-map", icon: Map, title: "Gas network map", body: "Where gas is supplied, who delivers, where demand is waiting, and the gaps between them, state by state." },
  { href: "/hub/jobs", icon: Truck, title: "Delivery jobs", body: "Post a load, collect quotes from hauliers, accept one, and confirm delivery on both sides." },
  { href: "/hub/supply", icon: Repeat, title: "Recurring supply", body: "Weekly or monthly supply agreements, with every delivery confirmed by buyer and seller." },
  { href: "/hub/listings", icon: Store, title: "Offers and requests", body: "Product on offer and product wanted, by state. Message the business directly." },
];

export default async function HubPage() {
  const user = await requireUser();
  const [me, listings, board, counts] = await Promise.all([
    myBusiness(user),
    listListings({}, 6),
    priceBoard(),
    Promise.all([db.hubBusiness.count({ where: { verification: "VERIFIED" } }), db.hubBusiness.count({ where: { verification: { not: "SUSPENDED" } } }), db.deliveryJob.count({ where: { status: "OPEN" } })]),
  ]);
  const [verified, total, openJobs] = counts;
  const headline = board.filter((c) => c.median != null && ["LPG", "DIESEL", "PETROL"].includes(c.product) && c.state === (me?.state ?? "LA"));

  return (
    <>
      <PageHeader
        eyebrow="Trade hub"
        title="Find fuel and gas, check who you are dealing with, book delivery"
        subtitle="The trust and price layer for Nigerian energy trade. Free to find and free to talk. RefineryLens never sells fuel, holds money or sets prices, so it stays neutral between buyers, sellers, hauliers and refineries."
        actions={me ? <Link href="/hub/my" className="btn-primary btn-sm no-underline">My business</Link> : <Link href="/hub/my" className="btn-primary btn-sm no-underline">List your business free</Link>}
      />

      <dl className="mb-8 grid grid-cols-3 gap-3">
        {[["Verified businesses", verified], ["Businesses listed", total], ["Open delivery jobs", openJobs]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-ink-100 bg-ink-50 p-3 sm:p-4">
            <dt className="text-xs text-ink-600">{k}</dt>
            <dd className="num mt-1 text-xl font-semibold text-ink-950 sm:text-2xl">{v}</dd>
          </div>
        ))}
      </dl>

      {!me && (
        <div className="mb-8 flex flex-col gap-3 rounded-xl border border-ink-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-800">You can browse everything now. To post listings, report prices, quote on jobs or agree recurring supply, add your business. It takes two minutes and is free.</p>
          <Link href="/hub/my" className="btn-primary btn-sm shrink-0 no-underline">Add my business</Link>
        </div>
      )}

      <section aria-labelledby="tools-h" className="mb-10">
        <h2 id="tools-h" className="h-section mb-3">What you can do here</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ href, icon: Icon, title, body }) => (
            <li key={href}>
              <Link href={href} className="card-link h-full">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-950 text-white" aria-hidden><Icon size={17} strokeWidth={1.8} /></span>
                <p className="mt-3 font-semibold text-ink-950">{title}</p>
                <p className="mt-1 text-sm text-ink-600">{body}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section aria-labelledby="today-h">
          <h2 id="today-h" className="h-section">Prices in {stateName(me?.state ?? "LA")}</h2>
          <p className="muted">Medians of seller-stated prices, last 14 days. <Link href="/hub/prices">Full board</Link></p>
          {headline.length ? (
            <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
              {headline.map((c) => (
                <li key={c.product} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-medium">{productLabel(c.product)}</span>
                  <span className="text-right"><span className="num text-lg font-semibold text-ink-950">{naira(c.median!)}</span><span className="block text-xs text-ink-600">{c.sellers} sellers · to {day(c.latest!)}{c.includesSample ? " · sample" : ""}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-ink-600">Not enough sellers have reported prices here yet.</p>}
        </section>

        <section aria-labelledby="latest-h">
          <h2 id="latest-h" className="h-section">Latest offers and requests</h2>
          <ul className="mt-3 space-y-2">
            {listings.map((l) => (
              <li key={l.id} className="rounded-xl border border-ink-100 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill className={l.kind === "OFFER" ? "bg-ink-950 text-white" : "bg-ink-100 text-ink-900"}>{l.kind === "OFFER" ? "Offer" : "Request"}</Pill>
                  {l.promoted && <PromotedTag />}
                  <span className="font-medium">{productLabel(l.product)} · <span className="num">{qty(l.quantity)}</span> {l.unit} · {stateName(l.state)}</span>
                </div>
                <div className="mt-1 text-xs"><BusinessName b={l.business} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm"><Link href="/hub/listings">All offers and requests</Link></p>
        </section>
      </div>

      <div className="mt-10 space-y-3">
        <AdvanceWarning />
        <Notice title="Coming with licensed partners">Escrow, inventory finance and insurance in transit will be offered only through a licensed payment provider, lender and insurer. RefineryLens stays the software and data layer. <Link href="/plans">See plans</Link></Notice>
      </div>
    </>
  );
}
