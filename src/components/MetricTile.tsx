import Link from "next/link";
import type { Metric } from "@prisma/client";
import { fmtNumber } from "@/lib/format";
import { unitLabel } from "@/lib/calculations";
import { provenanceLabel } from "@/lib/labels";

export function TileFrame({ label, children, muted = false }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className={`flex flex-col rounded-xl border p-4 ${muted ? "border-dashed border-ink-200 bg-white/60" : "border-ink-100 bg-white shadow-card"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      {children}
    </div>
  );
}

export function MetricTile({ label, m, href }: { label: string; m: (Metric & { document?: { id: string; title: string } | null }) | null; href: string }) {
  if (!m || m.disclosureStatus === "NOT_DISCLOSED" || m.value === null) {
    return (
      <TileFrame label={label} muted>
        <p className="mt-2 text-sm font-semibold text-ink-700">{m?.disclosureStatus === "NOT_DISCLOSED" ? "Not publicly disclosed" : "No verified figure"}</p>
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-600">{m?.notes || "RefineryLens shows figures only when a reviewed source supports them."}</p>
      </TileFrame>
    );
  }
  const v = Number(m.value);
  return (
    <TileFrame label={label}>
      <p className="num mt-2 text-2xl font-semibold tracking-tight text-ink-950">
        {fmtNumber(v)} <span className="text-sm font-medium tracking-normal text-ink-600">{m.unit === "%" ? "%" : unitLabel(m)}</span>
      </p>
      <p className="mt-1 text-xs text-ink-600">
        {m.periodLabel} · {m.scope === "GROUP" ? "group" : m.scope === "REFINERY" ? "refinery" : "sector"} · {m.valueType === "REPORTED" ? provenanceLabel[m.provenance].toLowerCase() : m.valueType.toLowerCase()}
        {m.auditStatus !== "NOT_APPLICABLE" && ` · ${m.auditStatus.toLowerCase()}`}
      </p>
      <div className="mt-auto pt-2">
        {m.document ? (
          <Link href={`/documents/${m.document.id}?page=${m.page ?? 1}`} className="text-xs font-medium">Source, page {m.page ?? 1} →</Link>
        ) : (
          <Link href={href} className="text-xs font-medium">Details →</Link>
        )}
      </div>
    </TileFrame>
  );
}
