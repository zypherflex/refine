import Link from "next/link";
import { Bell } from "lucide-react";
import { getCurrentUser } from "@/server/auth";
import { unreadCount } from "@/server/services/alerts";
import { Logo } from "@/components/Logo";
import { BottomTabs } from "@/components/NavLinks";
import { SignOut } from "@/components/SignOut";
import { PushBootstrap } from "@/components/native/Push";

const NAV = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/stations", label: "Stations", icon: "stations" },
  { href: "/my-gas", label: "My gas", icon: "gas" },
  { href: "/order", label: "Order gas", icon: "order" },
  { href: "/cng-savings", label: "CNG savings", tab: "CNG", icon: "savings" },
] as const;

/**
 * The everyday pages: open to everyone without signing in, for households, drivers and keke riders. Signing in is
 * asked for only to report, track a cylinder or order gas.
 */
export default async function EverydayLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await unreadCount(user.id) : 0;
  return (
    <div className="flex min-h-screen flex-col bg-ink-50/60">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/95 backdrop-blur">
        <div aria-hidden className="band-brand h-1 w-full" />
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/today" className="no-underline hover:no-underline"><Logo size={26} /></Link>
          <nav aria-label="Everyday" className="ml-4 hidden gap-1 text-sm lg:flex">
            {NAV.map((n) => <Link key={n.href} href={n.href} className="rounded-lg px-2.5 py-1.5 font-medium text-ink-700 no-underline hover:bg-ink-50 hover:no-underline">{n.label}</Link>)}
            <Link href="/order?for=family" className="rounded-lg px-2.5 py-1.5 font-medium text-amber-700 no-underline hover:bg-amber-50 hover:no-underline">Send gas home</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {user ? (
              <>
                <Link href="/watchlist" aria-label={`Alerts${unread ? `, ${unread} unread` : ""}`} className="relative rounded-lg p-2 text-ink-700 hover:bg-ink-50">
                  <Bell size={19} aria-hidden />
                  {unread > 0 && <span className="num absolute right-0.5 top-0.5 rounded-full bg-brand-600 px-1 text-[9px] font-semibold leading-4 text-white">{unread}</span>}
                </Link>
                <Link href="/hub" className="btn-ghost btn-sm hidden no-underline sm:inline-flex">Business hub</Link>
                <SignOut className="btn-ghost btn-sm" />
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost btn-sm no-underline">Sign in</Link>
                <Link href="/register" className="btn-primary btn-sm no-underline">Join free</Link>
              </>
            )}
          </div>
        </div>
      </header>
      {user && <PushBootstrap />}
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">{children}</main>
      <footer className="border-t border-ink-100 bg-white px-4 pb-24 pt-5 text-xs text-ink-600 sm:px-6 lg:pb-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} RefineryLens · <Link href="/privacy">Privacy</Link> · <Link href="/hub">For businesses</Link></p>
          <p className="max-w-xl sm:text-right">Prices are what members of the public and sellers reported, shown as medians. They are a guide, not a promise from any seller.</p>
        </div>
      </footer>
      <BottomTabs items={NAV.map((n) => ({ href: n.href, icon: n.icon, label: "tab" in n ? n.tab : n.label }))} />
    </div>
  );
}
