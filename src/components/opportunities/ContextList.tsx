import { SOURCES, type SourceId } from "@/lib/opportunities/sources";
import { ProvenanceBadge, SourceLink } from "../ui";
import { fmtDate } from "@/lib/format";

const stanceStyle = { tailwind: "bg-brand-50 text-brand-800", headwind: "bg-risk-50 text-risk-800", neutral: "bg-ink-50 text-ink-700" } as const;
const stanceLabel = { tailwind: "Helps the case", headwind: "Works against it", neutral: "Context" } as const;

export function SourceLine({ id }: { id: SourceId }) {
  const s = SOURCES[id];
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-600">
      <ProvenanceBadge p={s.provenance} />
      <SourceLink href={s.url}>{s.publisher}: {s.title}</SourceLink>
      <span>{s.publishedAt ? `published ${fmtDate(s.publishedAt)}` : "undated web page"}, retrieved {fmtDate(s.retrievedAt)}</span>
    </span>
  );
}

export function ContextList({ items }: { items: { text: string; source: SourceId; stance?: keyof typeof stanceStyle }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((c, i) => (
        <li key={i} className="rounded-lg border border-ink-100 bg-white p-3">
          {c.stance && <span className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${stanceStyle[c.stance]}`}>{stanceLabel[c.stance]}</span>}
          <p className="text-sm text-ink-900">{c.text}</p>
          <div className="mt-1.5"><SourceLine id={c.source} /></div>
        </li>
      ))}
    </ul>
  );
}
