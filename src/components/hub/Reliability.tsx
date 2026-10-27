import { COMPONENTS, RELIABILITY_MIN_RECORDS, SETTLE_DAYS, type Component } from "@/server/hub/reliability";
import { translator, type T } from "@/lib/i18n/hub";
import { Explainer } from "../ui";

/** Reliability score with its parts and formula. */
export function Reliability({ r, t = translator("en") }: { r: { confirmed: number; due: number; components: Component[]; score: number | null }; t?: T }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-ink-950">{t("rel.title")}</p>
        {r.score != null ? <p><span className="num text-2xl font-semibold text-ink-950">{r.score}</span><span className="text-xs text-ink-600"> / 100</span></p> : <p className="text-xs text-ink-600">{t("rel.notEnough", { n: r.confirmed, min: RELIABILITY_MIN_RECORDS })}</p>}
      </div>
      <ul className="mt-3 space-y-2">
        {r.components.map((c) => (
          <li key={c.key} className="text-xs">
            <div className="flex justify-between gap-2"><span className="text-ink-700">{COMPONENTS[c.key].label}</span><span className="num text-ink-950">{c.n ? `${Math.round(c.value * 100)}% of ${c.n}` : "No data yet"}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-ink-100" aria-hidden><div className="h-1.5 rounded-full bg-ink-800" style={{ width: `${c.n ? Math.round(c.value * 100) : 0}%` }} /></div>
          </li>
        ))}
      </ul>
      <Explainer title="How the score is worked out">
        <p>Only trades on RefineryLens count, and only once both sides confirm them. A delivery still unconfirmed {SETTLE_DAYS} days after it was due counts as not confirmed.</p>
        <p>Score = weighted average of the parts that have data: {Object.values(COMPONENTS).map((c) => `${c.label.toLowerCase()} ${Math.round(c.weight * 100)}%`).join(", ")}. It is shown after {RELIABILITY_MIN_RECORDS} confirmed deliveries.</p>
        <p>It describes this business&apos;s record on RefineryLens. It is not a credit rating, a guarantee or advice.</p>
      </Explainer>
    </div>
  );
}
