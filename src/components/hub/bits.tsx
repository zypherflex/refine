import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { PRODUCTS, STATES_BY_NAME, UNITS } from "@/lib/hub/catalog";
import { ADVANCE_PAYMENT_WARNING, displayName } from "@/lib/hub/rules";
import { Notice, Pill } from "../ui";

type B = { id: string; name: string; verification: string; isSample?: boolean };

export function VerificationBadge({ v }: { v: string }) {
  if (v === "VERIFIED") return <Pill className="gap-1 bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/30"><BadgeCheck aria-hidden size={12} strokeWidth={2.2} />Verified</Pill>;
  if (v === "PENDING") return <Pill className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-200">Verification in progress</Pill>;
  if (v === "SUSPENDED") return <Pill className="bg-risk-50 text-risk-800 ring-1 ring-inset ring-risk-600/30">Suspended</Pill>;
  return <Pill className="bg-white text-ink-600 ring-1 ring-inset ring-ink-200">Not verified</Pill>;
}

export function SampleTag() {
  return <Pill className="bg-ink-50 text-ink-700 ring-1 ring-dashed ring-ink-300" title="Seeded to show how the hub works. Not a real business.">Sample business</Pill>;
}

export function PromotedTag() {
  return <Pill className="bg-ink-800 text-white" title="Paid placement. Promotion never changes verification or prices.">Promoted</Pill>;
}

export function BusinessName({ b, link = true }: { b: B; link?: boolean }) {
  const name = displayName(b);
  const hidden = name !== b.name;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {link ? <Link href={`/hub/business/${b.id}`} className={hidden ? "italic" : ""}>{name}</Link> : <span className={hidden ? "italic" : ""}>{name}</span>}
      <VerificationBadge v={b.verification} />
      {b.isSample && <SampleTag />}
    </span>
  );
}

export function AdvanceWarning() {
  return <Notice tone="warn" title="Check before money moves">{ADVANCE_PAYMENT_WARNING}</Notice>;
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
