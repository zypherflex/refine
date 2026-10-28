import Link from "next/link";
import type { Provenance, PublicationStatus, Level } from "@prisma/client";
import { provenanceHelp, provenanceLabel, statusLabel, levelLabel } from "@/lib/labels";

const provStyle: Record<Provenance, string> = {
  COMPANY_DISCLOSED: "bg-navy-100 text-navy-900",
  REGULATOR_EXCHANGE: "bg-brand-100 text-brand-800",
  INDEPENDENT_REPORT: "bg-white text-navy-800 ring-1 ring-inset ring-navy-600/30",
  ANALYST_ESTIMATE: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/40",
  USER_ASSUMPTION: "bg-navy-50 text-navy-800 ring-1 ring-dashed ring-navy-600/40",
  UNVERIFIED: "bg-amber-100 text-amber-800",
};

export function Pill({ className = "", children, title }: { className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4 ${className}`}>
      {children}
    </span>
  );
}

export function ProvenanceBadge({ p }: { p: Provenance }) {
  return (
    <Pill className={provStyle[p]} title={provenanceHelp[p]}>
      {provenanceLabel[p]}
    </Pill>
  );
}

export function StatusBadge({ s }: { s: PublicationStatus }) {
  const style: Record<PublicationStatus, string> = {
    DRAFT: "bg-navy-100 text-navy-800",
    IN_REVIEW: "bg-amber-100 text-amber-800",
    PUBLISHED: "bg-brand-100 text-brand-800",
    RETRACTED: "bg-risk-100 text-risk-800",
    SUPERSEDED: "bg-navy-100 text-navy-700 line-through decoration-1",
  };
  return <Pill className={style[s]}>{s === "PUBLISHED" ? "Reviewed and published" : statusLabel[s]}</Pill>;
}

export function LevelBadge({ kind, level }: { kind: "Impact if it happens" | "Confidence it will happen"; level: Level }) {
  const style: Record<Level, string> = { LOW: "bg-navy-50 text-navy-800 ring-1 ring-inset ring-navy-100", MODERATE: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/40", HIGH: "bg-risk-50 text-risk-800 ring-1 ring-inset ring-risk-600/40" };
  return (
    <Pill className={style[level]}>
      {kind}: {levelLabel[level]}
    </Pill>
  );
}

export function FictionTag() {
  return <Pill className="bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/50">Fictional sample data</Pill>;
}

export function Explainer({ title = "Technical detail", children }: { title?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-2 rounded-lg border border-navy-100 bg-navy-50/70 text-sm">
      <summary className="flex items-center gap-2 px-3 py-2 font-medium text-navy-800 hover:text-navy-950">
        <span aria-hidden className="text-brand-700 transition-transform group-open:rotate-90">›</span>
        {title}
      </summary>
      <div className="space-y-2 border-t border-navy-100 px-3 pb-3 pt-2 text-navy-800">{children}</div>
    </details>
  );
}

export function Unavailable({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-navy-300 bg-white/70 px-4 py-3 text-sm" role="note">
      <p className="font-medium text-navy-900">{title}</p>
      {children && <div className="mt-1 text-navy-600">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-navy-200 bg-white px-5 py-8 text-center">
      <span aria-hidden className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-navy-50 text-navy-500 ring-1 ring-navy-100">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" strokeLinecap="round" /></svg>
      </span>
      <p className="font-medium text-navy-950">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-prose text-sm text-navy-600">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "risk" | "ok"; title?: string; children: React.ReactNode }) {
  const style = {
    info: "border-navy-100 bg-white before:bg-navy-300",
    warn: "border-amber-600/25 bg-amber-50 before:bg-amber-600",
    risk: "border-risk-600/25 bg-risk-50 before:bg-risk-600",
    ok: "border-brand-600/25 bg-brand-50 before:bg-brand-600",
  }[tone];
  return (
    <div className={`relative overflow-hidden rounded-xl border py-3 pl-4 pr-4 text-sm shadow-card before:absolute before:inset-y-0 before:left-0 before:w-1 ${style}`} role={tone === "risk" ? "alert" : "status"}>
      {title && <p className="font-semibold text-navy-950">{title}</p>}
      <div className={`text-navy-800 ${title ? "mt-0.5" : ""}`}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-navy-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="h-page">{title}</h1>
        {subtitle && <div className="mt-2 max-w-3xl text-sm leading-relaxed text-navy-600">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ id, title, action, note }: { id?: string; title: string; action?: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="h-section">{title}</h2>
      {note && <span className="text-xs text-navy-600">{note}</span>}
      {action && <span className="text-sm">{action}</span>}
    </div>
  );
}

export function SourceLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!href) return <span>{children}</span>;
  const external = /^https?:/.test(href);
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow">
      {children}
      <span className="sr-only"> (opens original source in a new tab)</span> ↗
    </a>
  ) : (
    <Link href={href}>{children}</Link>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-2 rounded-lg border border-risk-600/20 bg-risk-50 px-3 py-2 text-sm text-risk-800" role="alert">
      {message}
    </p>
  );
}
