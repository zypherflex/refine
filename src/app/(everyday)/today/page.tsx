import Link from "next/link";
import { Sponsored } from "@/components/Sponsored";
import { ArrowRight, Calculator, Flame, Fuel, ShieldAlert, Truck } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { todayPrices } from "@/server/everyday/outlets";
import { myCylinders } from "@/server/everyday/cylinders";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { naira, priceItem } from "@/lib/hub/prices";
import { EVERYDAY_LABEL, FRESH_HOURS, MIN_REPORTERS } from "@/lib/everyday";
import { fmtDateTime, fmtUsd } from "@/lib/format";
import { Notice } from "@/components/ui";
import { ShareButton } from "@/components/native/ShareButton";
import { setHomeStateAction } from "@/app/actions/everyday";
import { latestFx } from "@/server/fx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today's fuel and gas prices", description: "What people paid for petrol, diesel, cooking gas and CNG in your state in the last three days." };

const isState = (s?: string | null): s is string => !!s && (NIGERIAN_STATES as readonly string[]).includes(s);

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ state?: string; welcome?: string }> }) {
  const { state: q, welcome } = await searchParams;
  const user = await getCurrentUser();
  const state = isState(q) ? q : isState(user?.homeState) ? user!.homeState! : "Lagos";
  const [{ rows, includesDemo }, cylinders, fx] = await Promise.all([todayPrices(state), user ? myCylinders(user) : Promise.resolve([]), latestFx()]);
  const due = cylinders.find((c) => c.outlook.daysLeft !== null && c.outlook.daysLeft <= 5);

  return (
    <>
      {welcome && <div className="mb-4"><Notice tone="ok" title="Welcome to RefineryLens">Check prices before you buy, report what you paid, and track your cooking gas so it never runs out mid-cooking.</Notice></div>}
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#3a1ba3_0%,#5b2ee8_35%,#b33ce0_70%,#ff7a1a_100%)] p-6 text-white sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_90%_0%,rgba(113,72,255,0.18),transparent_60%)]" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[#ffd166]">Today in {state}</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">Know the price before you buy.</h1>
          <p className="mt-2 max-w-xl text-white/90">What people paid for petrol, diesel, cooking gas and CNG in the last {FRESH_HOURS / 24} days, from reports at named stations and gas shops.</p>
          <form action={user ? setHomeStateAction : "/today"} className="mt-5 flex flex-wrap items-center gap-2">
            <label htmlFor="t-state" className="sr-only">State</label>
            <select id="t-state" name="state" defaultValue={state} className="input max-w-[14rem] bg-white text-ink-950">{NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}</select>
            <button className="btn bg-white text-ink-950 hover:bg-ink-100">{user ? "Make this my state" : "Show"}</button>
            <ShareButton title={`Fuel and gas prices in ${state} today`} text={`Fuel and gas prices in ${state} today on RefineryLens`} path={`/today?state=${encodeURIComponent(state)}`} />
          </form>
        </div>
      </section>

      {due && (
        <div className="mt-4"><Notice tone="warn" title={`Your ${due.label.toLowerCase()} gas ${due.outlook.daysLeft! <= 0 ? "may be empty" : `may run out in ${due.outlook.daysLeft} days`}`}><Link href="/order">Order a refill</Link> or <Link href="/my-gas">update your tracker</Link>.</Notice></div>
      )}
      {includesDemo && <div className="mt-4"><Notice tone="warn" title="Includes demo data">Some prices here come from sample stations and reports seeded for this installation, not from real people.</Notice></div>}

      <section id="prices" aria-labelledby="prices-h" className="mt-6">
        <h2 id="prices-h" className="sr-only">Prices</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const it = priceItem(r.item)!;
            return (
              <li key={r.item} className="card">
                <p className="text-sm font-medium text-ink-700">{EVERYDAY_LABEL[r.item]} <span className="text-xs font-normal text-ink-500">{it.unit}</span></p>
                {r.people.median !== null ? (
                  <>
                    <p className="num mt-1 flex items-baseline gap-2 text-3xl font-semibold text-ink-950">{naira(r.people.median)}{fx && <span className="text-sm font-medium text-ink-500">≈ {fmtUsd(r.people.median / fx.value)}</span>}</p>
                    <p className="mt-1 text-xs text-ink-600">{naira(r.people.low!)}–{naira(r.people.high!)} · {r.people.reporters} people · {fmtDateTime(r.people.updated)}</p>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-lg font-semibold text-ink-400">Not enough reports</p>
                    <p className="mt-1 text-xs text-ink-600">{r.people.reporters} of {MIN_REPORTERS} people needed. <Link href={`/stations?state=${encodeURIComponent(state)}`}>Report a price</Link></p>
                  </>
                )}
                {r.sellers.median !== null && <p className="mt-2 border-t border-ink-100 pt-2 text-xs text-ink-600">Sellers on RefineryLens charged <span className="num font-medium text-ink-800">{naira(r.sellers.median)}</span> this week ({r.sellers.count} sellers)</p>}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-ink-600">Each figure is the median of the latest price each person reported, shown once at least {MIN_REPORTERS} different people have reported. Not checked by RefineryLens.{fx && <> Dollar amounts use ₦{fx.value.toLocaleString("en-GB", { maximumFractionDigits: 2 })} per US dollar ({fx.demo ? "a demo value" : "ExchangeRate-API reference rate, not the CBN official rate"}, {fx.period}).</>}</p>
      </section>

      <section aria-labelledby="do-h" className="mt-8">
        <h2 id="do-h" className="h-section">What would you like to do?</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {([
            [Fuel, "/stations", "Find a station or gas shop", "Prices, queues and who is selling, reported by people nearby."],
            [Flame, "/my-gas", "Never run out of cooking gas", "Log your refills and get a reminder before the cylinder runs low."],
            [Truck, "/order", "Order a gas refill to your door", "From verified sellers. Pay on delivery."],
            [Calculator, "/cng-savings", "Should I convert to CNG?", "Your monthly saving and how fast a conversion pays back."],
            [ShieldAlert, "/stations", "Report short measure or overcharging", "Warn your neighbours. Repeated problems show on the station's page."],
          ] as const).map(([Icon, href, t, d]) => (
            <li key={t}>
              <Link href={href} className="card flex h-full items-start gap-3 no-underline transition hover:shadow-lg hover:no-underline">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700" aria-hidden><Icon size={20} /></span>
                <span className="flex-1"><span className="flex items-center justify-between font-semibold text-ink-950">{t}<ArrowRight size={16} aria-hidden className="text-ink-400" /></span><span className="mt-0.5 block text-sm text-ink-600">{d}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {!user && (
        <section className="card mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-700"><strong className="text-ink-950">Free for everyone.</strong> Join to report prices, track your gas and order refills.</p>
          <Link href="/register" className="btn-primary no-underline">Join free</Link>
        </section>
      )}
      <div className="mt-8"><Sponsored placement="today" state={state} /></div>
    </>
  );
}
