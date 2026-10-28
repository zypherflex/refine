import Link from "next/link";
import type { HubBusiness, HubListing, HubVerification } from "@prisma/client";
import { isFeatured, kindLabel, productLabel, roleLabel, verificationLabel } from "@/lib/hub/catalog";
import { fmtDate } from "@/lib/format";
import { Pill } from "../ui";

const verificationStyle: Record<HubVerification, string> = {
  UNVERIFIED: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/40",
  PENDING_REVIEW: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/40",
  VERIFIED: "bg-brand-600 text-white",
  SUSPENDED: "bg-risk-100 text-risk-800",
};

const verificationHelp: Record<HubVerification, string> = {
  UNVERIFIED: "RefineryLens has not checked this business's registration or licences.",
  PENDING_REVIEW: "The business has asked RefineryLens to check its registration and licences. Until then, treat it as unverified.",
  VERIFIED: "RefineryLens checked this business's registration and licence details. It is not a guarantee of its products, prices or conduct.",
  SUSPENDED: "RefineryLens has suspended this business.",
};

export function VerificationBadge({ v }: { v: HubVerification }) {
  return (
    <Pill className={verificationStyle[v]} title={verificationHelp[v]}>
      {v === "VERIFIED" ? "✓ Verified" : v === "PENDING_REVIEW" ? "Unverified (check requested)" : verificationLabel[v]}
    </Pill>
  );
}

/** Sellers who reported prices on at least two days in the last fortnight help keep the price board honest. */
export function ReporterBadge() {
  return <Pill className="bg-navy-50 text-navy-800 ring-1 ring-inset ring-navy-600/20" title="Reported their selling prices to the RefineryLens price board on at least two days in the last 14.">Reports prices</Pill>;
}

/** Paid placement is always labelled. */
export function FeaturedTag() {
  return <Pill className="bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-600/30" title="This verified business pays for the Business plan, which lists it first. RefineryLens does not rank by quality.">★ Featured</Pill>;
}

export function DemoTag() {
  return <Pill className="bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-600/50" title="Seeded demonstration account. Not a real business.">Demo account</Pill>;
}

export function RolePills({ roles }: { roles: string[] }) {
  return <>{roles.map((r) => <Pill key={r} className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{roleLabel(r)}</Pill>)}</>;
}

const kindStyle = { OFFER: "bg-brand-100 text-brand-800", REQUEST: "bg-ink-900 text-white", DELIVERY: "bg-amber-100 text-amber-900" } as const;

export function KindPill({ kind }: { kind: HubListing["kind"] }) {
  return <Pill className={kindStyle[kind]}>{kindLabel(kind)}</Pill>;
}

export function quantityText(l: Pick<HubListing, "quantity" | "unit">) {
  if (l.quantity === null) return null;
  return `${l.quantity.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ${l.unit}`.trim();
}

export function placesText(l: Pick<HubListing, "kind" | "state" | "areas">) {
  const base = l.kind === "REQUEST" ? `Deliver to ${l.state}` : l.kind === "DELIVERY" ? `Based in ${l.state}` : `From ${l.state}`;
  if (!l.areas.length) return base;
  const shown = l.areas.slice(0, 4).join(", ") + (l.areas.length > 4 ? ` and ${l.areas.length - 4} more` : "");
  return `${base} · ${l.kind === "REQUEST" ? "accepts supply from" : "serves"} ${shown}`;
}

export function ListingCard({ l, business, showBusiness = true }: { l: HubListing; business: Pick<HubBusiness, "id" | "name" | "verification" | "isDemo" | "planUntil">; showBusiness?: boolean }) {
  const qty = quantityText(l);
  return (
    <li className="card flex flex-col">
      <div className="flex flex-wrap items-center gap-1.5">
        <KindPill kind={l.kind} />
        {showBusiness && isFeatured(business) && <FeaturedTag />}
        {l.products.map((p) => <Pill key={p} className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{productLabel(p)}</Pill>)}
      </div>
      <h3 className="mt-2 text-base font-semibold text-ink-950"><Link href={`/hub/listings/${l.id}`}>{l.title}</Link></h3>
      <p className="mt-1 text-sm text-ink-700">{placesText(l)}</p>
      {(qty || l.priceNote) && <p className="mt-1 text-sm text-ink-800">{[qty, l.priceNote].filter(Boolean).join(" · ")}</p>}
      <div className="mt-auto pt-3">
        {showBusiness && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-700">
            <Link href={`/hub/businesses/${business.id}`} className="font-medium">{business.name}</Link>
            <VerificationBadge v={business.verification} />
            {business.isDemo && <DemoTag />}
          </p>
        )}
        <p className="mt-1 text-[11px] text-ink-500">Posted {fmtDate(l.createdAt)} · live until {fmtDate(l.expiresAt)}</p>
      </div>
    </li>
  );
}

/** Shown wherever people can contact each other: RefineryLens only introduces, it does not stand behind a deal. */
export function SafetyNote() {
  return (
    <p className="text-xs leading-relaxed text-ink-600">
      RefineryLens introduces businesses and carries their messages. Apart from home gas orders paid online, it does not take payments between businesses, hold goods or guarantee any party, and is not affiliated with any refinery listed here. Check licences and product quality yourself, and never pay in advance to a business you have not verified.
    </p>
  );
}
