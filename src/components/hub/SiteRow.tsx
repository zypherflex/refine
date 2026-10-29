import Link from "next/link";
import type { GasSite, HubBusiness } from "@prisma/client";
import { gasLabel, isStale, siteKindLabel } from "@/lib/hub/gas";
import { fmtDate } from "@/lib/format";
import { Pill } from "../ui";
import { DemoTag, VerificationBadge } from "./parts";

export function SiteRow({ site, business, km }: { site: GasSite; business: Pick<HubBusiness, "id" | "name" | "verification" | "isDemo">; km?: number }) {
  return (
    <li className="rounded-lg border border-ink-100 bg-white p-3 text-sm shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium"><Link href={`/hub/gas/sites/${site.id}`}>{site.name}</Link></p>
        {km !== undefined && <span className="num text-xs text-ink-600">≈ {km.toLocaleString("en-GB")} km away</span>}
      </div>
      <p className="text-xs text-ink-700">{siteKindLabel(site.kind)} · {[site.town, site.state].filter(Boolean).join(", ")}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {site.gases.map((g) => <Pill key={g} className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{gasLabel(g)}</Pill>)}
        {site.cylinderSizes.length > 0 && <Pill className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{site.cylinderSizes.join(", ")} kg</Pill>}
        {site.status === "PLANNED" && <Pill className="bg-ink-100 text-ink-800">Planned</Pill>}
        {site.delivers && <Pill className="bg-brand-50 text-brand-800">Delivers</Pill>}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-700">
        <Link href={`/hub/businesses/${business.id}`}>{business.name}</Link>
        <VerificationBadge v={business.verification} />
        {business.isDemo && <DemoTag />}
      </p>
      <p className={`mt-1 text-[11px] ${isStale(site.lastConfirmedAt) ? "font-medium text-amber-800" : "text-ink-500"}`}>
        {isStale(site.lastConfirmedAt) ? "⚠ May be out of date: last confirmed " : "Confirmed by the business "}{fmtDate(site.lastConfirmedAt)}
      </p>
    </li>
  );
}
