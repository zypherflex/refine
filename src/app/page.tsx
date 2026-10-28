import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpenCheck, Factory, GitCompareArrows, Layers, Lock, MessagesSquare, ShieldCheck, ShoppingCart, Store, Truck } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { Logo } from "@/components/Logo";

const roles = [
  { icon: Store, title: "Sellers", body: "Depots, marketers, distributors and retailers: post offers and reach buyers looking for your product." },
  { icon: ShoppingCart, title: "Buyers", body: "Stations, factories, fleets and traders: post what you need and compare offers side by side." },
  { icon: Truck, title: "Delivery partners", body: "Tanker, truck, vessel and last-mile operators: list your capacity and routes, and get loads." },
  { icon: Factory, title: "Refineries", body: "Large, modular and regional refineries: sell product and source crude, condensate and services." },
];

const steps = [
  ["Post", "An offer, a buy request or delivery capacity, by product, place and quantity. Listings expire so the hub stays current."],
  ["Match", "Each listing shows matching listings from the other side of the deal, and the delivery partners who can carry it."],
  ["Message", "Talk privately in the hub inbox. Only the two businesses can read a conversation; not even administrators."],
  ["Check", "A Verified badge means RefineryLens has checked the business's registration and licences. Report anyone who misleads."],
];

const questions = [
  ["What changed?", "Reviewed announcements with plain-language summaries, dated by event and by publication."],
  ["Why could it matter?", "Each item explains the possible effect on the business, kept separate from the facts."],
  ["What supports it?", "Every figure links to its document and page, with a provenance label you can trust."],
  ["What is uncertain?", "Missing data is shown as missing. Conflicting sources stay visible, side by side."],
];

const pillars = [
  { icon: BookOpenCheck, title: "Evidence, not opinion", body: "Every statement traces to a source document, page and retrieval time. AI drafts stay drafts until an editor has checked them." },
  { icon: GitCompareArrows, title: "Conflicts kept in view", body: "When two credible sources disagree, you see both claims and their dates. We never quietly pick a winner." },
  { icon: MessagesSquare, title: "A cited research assistant", body: "Ask in plain language. Answers cite the passages they rely on, say what they cannot answer, and never give buy or sell advice." },
  { icon: Layers, title: "Your thesis, versioned", body: "Write down why you hold a view. New evidence is suggested against each assumption, and only you decide what it means." },
  { icon: Lock, title: "Private by design", body: "Your uploads and theses are visible to you alone. Not to other investors, not to our editors, not to administrators." },
  { icon: ShieldCheck, title: "Corrections in public", body: "Every correction and retraction is logged with what changed and why, and watchers are told straight away." },
];

export default async function Home() {
  if (await getCurrentUser()) redirect("/hub");
  return (
    <div className="min-h-screen bg-white">
      <div className="relative overflow-hidden bg-navy-950 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_10%,rgba(22,163,156,0.22),transparent_60%),radial-gradient(40%_60%_at_0%_100%,rgba(63,193,184,0.10),transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_30%,#000,transparent)]" />
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-8">
          <Logo light />
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/login" className="btn-ghost text-white hover:bg-white/10">Sign in</Link>
            <Link href="/register" className="btn bg-white text-navy-950 shadow-sm hover:bg-navy-100">Create account</Link>
          </nav>
        </header>
        <main className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-28 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-teal-300">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" aria-hidden />
              The trade hub for fuel, gas and refined products
            </p>
            <h1 className="mt-6 font-serif text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Where sellers, buyers, delivery partners <span className="text-teal-300">and refineries do business.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-200">
              Post what you sell, what you need or the trucks and vessels you run. See matching listings from the other side of the deal, check who is verified, and talk privately in one inbox.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/register" className="btn bg-teal-500 px-5 py-3 text-base font-semibold text-navy-950 shadow-sm hover:bg-teal-400">
                List your business free <ArrowRight size={18} aria-hidden />
              </Link>
              <Link href="/login" className="btn border border-white/15 px-5 py-3 text-base text-white hover:bg-white/10">Sign in</Link>
            </div>
            <p className="mt-6 text-xs text-navy-300">Free to join and post. RefineryLens introduces businesses and carries their messages; it takes no payments and guarantees no one.</p>
          </div>

          <figure aria-label="Example of a trade hub listing with matches" className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-teal-400/10 blur-2xl" aria-hidden />
            <div className="relative rounded-2xl border border-white/10 bg-white p-5 text-navy-900 shadow-2xl sm:p-6">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-medium text-teal-800">Offer</span>
                <span className="rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium">Verified seller</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/40">Fictional sample</span>
              </div>
              <p className="mt-3 font-serif text-xl font-semibold leading-snug text-navy-950">Diesel (AGO), 66,000 litres a week, ex-depot Apapa</p>
              <p className="mt-2 text-sm leading-relaxed text-navy-700">Loading Monday to Saturday. Price on request, quality certificate with every load.</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-teal-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-800">Matching buy requests</p>
                  <p className="mt-1 text-xs leading-relaxed text-navy-800">3 buyers looking for diesel in Lagos and Ogun</p>
                </div>
                <div className="rounded-xl bg-navy-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-navy-700">Delivery partners</p>
                  <p className="mt-1 text-xs leading-relaxed text-navy-800">2 tanker operators covering the route</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-3 text-xs text-navy-600">
                <span>Ikeja, Lagos · posted today</span>
                <span className="font-medium text-teal-700">Message the seller →</span>
              </div>
            </div>
          </figure>
        </main>
      </div>

      <section aria-labelledby="roles-h" className="border-b border-navy-100">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <p className="eyebrow">One hub, four sides of the trade</p>
          <h2 id="roles-h" className="mt-2 max-w-3xl font-serif text-3xl font-semibold tracking-tight">Set up one profile, take any of the four roles.</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-600 text-white" aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-600">{body}</p>
              </li>
            ))}
          </ul>
          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-navy-100 bg-navy-100 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([t, d], i) => (
              <li key={t} className="bg-white p-6">
                <span className="num font-serif text-sm font-semibold text-teal-700">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="questions" className="border-b border-navy-100 bg-navy-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
          <p className="eyebrow">Plus independent research on refineries</p>
          <h2 id="questions" className="mt-2 max-w-2xl font-serif text-3xl font-semibold tracking-tight">Research that answers what an investor actually needs to know.</h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-navy-100 bg-navy-100 sm:grid-cols-2 lg:grid-cols-4">
            {questions.map(([t, d], i) => (
              <li key={t} className="bg-white p-6">
                <span className="num font-serif text-sm font-semibold text-teal-700">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-600">{d}</p>
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
            <p className="mt-4 text-navy-600">We would rather show you an honest gap than a confident guess. Every rule below is enforced in the software, not left to good intentions.</p>
          </div>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy-950 text-teal-300" aria-hidden><Icon size={18} strokeWidth={1.8} /></span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-600">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="coverage" className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <div className="rounded-2xl bg-navy-950 p-8 text-white sm:p-12">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="eyebrow text-teal-300">Coverage</p>
              <h2 id="coverage" className="mt-2 font-serif text-3xl font-semibold tracking-tight text-white">First coverage: a landmark refinery, from public sources.</h2>
              <p className="mt-4 max-w-xl text-navy-200">Our first coverage is Dangote Petroleum Refinery &amp; Petrochemicals, built from its public disclosures and moving through editorial review. The platform is designed for many companies across markets.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
              <Link href="/register" className="btn bg-teal-500 px-5 py-3 text-base font-semibold text-navy-950 hover:bg-teal-400">Create a free account <ArrowRight size={18} aria-hidden /></Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-navy-600 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <Logo size={24} />
          <p className="max-w-2xl sm:text-right">RefineryLens is a trade hub and an independent research platform. It takes no payments between businesses and guarantees no one. It is not affiliated with, endorsed by or sponsored by any company it covers, and does not provide investment advice. Demonstration features use a clearly labelled fictional company.</p>
        </div>
      </footer>
    </div>
  );
}
