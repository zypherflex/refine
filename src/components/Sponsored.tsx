import { sponsorFor, type PlacementId } from "@/server/sponsor";

/** One labelled sponsored card for a placement, or nothing. The label is always shown, and links are rel="sponsored". */
export async function Sponsored({ placement, state }: { placement: PlacementId; state?: string | null }) {
  const s = await sponsorFor(placement, state).catch(() => null);
  if (!s) return null;
  return (
    <aside aria-label={`Sponsored by ${s.sponsor}`} className="rounded-2xl border border-dashed border-navy-200 bg-navy-50/50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-eyebrow text-navy-700">Sponsored · {s.sponsor}</p>
      <p className="mt-1 font-semibold text-ink-950">{s.headline}</p>
      <p className="mt-0.5 text-sm text-ink-700">{s.body}</p>
      <a href={`/go/${s.id}`} rel="sponsored noopener" target="_blank" className="mt-2 inline-block text-sm font-medium">Learn more ↗</a>
    </aside>
  );
}
