import { SIGNAL_LABELS, type SignalPoint } from "@/lib/opportunities/signals";
import { Unavailable } from "../ui";

export function MarketPanel({ keys, points, title = "Market signals" }: { keys: string[]; points: SignalPoint[]; title?: string }) {
  const byKey = new Map(points.map((p) => [p.key, p]));
  const missing = keys.filter((k) => !byKey.has(k));
  return (
    <section aria-labelledby="mkt-h">
      <h2 id="mkt-h" className="h-section">{title}</h2>
      <p className="muted">Free public benchmarks, cached by RefineryLens and shown with their publisher. Benchmarks from other regions are context, not Nigerian prices.</p>
      {points.length > 0 && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {keys.filter((k) => byKey.has(k)).map((k) => {
            const p = byKey.get(k)!;
            return (
              <li key={k} className="rounded-xl border border-ink-100 bg-white p-3 shadow-card">
                <p className="text-xs font-medium text-ink-600">{p.label}</p>
                <p className="num mt-0.5 text-lg font-semibold">{p.value.toLocaleString("en-GB", { maximumFractionDigits: 3 })} <span className="text-sm font-normal text-ink-600">{p.unit}</span></p>
                <p className="mt-1 text-[11px] text-ink-500">{p.period} · <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{p.attribution || p.sourceName}</a></p>
              </li>
            );
          })}
        </ul>
      )}
      {missing.length > 0 && (
        <div className="mt-3">
          <Unavailable title={points.length ? "Some series are not loaded" : "Market data is not loaded yet"}>
            No reviewed data is available for: {missing.map((k) => SIGNAL_LABELS[k] ?? k).join(", ")}. RefineryLens does not fill gaps with estimates. Sizing tools still work with your own numbers.
          </Unavailable>
        </div>
      )}
    </section>
  );
}
