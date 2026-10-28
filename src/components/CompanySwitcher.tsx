"use client";
import { usePathname } from "next/navigation";
import { selectCompanyAction } from "@/app/actions/company";

export function CompanySwitcher({ companies, current }: { companies: { slug: string; name: string }[]; current: string }) {
  const path = usePathname();
  return (
    <form action={selectCompanyAction} className="flex min-w-0 items-center gap-2">
      <input type="hidden" name="back" value={path} />
      <label htmlFor="company-switch" className="sr-only">Company</label>
      <div className="relative min-w-0">
        <select
          id="company-switch"
          name="company"
          defaultValue={current}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="w-full max-w-[12rem] appearance-none truncate rounded-lg border border-navy-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-navy-900 shadow-sm hover:border-navy-300 focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/15 sm:max-w-[20rem]"
        >
          {companies.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <svg aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </div>
      <noscript><button className="btn-secondary btn-sm">Go</button></noscript>
    </form>
  );
}
