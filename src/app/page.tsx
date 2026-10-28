import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, Flame, Fuel, GitCompareArrows, Layers, Lock, MessagesSquare, Repeat, ShieldCheck, Tags, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { companyFacts, factsIn } from "@/lib/company-facts";
import { ScaleTiles } from "@/components/CompanyFacts";
import { Logo } from "@/components/Logo";
import { OPPORTUNITIES, SCALES, SEGMENTS } from "@/lib/opportunities/catalog";

export const dynamic = "force-dynamic";

const COVERAGE_SLUG = "dangote";

const questions = [
  ["What changed?", "Reviewed announcements with plain-language summaries, dated by event and by publication."],
  ["Why could it matter?", "Each item explains the possible effect on the business, kept separate from the facts."],
  ["What supports it?", "Every figure links to its document and page, with a provenance label you can trust."],
  ["What is uncertain?", "Missing data is shown as missing. Conflicting sources stay visible, side by side."],
];

// Framed as open questions for investors to research, not as findings.
const nigeriaQuestions = [
  ["From importer to exporter?", "The company states an ambition to make Nigeria a net exporter of refined products. RefineryLens tracks what is disclosed about exports, and says plainly when it is not."],
  ["Naira and dollar exposure", "Crude is priced in US dollars while much fuel is sold in naira. We explain how that mismatch can affect cash flow, and separate general explanation from company evidence."],
  ["Crude supply and pricing reform", "Where the crude comes from and how domestic fuel prices are set both shape refining margins. We follow regulator and company disclosures as they appear."],
  ["Scale versus utilization", "Stated capacity is not the same as barrels actually processed. We keep capacity, throughput, production and sales apart."],
];

const pillars = [
  { icon: BookOpenCheck, title: "Evidence, not opinion", body: "Every statement traces to a source document, page and retrieval time. AI drafts stay drafts until an editor has checked them." },
  { icon: GitCompareArrows, title: "Conflicts kept in view", body: "When two credible sources disagree, you see both claims and their dates. We never quietly pick a winner." },
  { icon: MessagesSquare, title: "A cited research assistant", body: "Ask in plain language. Answers cite the passages they rely on, say what they cannot answer, and never give buy or sell advice." },
  { icon: Layers, title: "Your thesis, versioned", body: "Write down why you hold a view. New evidence is suggested against each assumption, and only you decide what it means." },
  { icon: Lock, title: "Private by design", body: "Your uploads and theses are visible to you alone. Not to other investors, not to our editors, not to administrators." },
  { icon: ShieldCheck, title: "Corrections in public", body: "Every correction and retraction is logged with what changed and why, and watchers are told straight away." },
];

export default async function Home({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const me = await getCurrentUser();
  if (me) redirect(me.audience === "PERSONAL" ? "/today" : "/hub");
  // The installed apps open on something useful straight away rather than on the marketing page.
  if ((await searchParams).source === "app") redirect("/today");
  const coverage = await db.company.findUnique({ where: { slug: COVERAGE_SLUG }, select: { name: true, profileFacts: true } }).catch(() => null);
  const facts = companyFacts(coverage?.profileFacts);
  const scale = factsIn(facts, "scale");
  const sizeClaims = factsIn(facts, "global").filter((f) => f.label.startsWith("Size claim"));

  return (
    <div className="min-h-screen bg-white">
      <div className="relative overflow-hidden bg-ink-950 text-white">
        <div aria-hidden className="band-ng h-1.5 w-full" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_10%,rgba(47,191,120,0.14),transparent_60%),radial-gradient(40%_60%_at_0%_100%,rgba(111,138,214,0.14),transparent_70%)]" />
        <div aria-hidden className="bg-adire pointer-events-none absolute inset-0 opacity-[0.05] [mask-image:radial-gradient(80%_70%_at_70%_30%,#000,transparent)]" />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
          <Logo light />
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/today" className="btn-ghost hidden text-white hover:bg-white/10 sm:inline-flex">Today&apos;s prices</Link>
            <Link href="/login" className="btn-ghost text-white hover:bg-white/10">Sign in</Link>
            <Link href="/register" className="btn bg-white text-ink-950 shadow-sm hover:bg-ink-100">Create account</Link>
          </nav>
        </header>
        <main className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-20 lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-brand-300">
              <span aria-hidden className="band-ng h-2 w-4 rounded-sm" />
              Nigeria's trade hub for fuel and gas
            </p>
            <h1 className="mt-6 font-serif text-[2.4rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-[3.4rem]">
              Buy, sell and move fuel and gas with businesses you can check. <span className="text-brand-300">Plus business opportunities around Dangote.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-200">
              Today&apos;s LPG, diesel and petrol prices by state. Verified sellers, buyers, hauliers and refineries. Delivery jobs with quotes, regular supply you can track, and a map of the gas network. And for the bigger picture, sourced research on where your business fits around Dangote&apos;s Lekki complex.
            </p>
            <ul className="mt-6 grid max-w-xl grid-cols-2 gap-x-4 gap-y-2 text-sm text-ink-100 sm:grid-cols-3">
              {([[Tags, "Price board"], [ShieldCheck, "Verified businesses"], [Truck, "Delivery jobs"], [Repeat, "Regular supply"], [Flame, "Gas network map"], [Layers, "Opportunity research"]] as const).map(([Icon, t]) => (
                <li key={t} className="flex items-center gap-2"><Icon aria-hidden size={16} className="text-brand-300" />{t}</li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className="btn bg-brand-500 px-5 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-400 hover:text-ink-950">
                Join free <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/login" className="btn border border-white/15 px-5 py-3 text-base text-white hover:bg-white/10">Sign in</Link>
            </div>
            <p className="mt-6 max-w-xl text-xs leading-relaxed text-ink-300">
              Find the opportunity. Examine the evidence. Size it with your own numbers. RefineryLens is independent and is not affiliated with, endorsed by or sponsored by Dangote or any Dangote company. Nothing here is an offer from Dangote.
            </p>
          </div>

          {sizeClaims.length === 2 ? (
            <figure aria-label="Example: two company statements about size, shown side by side" className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-brand-400/10 blur-2xl" aria-hidden />
              <div className="relative rounded-2xl border border-white/10 bg-white p-5 text-ink-900 shadow-2xl sm:p-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium">Company-disclosed</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Sources differ</span>
                </div>
                <p className="mt-3 font-serif text-xl font-semibold leading-snug text-ink-950">How big is it? The company’s own pages say it two ways.</p>
                <div className="mt-4 space-y-3">
                  {sizeClaims.map((f) => (
                    <blockquote key={f.label} className="rounded-xl border-l-4 border-brand-600 bg-brand-50 px-3 py-2.5 text-sm leading-relaxed text-ink-800">
                      {f.value}
                      <footer className="mt-1 text-[11px] text-ink-600">{f.label.replace("Size claim ", "").replace(/[()]/g, "")} · <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">source ↗</a></footer>
                    </blockquote>
                  ))}
                </div>
                <p className="mt-4 border-t border-ink-100 pt-3 text-xs text-ink-600">We show both, label them as company claims, and leave the difference visible until it is resolved.</p>
              </div>
            </figure>
          ) : (
            <div aria-hidden className="hidden lg:block" />
          )}
        </main>
        {scale.length > 0 && (
          <section aria-labelledby="scale-h" className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-8">
            <h2 id="scale-h" className="mb-3 text-[11px] font-semibold uppercase tracking-eyebrow text-ink-300">Scale at a glance · as stated by the company</h2>
            <ScaleTiles facts={scale} dark />
          </section>
        )}
      </div>

      <section aria-labelledby="everyday-h" className="border-b border-ink-100 bg-brand-50/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="eyebrow">For every Nigerian, free</p>
            <h2 id="everyday-h" className="mt-2 font-serif text-3xl font-semibold tracking-tight">Know the price before you buy. Never run out of gas.</h2>
            <p className="mt-3 text-ink-700">See what people paid for petrol, diesel, kerosene, cooking gas and CNG in your state today, at named stations and gas shops. Warn your neighbours about short measure. Track your cylinder and get a refill delivered by a verified seller, paid on delivery.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/today" className="btn-primary px-5 py-3 text-base no-underline">Check today&apos;s prices <ArrowRight size={18} aria-hidden /></Link>
              <Link href="/cng-savings" className="btn-secondary px-5 py-3 text-base no-underline">CNG savings calculator</Link>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {([[Tags, "Prices near you", "Medians from several people, so one wrong report can't mislead you."], [Fuel, "Stations and gas shops", "Who is selling now, and how long the queue is."], [Flame, "Cooking gas tracker", "A reminder before your cylinder runs out."], [Truck, "Refill to your door", "From verified sellers. Pay the rider on delivery."]] as const).map(([Icon, t, d]) => (
              <li key={t} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white" aria-hidden><Icon size={18} /></span>
                <h3 className="mt-3 font-semibold">{t}</h3>
                <p className="mt-1 text-sm text-ink-600">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="data-h" className="border-b border-ink-100 bg-ink-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-eyebrow text-navy-300">For companies worldwide</p>
            <h2 id="data-h" className="mt-1 font-serif text-2xl font-semibold text-white">RefineryLens Data: Nigeria&apos;s daily fuel and LPG price index, by state, by API.</h2>
            <p className="mt-1 text-sm text-ink-300">For traders, banks, multinationals and clean-cooking projects. From $49 a month.</p>
          </div>
          <Link href="/data" className="btn shrink-0 bg-white px-5 py-3 font-semibold text-ink-950 no-underline hover:bg-ink-100">See the data <ArrowRight size={18} aria-hidden /></Link>
        </div>
      </section>

      <section aria-labelledby="ng" className="border-b border-ink-100">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <p className="eyebrow">Lekki to world markets</p>
          <h2 id="ng" className="mt-2 max-w-3xl font-serif text-3xl font-semibold tracking-tight">The questions that matter for Nigeria, Africa and global fuel markets.</h2>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {nigeriaQuestions.map(([t, d]) => (
              <li key={t} className="relative overflow-hidden rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
                <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand-600" />
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="opps" className="border-b border-ink-100">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <p className="eyebrow">Business opportunities</p>
          <h2 id="opps" className="mt-2 max-w-3xl font-serif text-3xl font-semibold tracking-tight">From one truck to a crude cargo: where your business could fit around the refinery.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-600">{OPPORTUNITIES.length} researched business models across {SEGMENTS.length} areas, each with the company-stated facts it rests on, dated reports for and against, and a sizing tool that shows its formula. Independent analysis, not offers from the company.</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SCALES.map((s) => (
              <li key={s.id} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
                <h3 className="font-semibold">{s.label}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-600">{s.who}</p>
                <p className="mt-2 text-xs font-medium text-brand-800">{OPPORTUNITIES.filter((o) => o.scales.includes(s.id)).length} opportunities</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="questions" className="border-b border-ink-100 bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <p className="eyebrow">Four questions, every time</p>
          <h2 id="questions" className="mt-2 max-w-2xl font-serif text-3xl font-semibold tracking-tight">Research that answers what an investor actually needs to know.</h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-ink-100 bg-ink-100 sm:grid-cols-2 lg:grid-cols-4">
            {questions.map(([t, d], i) => (
              <li key={t} className="bg-white p-6">
                <span className="num font-serif text-sm font-semibold text-brand-700">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="principles" className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow">Built on editorial standards</p>
            <h2 id="principles" className="mt-2 font-serif text-3xl font-semibold tracking-tight">Trust is the product.</h2>
            <p className="mt-4 text-ink-600">We would rather show you an honest gap than a confident guess. Every rule below is enforced in the software, not left to good intentions.</p>
          </div>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-700 text-white" aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="coverage" className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-ink-950 p-8 text-white sm:p-12">
          <div aria-hidden className="bg-adire pointer-events-none absolute inset-0 opacity-[0.05]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="eyebrow text-brand-300">Coverage</p>
              <h2 id="coverage" className="mt-2 font-serif text-3xl font-semibold tracking-tight text-white">Opportunities around Dangote first. More of Africa’s energy hubs next.</h2>
              <p className="mt-4 max-w-xl text-ink-200">Every opportunity rests on Dangote’s public disclosures and dated independent reports, moved through editorial review. The platform is designed to add more refining and energy hubs across Africa and beyond.</p>
            </div>
            <div className="flex lg:justify-end">
              <Link href="/register" className="btn bg-brand-500 px-5 py-3 text-base font-semibold text-white hover:bg-brand-400 hover:text-ink-950">Create a free account <ArrowRight size={18} aria-hidden /></Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-ink-600 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <Logo size={24} />
          <p className="max-w-2xl sm:text-right">RefineryLens is an independent research platform. It is not affiliated with, endorsed by or sponsored by any company it covers, and does not provide investment advice. Demonstration features use a clearly labelled fictional company. <Link href="/privacy">Privacy policy</Link> · <Link href="/delete-account">Delete your account</Link></p>
        </div>
      </footer>
    </div>
  );
}
