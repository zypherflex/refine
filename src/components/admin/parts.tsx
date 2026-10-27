import Link from "next/link";

/** A key number with an optional comparison line, for the admin overview and section headers. */
export function Stat({ label, value, sub, href, tone = "plain" }: { label: string; value: string | number; sub?: string; href?: string; tone?: "plain" | "warn" | "good" }) {
  const body = (
    <>
      <p className="text-xs text-ink-600">{label}</p>
      <p className={`num mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-700" : tone === "good" ? "text-brand-800" : "text-ink-950"}`}>{typeof value === "number" ? value.toLocaleString("en-GB") : value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-600">{sub}</p>}
    </>
  );
  return href ? <Link href={href} className="card block no-underline transition hover:shadow-lg hover:no-underline">{body}</Link> : <div className="card">{body}</div>;
}

/** A GET form of filters; submitting keeps everything in the address, so filtered views can be shared and bookmarked. */
export function FilterBar({ action, children }: { action: string; children: React.ReactNode }) {
  return (
    <form action={action} className="card mb-4 flex flex-wrap items-end gap-3 py-3">
      {children}
      <button className="btn-secondary btn-sm">Apply</button>
      <Link href={action} className="btn-ghost btn-sm no-underline">Clear</Link>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs font-medium text-ink-700">{label}{children}</label>;
}

export function Select({ name, value, options, all = "All" }: { name: string; value?: string; options: readonly (string | readonly [string, string])[]; all?: string | null }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="input w-auto py-1.5 text-sm">
      {all !== null && <option value="">{all}</option>}
      {options.map((o) => (typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o[0]} value={o[0]}>{o[1]}</option>))}
    </select>
  );
}

/** Previous and next links that keep the current filters. */
export function Pager({ base, params, page, total, size }: { base: string; params: Record<string, string | undefined>; page: number; total: number; size: number }) {
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) => `${base}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>, page: String(p) })}`;
  return (
    <nav aria-label="Pages" className="mt-3 flex items-center justify-between text-sm">
      <span className="text-ink-600">{total.toLocaleString("en-GB")} result{total === 1 ? "" : "s"} · page {page} of {pages}</span>
      <span className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="btn-secondary btn-sm no-underline">← Previous</Link>}
        {page < pages && <Link href={href(page + 1)} className="btn-secondary btn-sm no-underline">Next →</Link>}
      </span>
    </nav>
  );
}

export function Badge({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "good" | "warn" | "bad" | "navy" }) {
  const cls = { plain: "bg-ink-100 text-ink-700", good: "bg-brand-100 text-brand-800", warn: "bg-amber-100 text-amber-800", bad: "bg-risk-100 text-risk-800", navy: "bg-navy-100 text-navy-800" }[tone];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

/** Bars for a short daily series, drawn inline so the overview needs no chart library. */
export function DailyBars({ data, label }: { data: { day: string; n: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  return (
    <figure>
      <div role="img" aria-label={`${label}: ${data.map((d) => `${d.day} ${d.n}`).join(", ")}`} className="flex h-28 items-end gap-1">
        {data.map((d) => (
          <div key={d.day} className="group flex h-full flex-1 flex-col items-center justify-end">
            <span className="num mb-0.5 text-[10px] text-ink-500 opacity-0 group-hover:opacity-100">{d.n}</span>
            <div className="w-full rounded-t bg-brand-600" style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-[10px] text-ink-500"><span>{data[0]?.day}</span><span>{data.at(-1)?.day}</span></figcaption>
    </figure>
  );
}
