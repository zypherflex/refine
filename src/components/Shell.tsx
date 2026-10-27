import Link from "next/link";
import type { CurrentUser } from "@/server/auth";
import { hasRole } from "@/lib/permissions";
import { SignOut } from "./SignOut";
import { InstallApp } from "./AppInstall";
import { Logo, LogoMark } from "./Logo";
import { CompanySwitcher } from "./CompanySwitcher";
import { BottomTabs, NavLinks, type NavGroup } from "./NavLinks";
import { ResearchOnly } from "./ResearchContext";

export type { NavItem } from "./NavLinks";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

function UserCard({ user }: { user: CurrentUser }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-100 text-xs font-semibold text-navy-800 ring-1 ring-inset ring-navy-200">{initials(user.name)}</span>
      <div className="min-w-0 text-xs">
        <p className="truncate font-medium text-ink-950">{user.name}</p>
        <p className="truncate capitalize text-ink-600">{user.role.toLowerCase()} · {user.plan.toLowerCase()} plan</p>
      </div>
    </div>
  );
}

export function Shell({ user, children, companies, current, unread, hubUnread, company }: { user: CurrentUser; children: React.ReactNode; companies: { slug: string; name: string }[]; current: string; unread: number; hubUnread: number; company: { name: string; isFictional: boolean; coverageStatus: string } }) {
  const groups: NavGroup[] = [
    {
      label: "Trade hub",
      tone: "green",
      items: [
        { href: "/hub", label: "Buy, sell & deliver", icon: "hub" },
        { href: "/hub/prices", label: "Price board", icon: "prices" },
        { href: "/hub/gas", label: "Gas network", icon: "gas" },
        { href: "/hub/jobs", label: "Delivery jobs", icon: "jobs" },
        { href: "/hub/supply", label: "Supply agreements", icon: "supply" },
        { href: "/hub/refineries", label: "Refineries", icon: "refinery" },
      ],
    },
    {
      label: "My business",
      tone: "navy",
      items: [
        { href: "/hub/inbox", label: "Inbox", icon: "inbox", badge: hubUnread },
        { href: "/hub/me", label: "Profile & listings", icon: "business" },
        { href: "/watchlist", label: "Alerts", icon: "alerts", badge: unread },
      ],
    },
    {
      label: "Opportunities",
      tone: "amber",
      items: [
        { href: "/opportunities", label: "Business opportunities", icon: "opportunities" },
        { href: "/opportunities/fit", label: "Find my fit", icon: "fit" },
        { href: "/opportunities/tools", label: "Sizing tools", icon: "tools" },
        { href: "/opportunities/board", label: "My opportunity board", icon: "board" },
      ],
    },
    {
      label: "Research",
      tone: "slate",
      collapsible: true,
      items: [
        { href: "/dashboard", label: "Overview", icon: "overview" },
        { href: "/company", label: "Company profile", icon: "company" },
        { href: "/announcements", label: "Announcements & news", icon: "news" },
        { href: "/financials", label: "Financial reports", icon: "financials" },
        { href: "/operations", label: "Operational indicators", icon: "operations" },
        { href: "/risks", label: "Risk center", icon: "risks" },
        { href: "/market", label: "Market & macro context", icon: "gauge" },
        { href: "/refineries", label: "Global refineries", icon: "globe" },
        { href: "/thesis", label: "My investment thesis", icon: "thesis" },
        { href: "/assistant", label: "Research assistant", icon: "assistant" },
      ],
    },
    {
      label: "Sources",
      tone: "slate",
      collapsible: true,
      items: [
        { href: "/library", label: "Source library", icon: "library" },
        { href: "/corrections", label: "Corrections log", icon: "corrections" },
      ],
    },
  ];
  const staff = [];
  if (hasRole(user, "ANALYST")) staff.push({ href: "/editorial", label: "Editorial desk", icon: "editorial" as const });
  if (hasRole(user, "ADMIN")) staff.push({ href: "/admin", label: "Administration", icon: "admin" as const });
  if (staff.length) groups.push({ label: "Staff", tone: "slate", items: staff });
  groups.push({ label: "", items: [{ href: "/settings", label: "Account & plan", icon: "settings" }] });

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <div className="hidden w-[16.5rem] shrink-0 border-r border-ink-100 bg-white lg:block">
      <aside className="sticky top-0 flex h-screen flex-col">
        <div aria-hidden className="band-ng h-1 w-full" />
        <div className="px-5 pb-3 pt-5"><Link href="/hub" className="no-underline hover:no-underline"><Logo /></Link></div>
        <div className="px-3 pb-3"><Link href="/hub/prices" className="flex items-center justify-between rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 px-3.5 py-3 text-white no-underline shadow-card hover:no-underline hover:from-navy-800"><span><span className="block text-[10.5px] font-semibold uppercase tracking-eyebrow text-brand-300">Today</span><span className="text-sm font-semibold">Check fuel &amp; gas prices</span></span><span aria-hidden className="text-lg">→</span></Link></div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4"><NavLinks groups={groups} /><div className="mt-4"><InstallApp /></div></nav>
        <div className="border-t border-ink-100 px-5 py-4">
          <UserCard user={user} />
          <div className="mt-3"><SignOut className="text-xs font-medium text-ink-600 transition hover:text-ink-950" /></div>
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
                <div className="absolute left-0 z-40 mt-2 max-h-[75vh] w-[19rem] overflow-y-auto rounded-2xl bg-white p-3 shadow-lift ring-1 ring-ink-100">
                  <div className="mb-3"><InstallApp /></div>
                  <nav aria-label="Main"><NavLinks groups={groups} /></nav>
                  <div className="mt-2 border-t border-ink-100 px-2 pt-3"><UserCard user={user} />
                    <div className="mt-2"><SignOut className="text-xs font-medium text-ink-600" /></div>
                  </div>
                </div>
              </details>
              <Link href="/hub" className="no-underline hover:no-underline lg:hidden" aria-label="RefineryLens trade hub"><span className="hidden sm:inline"><Logo size={26} /></span><span className="sm:hidden"><LogoMark size={28} /></span></Link>
              <ResearchOnly><p className="hidden text-xs font-medium uppercase tracking-eyebrow text-ink-500 lg:block">Research coverage · times in WAT (Lagos)</p></ResearchOnly>
            </div>
            <div className="flex items-center gap-2">
              <ResearchOnly><CompanySwitcher companies={companies} current={current} /></ResearchOnly>
              <Link href="/hub/inbox" className="relative grid h-9 w-9 place-items-center rounded-full text-ink-700 hover:bg-ink-50" aria-label={`Inbox${hubUnread ? `, ${hubUnread} unread` : ""}`}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
                {!!hubUnread && <span className="num absolute right-0.5 top-0.5 rounded-full bg-brand-600 px-1 text-[9px] font-semibold leading-4 text-white">{hubUnread}</span>}
              </Link>
              <Link href="/watchlist" className="relative grid h-9 w-9 place-items-center rounded-full text-ink-700 hover:bg-ink-50" aria-label={`Alerts${unread ? `, ${unread} unread` : ""}`}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
                {!!unread && <span className="num absolute right-0.5 top-0.5 rounded-full bg-brand-600 px-1 text-[9px] font-semibold leading-4 text-white">{unread}</span>}
              </Link>
            </div>
          </div>
          <ResearchOnly>
          {company.isFictional ? (
            <div className="border-t border-amber-600/20 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800 sm:px-8" role="note">
              Fictional demonstration company. Every figure, document and news item for “{company.name}” is invented sample data and is not a result of any real company, including Dangote.
            </div>
          ) : (
            <div className="border-t border-ink-100 bg-ink-50 px-4 py-1.5 text-center text-xs text-ink-600 sm:px-8" role="note">
              Independent research. RefineryLens is not affiliated with {company.name}. Not investment advice.
            </div>
          )}
          </ResearchOnly>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-8 sm:pt-8 lg:pb-10">{children}</main>
        <footer className="border-t border-ink-100 bg-white px-4 pb-24 pt-5 text-xs text-ink-600 sm:px-8 lg:pb-5">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} RefineryLens · <Link href="/privacy">Privacy</Link></p>
            <p className="max-w-2xl sm:text-right">Provenance labels describe who published information, not whether it is accurate. Nothing here is a recommendation to buy or sell.</p>
          </div>
        </footer>
      </div>
      <BottomTabs
        items={[
          { href: "/hub", label: "Hub", icon: "hub" },
          { href: "/hub/prices", label: "Prices", icon: "prices" },
          { href: "/hub/gas", label: "Gas map", icon: "gas" },
          { href: "/hub/jobs", label: "Jobs", icon: "jobs" },
          { href: "/hub/inbox", label: "Inbox", icon: "inbox", badge: hubUnread },
        ]}
      />
    </div>
  );
}
