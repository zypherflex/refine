"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type HubTab = { href: string; label: string };

export function HubTabs({ tabs }: { tabs: HubTab[] }) {
  const path = usePathname();
  const current = tabs.filter((t) => path === t.href || (t.href !== "/hub" && path.startsWith(t.href))).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label="Trade hub" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-wrap">
        {tabs.map((t) => {
          const active = t.href === current;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className={`-mb-px block border-b-2 px-3 py-2 text-sm font-medium no-underline hover:no-underline ${active ? "border-brand-600 text-ink-950" : "border-transparent text-ink-600 hover:text-ink-950"}`}>{t.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
