import Link from "next/link";
import { BadgeCheck, CircleDollarSign, Map, Repeat, Truck, Store } from "lucide-react";
import { requireUser } from "@/server/auth";
import { myBusiness } from "@/server/hub/business";
import { listListings } from "@/server/hub/market";
import { priceBoard } from "@/server/hub/prices";
import { db } from "@/lib/db";
import { productLabel, stateName } from "@/lib/hub/catalog";
import { PageHeader, Notice, Pill } from "@/components/ui";
import { hubT } from "@/server/hub/lang";
import type { HubKey } from "@/lib/i18n/hub";
import { AdvanceWarning, BusinessName, PromotedTag, naira, qty, day } from "@/components/hub/bits";

export const metadata = { title: "Trade hub" };

const TOOLS = [
  { href: "/hub/directory", icon: BadgeCheck, key: "directory" },
  { href: "/hub/prices", icon: CircleDollarSign, key: "prices" },
  { href: "/hub/gas-map", icon: Map, key: "gas" },
  { href: "/hub/jobs", icon: Truck, key: "jobs" },
  { href: "/hub/supply", icon: Repeat, key: "supply" },
  { href: "/hub/listings", icon: Store, key: "listings" },
] as const;

export default async function HubPage() {
  const user = await requireUser();
  const { t } = await hubT();
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
        eyebrow={t("hub.eyebrow")}
        title={t("hub.title")}
        subtitle={t("hub.subtitle")}
        actions={<Link href="/hub/my" className="btn-primary btn-sm no-underline">{me ? t("hub.myBusiness") : t("hub.listFree")}</Link>}
      />

      <dl className="mb-8 grid grid-cols-3 gap-3">
        {[[t("hub.stat.verified"), verified], [t("hub.stat.listed"), total], [t("hub.stat.jobs"), openJobs]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-ink-100 bg-ink-50 p-3 sm:p-4">
            <dt className="text-xs text-ink-600">{k}</dt>
            <dd className="num mt-1 text-xl font-semibold text-ink-950 sm:text-2xl">{v}</dd>
          </div>
        ))}
      </dl>

      {!me && (
        <div className="mb-8 flex flex-col gap-3 rounded-xl border border-ink-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-800">{t("hub.addPrompt")}</p>
          <Link href="/hub/my" className="btn-primary btn-sm shrink-0 no-underline">{t("hub.addBusiness")}</Link>
        </div>
      )}

      <section aria-labelledby="tools-h" className="mb-10">
        <h2 id="tools-h" className="h-section mb-3">{t("hub.whatYouCanDo")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map(({ href, icon: Icon, key }) => (
            <li key={href}>
              <Link href={href} className="card-link h-full">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-950 text-white" aria-hidden><Icon size={17} strokeWidth={1.8} /></span>
                <p className="mt-3 font-semibold text-ink-950">{t(`tool.${key}.title` as HubKey)}</p>
                <p className="mt-1 text-sm text-ink-600">{t(`tool.${key}.body` as HubKey)}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section aria-labelledby="today-h">
          <h2 id="today-h" className="h-section">{t("hub.pricesIn", { state: stateName(me?.state ?? "LA") })}</h2>
          <p className="muted">{t("hub.pricesNote")} <Link href="/hub/prices">{t("hub.fullBoard")}</Link> · <Link href="/hub/alerts">{t("prices.alertsCta")}</Link></p>
          {headline.length ? (
            <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
              {headline.map((c) => (
                <li key={c.product} className="flex items-baseline justify-between gap-3 px-4 py-3">
                  <span className="text-sm font-medium">{productLabel(c.product)}</span>
                  <span className="text-right"><span className="num text-lg font-semibold text-ink-950">{naira(c.median!)}</span><span className="block text-xs text-ink-600">{c.sellers} · {day(c.latest!)}{c.includesSample ? " · sample" : ""}</span></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-ink-600">{t("hub.notEnoughHere")}</p>}
        </section>

        <section aria-labelledby="latest-h">
          <h2 id="latest-h" className="h-section">{t("hub.latest")}</h2>
          <ul className="mt-3 space-y-2">
            {listings.map((l) => (
              <li key={l.id} className="rounded-xl border border-ink-100 bg-white p-3 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill className={l.kind === "OFFER" ? "bg-ink-950 text-white" : "bg-ink-100 text-ink-900"}>{l.kind === "OFFER" ? t("offer") : t("request")}</Pill>
                  {l.promoted && <PromotedTag t={t} />}
                  <span className="font-medium">{productLabel(l.product)} · <span className="num">{qty(l.quantity)}</span> {l.unit} · {stateName(l.state)}</span>
                </div>
                <div className="mt-1 text-xs"><BusinessName b={l.business} t={t} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm"><Link href="/hub/listings">{t("hub.allListings")}</Link></p>
        </section>
      </div>

      <div className="mt-10 space-y-3">
        <AdvanceWarning t={t} />
        <Notice title={t("partners.title")}>{t("partners.body")} <Link href="/plans">{t("partners.link")}</Link></Notice>
      </div>
    </>
  );
}
