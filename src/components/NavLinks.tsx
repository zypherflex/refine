"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BookOpen, Building2, ClipboardCheck, Factory, FileStack, Gauge, History, Inbox, LayoutDashboard, Lightbulb, MessagesSquare, Newspaper, Settings, ShieldAlert, Store, Users, Warehouse } from "lucide-react";

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
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof icons; badge?: number };
export type NavGroup = { label: string; items: NavItem[] };

export function NavLinks({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <div className="space-y-5">
      {groups.map((g, gi) => (
        <div key={g.label || gi}>
          {g.label && <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-eyebrow text-navy-500">{g.label}</p>}
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const active = path === i.href || (i.href !== "/dashboard" && path.startsWith(i.href));
              const Icon = icons[i.icon];
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium no-underline transition hover:no-underline ${active ? "bg-white/[0.08] text-white" : "text-navy-300 hover:bg-white/[0.04] hover:text-white"}`}
                  >
                    {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-teal-400" />}
                    <Icon aria-hidden size={16} strokeWidth={1.8} className={active ? "text-teal-400" : "text-navy-500 group-hover:text-navy-200"} />
                    <span className="flex-1">{i.label}</span>
                    {!!i.badge && <span className="num rounded-full bg-teal-500 px-1.5 py-px text-[10px] font-semibold text-navy-950" aria-label={`${i.badge} unread`}>{i.badge}</span>}
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
