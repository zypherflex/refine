"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fuel, PiggyBank, ShoppingBag, Sun, Bell, BookOpen, Briefcase, Building2, Calculator, ClipboardCheck, Compass, Factory, FileStack, Flame, Gauge, Globe2, History, Inbox, LayoutDashboard, Lightbulb, Menu, MessagesSquare, Newspaper, Repeat, Settings, ShieldAlert, SquareKanban, Store, Tags, Truck, Users, Warehouse, ChevronRight } from "lucide-react";

const icons = {
  overview: LayoutDashboard,
  company: Building2,
  news: Newspaper,
  financials: FileStack,
  operations: Factory,
  risks: ShieldAlert,
  thesis: Lightbulb,
  assistant: MessagesSquare,
  alerts: Bell,
  library: BookOpen,
  corrections: History,
  editorial: ClipboardCheck,
  admin: Users,
  settings: Settings,
  gauge: Gauge,
  globe: Globe2,
  opportunities: Briefcase,
  tools: Calculator,
  board: SquareKanban,
  fit: Compass,
  hub: Store,
  gas: Flame,
  prices: Tags,
  jobs: Truck,
  supply: Repeat,
  inbox: Inbox,
  refinery: Factory,
  business: Warehouse,
  menu: Menu,
  today: Sun,
  stations: Fuel,
  order: ShoppingBag,
  savings: PiggyBank,
} as const;

export type IconName = keyof typeof icons;
export type NavItem = { href: string; label: string; icon: IconName; badge?: number };
/** `tone` tints the group's icons so each part of the product is recognisable at a glance. */
export type NavGroup = { label: string; items: NavItem[]; tone?: "green" | "navy" | "amber" | "slate"; collapsible?: boolean };

const toneIcon = { green: "text-brand-600", navy: "text-navy-600", amber: "text-amber-600", slate: "text-ink-500" } as const;

/** The most specific matching link wins, so /hub/gas does not also highlight /hub. */
function useCurrent(hrefs: string[]) {
  const path = usePathname();
  return hrefs.filter((h) => path === h || (h !== "/dashboard" && path.startsWith(h + "/"))).sort((a, b) => b.length - a.length)[0];
}

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const current = useCurrent(groups.flatMap((g) => g.items.map((i) => i.href)));
  return (
    <div className="space-y-4">
      {groups.map((g, gi) => {
        const list = (
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = i.href === current;
              const Icon = icons[i.icon];
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium no-underline transition hover:no-underline ${active ? "bg-brand-50 text-brand-900 ring-1 ring-inset ring-brand-600/15" : "text-ink-700 hover:bg-ink-50 hover:text-ink-950"}`}
                  >
                    {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand-600" />}
                    <Icon aria-hidden size={17} strokeWidth={1.9} className={active ? "text-brand-700" : toneIcon[g.tone ?? "slate"]} />
                    <span className="flex-1">{i.label}</span>
                    {!!i.badge && <span className="num rounded-full bg-brand-600 px-1.5 py-px text-[10px] font-semibold text-white" aria-label={`${i.badge} unread`}>{i.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        );
        if (g.collapsible) {
          const holdsCurrent = g.items.some((i) => i.href === current);
          return (
            <details key={g.label || gi} open={holdsCurrent} className="group/nav">
              <summary className="mb-1 flex items-center gap-1 rounded-md px-3 py-1 text-[10.5px] font-semibold uppercase tracking-eyebrow text-ink-500 hover:text-ink-800">
                <ChevronRight aria-hidden size={13} className="transition-transform group-open/nav:rotate-90" />
                {g.label}
              </summary>
              {list}
            </details>
          );
        }
        return (
          <div key={g.label || gi}>
            {g.label && <p className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-eyebrow text-ink-500">{g.label}</p>}
            {list}
          </div>
        );
      })}
    </div>
  );
}

/** Phone tab bar: the five places people go most, always one tap away. */
export function BottomTabs({ items }: { items: NavItem[] }) {
  const current = useCurrent(items.map((i) => i.href));
  return (
    <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_20px_-8px_rgba(11,21,48,0.15)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-md">
        {items.map((i) => {
          const active = i.href === current;
          const Icon = icons[i.icon];
          return (
            <li key={i.href} className="flex-1">
              <Link href={i.href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[11px] font-medium no-underline hover:no-underline ${active ? "text-brand-700" : "text-ink-600"}`}>
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-brand-600" />}
                <span className="relative">
                  <Icon aria-hidden size={21} strokeWidth={active ? 2.2 : 1.8} />
                  {!!i.badge && <span className="num absolute -right-2 -top-1.5 rounded-full bg-brand-600 px-1 text-[9px] font-semibold leading-4 text-white">{i.badge}</span>}
                </span>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
