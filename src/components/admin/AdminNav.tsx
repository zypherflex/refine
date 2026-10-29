"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminNavGroup = { label: string; items: { href: string; label: string; badge?: number }[] };

/** Section navigation for the admin console: a rail on wide screens, a scrolling strip on phones. */
export function AdminNav({ groups }: { groups: AdminNavGroup[] }) {
  const path = usePathname();
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  const current = all.filter((h) => path === h || (h !== "/admin" && path.startsWith(h + "/"))).sort((a, b) => b.length - a.length)[0];
  return (
    <nav aria-label="Administration" className="min-w-0 lg:sticky lg:top-24">
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-4 lg:overflow-visible lg:px-0">
        {groups.map((g) => (
          <div key={g.label} className="flex shrink-0 gap-1 lg:block">
            <p className="hidden px-3 pb-1 text-[11px] font-semibold uppercase tracking-eyebrow text-ink-500 lg:block">{g.label}</p>
            <ul className="flex gap-1 lg:block lg:space-y-0.5">
              {g.items.map((i) => {
                const active = i.href === current;
                return (
                  <li key={i.href} className="shrink-0">
                    <Link href={i.href} aria-current={active ? "page" : undefined} className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm no-underline hover:no-underline ${active ? "bg-ink-950 font-medium text-white" : "text-ink-700 hover:bg-ink-100"}`}>
                      {i.label}
                      {!!i.badge && <span className={`num rounded-full px-1.5 text-[11px] font-semibold leading-5 ${active ? "bg-white text-ink-950" : "bg-amber-100 text-amber-800"}`}>{i.badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
