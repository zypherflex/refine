import Link from "next/link";
import type { CurrentUser } from "@/server/auth";
import { hasRole } from "@/lib/permissions";
import { logoutAction } from "@/app/actions/auth";
import { Logo, LogoMark } from "./Logo";
import { CompanySwitcher } from "./CompanySwitcher";
import { NavLinks, type NavGroup } from "./NavLinks";

export type { NavItem } from "./NavLinks";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function UserCard({ user }: { user: CurrentUser }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-300 ring-1 ring-inset ring-brand-400/30">{initials(user.name)}</span>
      <div className="min-w-0 text-xs">
        <p className="truncate font-medium text-white">{user.name}</p>
        <p className="truncate capitalize text-ink-300">{user.role.toLowerCase()} · {user.plan.toLowerCase()} plan</p>
      </div>
    </div>
  );
}

export function Shell({ user, children, companies, current, unread, company }: { user: CurrentUser; children: React.ReactNode; companies: { slug: string; name: string }[]; current: string; unread: number; company: { name: string; isFictional: boolean; coverageStatus: string } }) {
  const groups: NavGroup[] = [
    {
      label: "Opportunities",
      items: [
        { href: "/opportunities", label: "Business opportunities", icon: "opportunities" },
        { href: "/opportunities/tools", label: "Sizing tools", icon: "tools" },
        { href: "/opportunities/board", label: "My opportunity board", icon: "board" },
      ],
    },
    {
      label: "Research",
      items: [
        { href: "/dashboard", label: "Overview", icon: "overview" },
        { href: "/company", label: "Company profile", icon: "company" },
        { href: "/announcements", label: "Announcements & news", icon: "news" },
        { href: "/financials", label: "Financial reports", icon: "financials" },
        { href: "/operations", label: "Operational indicators", icon: "operations" },
        { href: "/risks", label: "Risk center", icon: "risks" },
        { href: "/market", label: "Market & macro context", icon: "gauge" },
        { href: "/refineries", label: "Global refineries", icon: "globe" },
      ],
    },
    {
      label: "Your work",
      items: [
        { href: "/thesis", label: "My investment thesis", icon: "thesis" },
        { href: "/assistant", label: "Research assistant", icon: "assistant" },
        { href: "/watchlist", label: "Watchlist & alerts", icon: "alerts", badge: unread },
      ],
    },
    {
      label: "Sources",
      items: [
        { href: "/library", label: "Source library", icon: "library" },
        { href: "/corrections", label: "Corrections log", icon: "corrections" },
      ],
    },
  ];
  const staff = [];
  if (hasRole(user, "ANALYST")) staff.push({ href: "/editorial", label: "Editorial desk", icon: "editorial" as const });
  if (hasRole(user, "ADMIN")) staff.push({ href: "/admin", label: "Administration", icon: "admin" as const });
  if (staff.length) groups.push({ label: "Staff", items: staff });
  groups.push({ label: "", items: [{ href: "/settings", label: "Account & plan", icon: "settings" }] });

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <div className="hidden w-[17rem] shrink-0 bg-ink-950 lg:block">
      <aside className="relative sticky top-0 flex h-screen flex-col bg-[radial-gradient(120%_60%_at_0%_0%,rgba(47,191,120,0.16),transparent_60%)] text-ink-200">
        <div aria-hidden className="bg-adire pointer-events-none absolute inset-0 opacity-[0.035]" />
        <div aria-hidden className="band-ng h-1 w-full opacity-90" />
        <div className="relative px-5 pb-4 pt-5"><Link href="/dashboard" className="no-underline hover:no-underline"><Logo light /></Link></div>
        <nav aria-label="Main" className="relative flex-1 overflow-y-auto px-3 pb-4"><NavLinks groups={groups} /></nav>
        <div className="relative border-t border-white/5 px-5 py-4">
          <UserCard user={user} />
          <form action={logoutAction} className="mt-3"><button className="text-xs font-medium text-ink-300 transition hover:text-white">Sign out</button></form>
        </div>
      </aside>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div aria-hidden className="band-ng h-1 w-full lg:hidden" />
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <details className="relative lg:hidden">
                <summary className="btn-secondary btn-sm py-1.5" aria-label="Open menu">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
                  Menu
                </summary>
                <div className="absolute left-0 z-40 mt-2 max-h-[78vh] w-[18rem] overflow-y-auto rounded-xl bg-ink-950 p-3 shadow-lift ring-1 ring-white/10">
                  <nav aria-label="Main"><NavLinks groups={groups} /></nav>
                  <div className="mt-2 border-t border-white/10 px-2 pt-3"><UserCard user={user} />
                    <form action={logoutAction} className="mt-2"><button className="text-xs font-medium text-ink-300">Sign out</button></form>
                  </div>
                </div>
              </details>
              <Link href="/dashboard" className="no-underline hover:no-underline lg:hidden" aria-label="RefineryLens overview"><span className="hidden sm:inline"><Logo size={26} /></span><span className="sm:hidden"><LogoMark size={28} /></span></Link>
              <p className="hidden text-xs font-medium uppercase tracking-eyebrow text-ink-500 lg:block">Coverage · times in WAT (Lagos)</p>
            </div>
            <CompanySwitcher companies={companies} current={current} />
          </div>
          {company.isFictional ? (
            <div className="border-t border-amber-600/20 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800 sm:px-8" role="note">
              Fictional demonstration company. Every figure, document and news item for “{company.name}” is invented sample data and is not a result of any real company, including Dangote.
            </div>
          ) : (
            <div className="border-t border-ink-100 bg-ink-50 px-4 py-1.5 text-center text-xs text-ink-600 sm:px-8" role="note">
              Independent research. RefineryLens is not affiliated with {company.name}. Not investment advice.
            </div>
          )}
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">{children}</main>
        <footer className="border-t border-ink-100 bg-white px-4 py-5 text-xs text-ink-600 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} RefineryLens. Independent research platform.</p>
            <p className="max-w-2xl sm:text-right">Provenance labels describe who published information, not whether it is accurate. Nothing here is a recommendation to buy or sell.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
