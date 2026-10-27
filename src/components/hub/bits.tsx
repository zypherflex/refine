import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { PRODUCTS, STATES_BY_NAME, UNITS } from "@/lib/hub/catalog";
import { displayName } from "@/lib/hub/rules";
import { translator, type T } from "@/lib/i18n/hub";
import { Notice, Pill } from "../ui";

type B = { id: string; name: string; verification: string; isSample?: boolean; plan?: string };
const EN = translator("en");

export function VerificationBadge({ v, t = EN }: { v: string; t?: T }) {
  if (v === "VERIFIED") return <Pill className="gap-1 bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/30"><BadgeCheck aria-hidden size={12} strokeWidth={2.2} />{t("badge.verified")}</Pill>;
  if (v === "PENDING") return <Pill className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-200">{t("badge.pending")}</Pill>;
  if (v === "SUSPENDED") return <Pill className="bg-risk-50 text-risk-800 ring-1 ring-inset ring-risk-600/30">{t("badge.suspended")}</Pill>;
  return <Pill className="bg-white text-ink-600 ring-1 ring-inset ring-ink-200">{t("badge.notVerified")}</Pill>;
}

export function SampleTag({ t = EN }: { t?: T }) {
  return <Pill className="bg-ink-50 text-ink-700 ring-1 ring-dashed ring-ink-300" title="Seeded to show how the hub works. Not a real business.">{t("badge.sample")}</Pill>;
}

export function PromotedTag({ t = EN }: { t?: T }) {
  return <Pill className="bg-ink-800 text-white" title="Paid placement. Promotion never changes verification or prices.">{t("badge.promoted")}</Pill>;
}

/** Shown only with a current Verified Business plan on a verified business. */
export function PlanTag({ t = EN }: { t?: T }) {
  return <Pill className="bg-ink-950 text-white" title="Verified Business plan member">{t("badge.vbPlan")}</Pill>;
}

export function BusinessName({ b, link = true, t = EN }: { b: B; link?: boolean; t?: T }) {
  const shown = displayName(b);
  const hidden = shown !== b.name;
  const name = hidden ? t("name.hidden") : shown;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {link ? <Link href={`/hub/business/${b.id}`} className={hidden ? "italic" : ""}>{name}</Link> : <span className={hidden ? "italic" : ""}>{name}</span>}
      <VerificationBadge v={b.verification} t={t} />
      {b.plan === "VERIFIED_BUSINESS" && b.verification === "VERIFIED" && <PlanTag t={t} />}
      {b.isSample && <SampleTag t={t} />}
    </span>
  );
}

export function AdvanceWarning({ t = EN }: { t?: T }) {
  return <Notice tone="warn" title={t("warn.title")}>{t("warn.body")}</Notice>;
}

export function StateSelect({ name = "state", id, value, label = "State", any }: { name?: string; id?: string; value?: string; label?: string; any?: string }) {
  const i = id ?? name;
  return (
    <div>
      <label htmlFor={i} className="label">{label}</label>
      <select id={i} name={name} className="input" defaultValue={value ?? ""} required={!any}>
        <option value="">{any ?? "Choose a state"}</option>
        {STATES_BY_NAME.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  );
}

export function ProductSelect({ name = "product", id, value, label = "Product", any, only }: { name?: string; id?: string; value?: string; label?: string; any?: string; only?: readonly string[] }) {
  const i = id ?? name;
  return (
    <div>
      <label htmlFor={i} className="label">{label}</label>
      <select id={i} name={name} className="input" defaultValue={value ?? ""} required={!any}>
        <option value="">{any ?? "Choose a product"}</option>
        {PRODUCTS.filter((p) => !only || only.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>
    </div>
  );
}

export function UnitSelect({ value = "litres" }: { value?: string }) {
  return (
    <div>
      <label htmlFor="unit" className="label">Unit</label>
      <select id="unit" name="unit" className="input" defaultValue={value}>{UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
    </div>
  );
}

export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-GB")}`;
export const qty = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
export const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const JOB_STATUS: Record<string, string> = { OPEN: "Taking quotes", AWARDED: "Booked", DELIVERED: "Delivered, confirmed by both", CANCELLED: "Cancelled" };
export const AGREEMENT_STATUS: Record<string, string> = { PROPOSED: "Waiting for acceptance", ACTIVE: "Active", DECLINED: "Declined", ENDED: "Ended" };

/** Finance request status labels, shared by the business and lender screens. */
export const FINANCE_STATUS: Record<string, [string, string]> = {
  SHARED: ["Shared, waiting for the lender", "bg-ink-100 text-ink-800"],
  IN_REVIEW: ["Lender is reviewing", "bg-ink-800 text-white"],
  OFFERED: ["Lender wants to make an offer", "bg-brand-100 text-brand-800"],
  DECLINED: ["Declined", "bg-red-100 text-red-800"],
  WITHDRAWN: ["Withdrawn", "bg-ink-100 text-ink-600"],
};
