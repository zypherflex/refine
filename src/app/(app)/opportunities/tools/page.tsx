import Link from "next/link";
import { CALCULATORS } from "@/lib/opportunities/calculators";
import { OPPORTUNITIES } from "@/lib/opportunities/catalog";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Sizing tools" };

export default function ToolsPage() {
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/opportunities">← All opportunities</Link></p>
      <PageHeader eyebrow="Opportunities" title="Sizing tools" subtitle="Quick, transparent calculators for first-pass business cases. Every result shows its formula, and every input is yours. They are no substitute for quotes, a feasibility study or professional advice." />
      <ul className="grid gap-4 md:grid-cols-2">
        {Object.values(CALCULATORS).map((c) => {
          const used = OPPORTUNITIES.filter((o) => o.calculator?.id === c.id);
          return (
            <li key={c.id} className="card">
              <h2 className="text-base font-semibold"><Link href={`/opportunities/tools/${c.id}`}>{c.name}</Link></h2>
              <p className="mt-1 text-sm text-ink-700">{c.summary}</p>
              {used.length > 0 && <p className="mt-2 text-xs text-ink-600">Used for: {used.map((o) => o.title).join("; ")}</p>}
            </li>
          );
        })}
      </ul>
    </>
  );
}
