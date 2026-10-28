"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, Building2, ClipboardCheck, Factory, FileStack, Gauge, History, Inbox, Repeat, Tags, Truck, LayoutDashboard, Lightbulb, MessagesSquare, Newspaper, Settings, ShieldAlert, Store, Users, Warehouse } from "lucide-react";

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
  hub: Store,
  inbox: Inbox,
  refinery: Factory,
  business: Warehouse,
  prices: Tags,
  jobs: Truck,
  supply: Repeat,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof icons; badge?: number };
export type NavGroup = { label: string; items: NavItem[] };

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  // The item whose link is the longest prefix of the current path is active, so /hub/jobs lights up Delivery jobs, not /hub.
  const matches = groups.flatMap((g) => g.items.map((i) => i.href)).filter((h) => path === h || (h !== "/dashboard" && path.startsWith(`${h}/`)));
  const best = matches.sort((a, b) => b.length - a.length)[0];
  return (
    <div className="space-y-5">
      {groups.map((g, gi) => (
        <div key={g.label || gi}>
          {g.label && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-eyebrow text-sun-700">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = i.href === best;
              const Icon = icons[i.icon];
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium no-underline transition hover:no-underline ${active ? "bg-brand-50 text-brand-800" : "text-navy-700 hover:bg-brand-50/60 hover:text-brand-800"}`}
                  >
                    {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-gradient-to-b from-brand-500 to-sun-500" />}
                    <Icon aria-hidden size={16} strokeWidth={1.8} className={active ? "text-brand-600" : "text-navy-400 group-hover:text-brand-600"} />
                    <span className="flex-1">{i.label}</span>
                    {!!i.badge && <span className="num rounded-full bg-sun-500 px-1.5 py-px text-[10px] font-semibold text-white" aria-label={`${i.badge} unread`}>{i.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
