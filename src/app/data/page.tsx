import Link from "next/link";
import { ArrowRight, Building2, Factory, Landmark, Leaf, LineChart, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { dataPlans, fmtMoney, planPrice } from "@/lib/data-plans";
import { EVERYDAY_ITEMS, EVERYDAY_LABEL } from "@/lib/everyday";

export const dynamic = "force-dynamic";
export const metadata = { title: "RefineryLens Data: Nigeria fuel and LPG price index", description: "Daily pump and cooking-gas prices by Nigerian state, from named stations and sellers. REST API and CSV, priced in US dollars." };

const buyers = [
  [LineChart, "Commodity traders", "Benchmark cargo prices against what fuel and LPG actually sell for in each state, and see the spread between local refining and imports."],
  [Landmark, "Banks and development finance", "Track the cost of fuel and cooking gas for borrowers and programmes, state by state, every day."],
  [Building2, "Multinationals and logistics", "Budget fleet and generator diesel, and set allowances, with figures that move with the street, not a monthly survey."],
  [Leaf, "Clean-cooking and carbon projects", "Monitor LPG refill prices and the cost of switching from firewood and charcoal, for project design and reporting."],
  [Factory, "Equipment makers and investors", "Size CNG conversion, cylinder and skid-plant markets from real prices and where gas is scarce."],
  [ShieldCheck, "Researchers, media and insurers", "A sourced, methodical series with reporter counts, not a single anecdotal price."],
] as const;

export default async function DataHome() {
  const [rows, states, latest] = await Promise.all([
    db.priceIndexDaily.count(),
    db.priceIndexDaily.findMany({ distinct: ["state"], select: { state: true } }),
    db.priceIndexDaily.findFirst({ orderBy: { day: "desc" }, select: { day: true } }),
  ]);
  const plans = dataPlans().filter((p) => p.id !== "trial");
  return (
    <>
      <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(125deg,#3a1ba3_0%,#5b2ee8_35%,#b33ce0_70%,#ff7a1a_100%)] px-6 py-12 text-white sm:px-12">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_90%_0%,rgba(111,138,214,0.25),transparent_60%)]" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-[#ffd166]">RefineryLens Data</p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">What fuel and cooking gas really cost in Nigeria, state by state, every day.</h1>
          <p className="mt-4 text-lg text-white/90">Cargo benchmarks price West African shipments at the jetty. RefineryLens prices the street: petrol, diesel, kerosene, LPG per kilo, the 12.5 kg refill and CNG, from named stations, gas shops and sellers across all 36 states and the FCT.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/account/data" className="btn bg-white px-5 py-3 text-base font-semibold text-ink-950 no-underline hover:bg-ink-100">Start a 14-day free trial <ArrowRight size={18} aria-hidden /></Link>
            <Link href="/data/docs" className="btn border border-white/20 px-5 py-3 text-base text-white no-underline hover:bg-white/10">Read the API docs</Link>
          </div>
          <dl className="mt-8 grid max-w-xl grid-cols-3 gap-4 text-sm">
            <div><dt className="text-white/80">Products</dt><dd className="num text-2xl font-semibold">{EVERYDAY_ITEMS.length}</dd></div>
            <div><dt className="text-white/80">States with data</dt><dd className="num text-2xl font-semibold">{states.length}</dd></div>
            <div><dt className="text-white/80">Daily data points</dt><dd className="num text-2xl font-semibold">{rows.toLocaleString("en-GB")}</dd></div>
          </dl>
          {latest && <p className="mt-2 text-xs text-white/80">Latest day: {latest.day.toISOString().slice(0, 10)}</p>}
        </div>
      </section>

      <section aria-labelledby="who-h" className="py-14">
        <h2 id="who-h" className="font-serif text-3xl font-semibold tracking-tight">Who uses it</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buyers.map(([Icon, t, d]) => <li key={t} className="card"><span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-100 text-navy-800" aria-hidden><Icon size={18} /></span><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-ink-600">{d}</p></li>)}
        </ul>
      </section>

      <section aria-labelledby="what-h" className="grid gap-8 border-t border-ink-100 py-14 lg:grid-cols-2">
        <div>
          <h2 id="what-h" className="font-serif text-3xl font-semibold tracking-tight">What you get</h2>
          <ul className="mt-4 space-y-3 text-ink-700">
            <li><strong>Two series.</strong> <em>Public</em>: what people paid at named stations and gas shops, each person&apos;s latest price over 3 days. <em>Seller</em>: what wholesalers and retailers on the trade hub charged over 7 days.</li>
            <li><strong>Medians with ranges and reporter counts</strong>, published only when at least three people or three sellers reported, so no single price is exposed and one bad report cannot move the figure.</li>
            <li><strong>Moderated.</strong> Outliers far from the state median are refused or hidden, and flagged reports are reviewed. The last two days are rebuilt every hour, and older days are rebuilt after reports are removed.</li>
            <li><strong>Products:</strong> {EVERYDAY_ITEMS.map((i) => EVERYDAY_LABEL[i]).join(", ")}. Prices in naira.</li>
          </ul>
        </div>
        <pre className="overflow-x-auto rounded-2xl bg-ink-950 p-5 text-xs leading-relaxed text-ink-100"><code>{`GET /api/v1/latest?item=lpg_cyl_12_5&source=PUBLIC

{
  "data": [
    {
      "date": "2026-10-27",
      "state": "Lagos",
      "item": "lpg_cyl_12_5",
      "unit": "per refill",
      "source": "PUBLIC",
      "currency": "NGN",
      "median": 16200,
      "low": 16000,
      "high": 16500,
      "reporters": 3
    }
  ],
  "meta": { "plan": "starter" }
}`}</code></pre>
      </section>

      <section aria-labelledby="price-h" className="border-t border-ink-100 py-14">
        <h2 id="price-h" className="font-serif text-3xl font-semibold tracking-tight">Pricing, in US dollars</h2>
        <p className="mt-2 text-ink-600">Every plan starts with a 14-day free trial. 12 months cost the same as 10. Customers billed in Nigeria pay the naira price.</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const m = planPrice(p, "USD", "month");
            return (
              <li key={p.id} className={`card flex flex-col ${p.id === "professional" ? "ring-2 ring-navy-600" : ""}`}>
                <p className="font-semibold text-ink-950">{p.name}</p>
                <p className="text-xs text-ink-600">{p.who}</p>
                <p className="num mt-3 text-3xl font-semibold">{m !== null ? fmtMoney(m, "USD") : `from $${p.usdMonthly!.toLocaleString("en-US")}`}<span className="text-sm font-normal text-ink-600"> / month</span></p>
                <ul className="mt-3 space-y-1.5 text-sm text-ink-700">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
                <div className="mt-auto pt-4">{m !== null ? <Link href="/account/data" className="btn-primary btn-sm no-underline">Start free trial</Link> : <a href={`mailto:${process.env.SUPPORT_EMAIL ?? "data@refinerylens.ng"}?subject=RefineryLens%20Data%20Enterprise`} className="btn-secondary btn-sm no-underline">Talk to us</a>}</div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
