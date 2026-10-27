import Link from "next/link";
import { Flame, Repeat, Tags, Truck, PackageSearch, Megaphone } from "lucide-react";

/** The jobs people come to the hub for, one tap each. Colours follow the brand: green, navy and amber tints. */
const ACTIONS = [
  { href: "/hub/prices", label: "Check today's prices", hint: "LPG, diesel, petrol, CNG by state", icon: Tags, tint: "bg-brand-50 text-brand-700 ring-brand-600/15" },
  { href: "/hub?kind=OFFER", label: "Find supply", hint: "Verified sellers and refineries", icon: PackageSearch, tint: "bg-navy-50 text-navy-700 ring-navy-600/15" },
  { href: "/hub/jobs/new", label: "Move a load", hint: "Post a job, get haulier quotes", icon: Truck, tint: "bg-amber-50 text-amber-700 ring-amber-600/20" },
  { href: "/hub/gas", label: "Gas near me", hint: "Depots, refill plants, CNG", icon: Flame, tint: "bg-brand-50 text-brand-700 ring-brand-600/15" },
  { href: "/hub/supply", label: "Regular supply", hint: "Agreements and deliveries", icon: Repeat, tint: "bg-navy-50 text-navy-700 ring-navy-600/15" },
  { href: "/hub/post", label: "Post a listing", hint: "Sell, buy or offer trucks", icon: Megaphone, tint: "bg-amber-50 text-amber-700 ring-amber-600/20" },
] as const;

export function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="mb-8">
      <ul className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        {ACTIONS.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="group flex h-full flex-col items-center gap-1.5 rounded-2xl border border-ink-100 bg-white p-2.5 text-center text-ink-950 sm:items-start sm:gap-2 sm:p-4 sm:text-left no-underline shadow-card transition hover:-translate-y-0.5 hover:border-brand-600/40 hover:shadow-lift hover:no-underline">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ring-1 ring-inset ${a.tint}`}><a.icon aria-hidden size={20} strokeWidth={2} /></span>
              <span className="text-[12.5px] font-semibold leading-snug sm:text-sm">{a.label}</span>
              <span className="hidden text-xs leading-snug text-ink-600 sm:block">{a.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
