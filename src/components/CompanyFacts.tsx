import type { CompanyFact } from "@/lib/company-facts";
import { fmtDate } from "@/lib/format";
import { Pill, SourceLink } from "./ui";

function path(url: string) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

export function FactSource({ f }: { f: CompanyFact }) {
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-600">
      <Pill className="bg-ink-100 text-ink-900">Company-disclosed</Pill>
      {f.claim && <Pill className="bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/40">Company claim, not verified</Pill>}
      <SourceLink href={f.sourceUrl}>{path(f.sourceUrl)}</SourceLink>
      <span>· retrieved {fmtDate(f.retrievedAt)}</span>
    </span>
  );
}

/** Headline tiles built only from company-stated figures, each with its source. */
export function ScaleTiles({ facts, dark = false }: { facts: CompanyFact[]; dark?: boolean }) {
  const tiles = facts.filter((f) => f.figure);
  if (tiles.length === 0) return null;
  return (
    <ul className={`grid grid-cols-1 gap-px overflow-hidden rounded-2xl min-[420px]:grid-cols-2 lg:grid-cols-4 ${dark ? "bg-white/20 ring-1 ring-white/20" : "bg-ink-100 ring-1 ring-ink-100"}`}>
      {tiles.map((f) => (
        <li key={f.label} className={dark ? "bg-white/10 p-5 backdrop-blur-sm" : "bg-white p-5"}>
          <p className={`num font-serif text-3xl font-semibold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-ink-950"}`}>{f.figure}</p>
          <p className={`mt-1 text-sm ${dark ? "text-white/85" : "text-ink-600"}`}>{f.unit}</p>
          <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className={`mt-3 inline-block text-[11px] font-medium ${dark ? "text-white underline decoration-white/50" : "text-brand-700"}`}>
            Company-stated · source ↗<span className="sr-only"> (opens the company page in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function FactList({ facts }: { facts: CompanyFact[] }) {
  return (
    <dl className="divide-y divide-ink-100">
      {facts.map((f) => (
        <div key={f.label} className="grid gap-1 py-3 sm:grid-cols-3">
          <dt className="text-sm font-medium text-ink-800">{f.label}</dt>
          <dd className="text-sm sm:col-span-2">
            {f.value}
            <FactSource f={f} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
