import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Flame, Fuel, Gift, Globe2, Lock, MapPinned, Repeat, ShieldCheck, Tags, Truck, Users } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { todayPrices } from "@/server/everyday/outlets";
import { latestFx } from "@/server/fx";
import { EVERYDAY_LABEL } from "@/lib/everyday";
import { naira, priceItem } from "@/lib/hub/prices";
import { feeRules, plusPrice } from "@/lib/money";
import { fmtUsd } from "@/lib/format";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

const HERO_STATE = "Lagos";
const HERO_ITEMS = ["pms_retail_litre", "ago_retail_litre", "lpg_cyl_12_5", "lpg_retail_kg"] as const;

const promises = [
  { icon: Users, title: "Prices from many people", body: "A price shows only once several different people have reported it, and we show the median, so one wrong report cannot mislead you." },
  { icon: ShieldCheck, title: "Sellers we have checked", body: "Gas sellers and trade partners are verified against their registration and licences before they get the badge." },
  { icon: Lock, title: "Your details stay yours", body: "Your address and phone go only to the seller you choose. We never sell your data." },
  { icon: Flame, title: "Bad reports come down", body: "Anyone can flag a made-up price or a duplicate station. Our team reviews every flag." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const me = await getCurrentUser();
  if (me) redirect(me.audience === "PERSONAL" ? "/today" : "/hub");
  // The installed apps open on something useful straight away rather than on the marketing page.
  if ((await searchParams).source === "app") redirect("/today");
  const [{ rows, includesDemo }, fx] = await Promise.all([todayPrices(HERO_STATE).catch(() => ({ rows: [], includesDemo: false })), latestFx().catch(() => null)]);
  const hero = HERO_ITEMS.map((id) => {
    const r = rows.find((x) => x.item === id);
    return { id, value: r?.people.median ?? r?.sellers.median ?? null };
  });
  const fees = feeRules();
  const plus = plusPrice();

  return (
    <div className="min-h-screen bg-white">
      <div className="relative overflow-hidden bg-ink-950 text-white">
        <div aria-hidden className="band-brand h-1.5 w-full" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_10%,rgba(91,130,240,0.22),transparent_60%),radial-gradient(40%_60%_at_0%_100%,rgba(245,165,36,0.10),transparent_70%)]" />
        <div aria-hidden className="bg-meridian pointer-events-none absolute inset-0 opacity-[0.06] [mask-image:radial-gradient(80%_70%_at_70%_30%,#000,transparent)]" />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
          <Logo light />
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/today" className="btn-ghost hidden text-white hover:bg-white/10 sm:inline-flex">Today&apos;s prices</Link>
            <Link href="/login" className="btn-ghost text-white hover:bg-white/10">Sign in</Link>
            <Link href="/register" className="btn bg-white text-ink-950 shadow-sm hover:bg-ink-100">Create account</Link>
          </nav>
        </header>
        <main className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-24 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-amber-300">
              <Globe2 aria-hidden size={14} />
              For Nigerians everywhere
            </p>
            <h1 className="mt-6 font-serif text-[2.4rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-[3.4rem]">
              Fuel and cooking gas, <span className="text-amber-400">without the guesswork.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">
              Know today&apos;s price in your state before you buy. Get a gas refill delivered by a seller we have checked. And from London, Houston or Dubai, send a full cylinder to family at home and pay in dollars.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/today" className="btn bg-amber-500 px-5 py-3 text-base font-semibold text-ink-950 shadow-sm hover:bg-amber-400">
                Check today&apos;s prices <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/order?for=family" className="btn border border-white/15 px-5 py-3 text-base text-white hover:bg-white/10"><Gift size={18} aria-hidden /> Send gas home</Link>
            </div>
            <p className="mt-6 text-sm text-ink-300">Free to use. No app needed, and there is one for Android and iPhone too.</p>
          </div>

          <figure aria-labelledby="hero-cap" className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-brand-500/15 blur-2xl" aria-hidden />
            <div className="relative rounded-2xl border border-white/10 bg-white p-5 text-ink-900 shadow-2xl sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <p id="hero-cap" className="font-semibold text-ink-950">Today in {HERO_STATE}</p>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-800">{includesDemo ? "Demo data" : "Live"}</span>
              </div>
              <ul className="mt-3 divide-y divide-ink-100">
                {hero.map((h) => (
                  <li key={h.id} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="text-sm text-ink-700">{EVERYDAY_LABEL[h.id]} <span className="text-xs text-ink-500">{priceItem(h.id)?.unit}</span></span>
                    <span className="num text-right font-semibold text-ink-950">{h.value === null ? <span className="text-sm font-normal text-ink-500">Not enough reports</span> : <>{naira(h.value)}{fx && <span className="ml-1.5 text-xs font-normal text-ink-500">≈ {fmtUsd(h.value / fx.value)}</span>}</>}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-ink-100 pt-3 text-xs text-ink-600">Medians of what people and sellers reported in the last few days. <Link href="/today">All products and states</Link></p>
            </div>
          </figure>
        </main>
      </div>

      <section aria-labelledby="everyday-h" className="border-b border-ink-100 bg-brand-50/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow">At home in Nigeria</p>
            <h2 id="everyday-h" className="mt-2 font-serif text-3xl font-semibold tracking-tight">Know the price before you buy. Never run out of gas.</h2>
            <p className="mt-3 text-ink-700">See what people paid for petrol, diesel, kerosene, cooking gas and CNG in your state today, at named stations and gas shops. Warn your neighbours about short measure. Track your cylinder and get a refill delivered by a verified seller.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/today" className="btn-primary px-5 py-3 text-base no-underline">Check today&apos;s prices <ArrowRight size={18} aria-hidden /></Link>
              <Link href="/cng-savings" className="btn-secondary px-5 py-3 text-base no-underline">CNG savings calculator</Link>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {([[Tags, "Prices near you", "Medians from several people, so one wrong report can't mislead you."], [Fuel, "Stations and gas shops", "Who is selling now, and how long the queue is."], [Flame, "Cooking gas tracker", "A reminder before your cylinder runs out."], [Truck, "Refill to your door", "From verified sellers. Pay on delivery or online."]] as const).map(([Icon, t, d]) => (
              <li key={t} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white" aria-hidden><Icon size={18} /></span>
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-ink-600">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="home-h" className="border-b border-ink-100">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow text-amber-700">Abroad</p>
            <h2 id="home-h" className="mt-2 font-serif text-3xl font-semibold tracking-tight">Send gas home. They get a full cylinder; you get a receipt.</h2>
            <p className="mt-3 text-ink-700">Cooking gas is one of the most useful things you can send. Order a refill for your parents or family anywhere we have verified sellers, pay by card in US dollars or naira, and follow the delivery until it arrives.</p>
            <Link href="/order?for=family" className="btn-primary mt-6 px-5 py-3 text-base no-underline">Send gas home <ArrowRight size={18} aria-hidden /></Link>
          </div>
          <ol className="grid gap-3">
            {([["Choose a verified seller near them", "Sellers list their price per kg and delivery fee up front."], ["The seller confirms the price", "You see the total in naira and in dollars at a dated exchange rate."], ["Pay online and track it", "The seller is told not to collect cash. You get an alert when it is delivered."]] as const).map(([t, d], i) => (
              <li key={t} className="flex gap-4 rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <span className="num grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 font-semibold text-amber-800">{i + 1}</span>
                <span><span className="block font-semibold">{t}</span><span className="mt-0.5 block text-sm text-ink-600">{d}</span></span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="biz-h" className="border-b border-ink-100 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <p className="eyebrow">For businesses</p>
          <h2 id="biz-h" className="mt-2 max-w-3xl font-serif text-3xl font-semibold tracking-tight">Buy, sell and move fuel and gas with businesses you can check.</h2>
          <p className="mt-3 max-w-3xl text-ink-700">For gas plants, filling stations, depots, hauliers and buyers across Nigeria and West Africa, and suppliers abroad selling into Nigeria.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {([[Tags, "Price board", "Seller prices by state, updated daily."], [ShieldCheck, "Verified businesses", "Registration and licences checked."], [Truck, "Delivery jobs", "Post a load and compare quotes."], [Repeat, "Regular supply", "Agreements you can track delivery by delivery."], [MapPinned, "Gas network map", "Plants, depots and stations."], [Flame, "Home gas orders", "Households order from you; we bring the customers."]] as const).map(([Icon, t, d]) => (
              <li key={t} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <Icon aria-hidden size={18} className="text-brand-700" />
                <h3 className="mt-2 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-ink-600">{d}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register?for=business" className="btn-primary px-5 py-3 text-base no-underline">List your business free <ArrowRight size={18} aria-hidden /></Link>
            <Link href="/data" className="btn-secondary px-5 py-3 text-base no-underline">Price data by API, from $49 a month</Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="pricing-h" className="border-b border-ink-100">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <p className="eyebrow">Clear pricing</p>
          <h2 id="pricing-h" className="mt-2 max-w-3xl font-serif text-3xl font-semibold tracking-tight">Free for everyday use. This is how we earn.</h2>
          <ul className="mt-8 grid gap-3 md:grid-cols-3">
            <li className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
              <h3 className="font-semibold">Free</h3>
              <p className="num mt-1 text-2xl font-semibold">₦0</p>
              <p className="mt-2 text-sm text-ink-600">Prices, stations, the gas tracker and gas orders paid on delivery. Paying online adds a {fees.serviceFeePercent}% service fee (at least {naira(fees.serviceFeeMin)}, at most {naira(fees.serviceFeeMax)}).</p>
            </li>
            <li className="rounded-2xl border-2 border-amber-500 bg-white p-6 shadow-card">
              <h3 className="font-semibold">RefineryLens Plus</h3>
              <p className="num mt-1 text-2xl font-semibold">₦{(plus.ngnKobo / 100).toLocaleString("en-GB")} <span className="text-base font-normal text-ink-600">or ${(plus.usdCents / 100).toFixed(2)} a month</span></p>
              <p className="mt-2 text-sm text-ink-600">No service fee on online gas payments, at home or sending gas from abroad.</p>
            </li>
            <li className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
              <h3 className="font-semibold">Businesses</h3>
              <p className="mt-1 text-2xl font-semibold">Free to list</p>
              <p className="mt-2 text-sm text-ink-600">{fees.commissionPercent}% of home gas orders delivered ({fees.commissionPercentBusiness}% on the Business plan, which also features you first).</p>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="promise-h" className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow">Our promise</p>
            <h2 id="promise-h" className="mt-2 font-serif text-3xl font-semibold tracking-tight">Built so you can trust what you see.</h2>
            <p className="mt-4 text-ink-600">Every rule below is enforced in the software, not left to good intentions.</p>
          </div>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {promises.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-700 text-white" aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="join-h" className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-8 text-white sm:p-12">
          <div aria-hidden className="bg-meridian pointer-events-none absolute inset-0 opacity-[0.06]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="eyebrow text-amber-300">All 36 states and the FCT</p>
              <h2 id="join-h" className="mt-2 font-serif text-3xl font-semibold tracking-tight text-white">Join the Nigerians keeping each other informed on fuel and gas.</h2>
              <p className="mt-4 max-w-xl text-ink-200">Every price you report helps your neighbours, and every refill you order supports a seller we have checked.</p>
            </div>
            <div className="flex lg:justify-end">
              <Link href="/register" className="btn bg-amber-500 px-5 py-3 text-base font-semibold text-ink-950 hover:bg-amber-400">Create a free account <ArrowRight size={18} aria-hidden /></Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-ink-600 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <Logo size={24} />
          <p className="max-w-2xl sm:text-right">Prices are reported by people and sellers and are not checked by RefineryLens. Dollar amounts are approximate, at a dated reference rate. <Link href="/privacy">Privacy policy</Link> · <Link href="/delete-account">Delete your account</Link></p>
        </div>
      </footer>
    </div>
  );
}
