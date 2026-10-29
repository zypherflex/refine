import type { GasSiteKind, HubRole } from "@prisma/client";
import { NIGERIAN_STATES } from "./catalog";

/**
 * The gas network: LPG and CNG supply points that businesses on the trade hub operate, plus the delivery coverage
 * and buyer demand their listings describe, summarised by state. Everything is as stated by the businesses.
 */

export const GASES = [
  { id: "lpg_bulk", label: "Bulk LPG", inSentence: "bulk LPG", hubProduct: "lpg" },
  { id: "lpg_cylinder", label: "LPG cylinders", inSentence: "LPG cylinders", hubProduct: "lpg" },
  { id: "cng", label: "CNG", inSentence: "CNG", hubProduct: "cng" },
] as const;
export type GasId = (typeof GASES)[number]["id"];
export const gasLabel = (id: string) => GASES.find((g) => g.id === id)?.label ?? id;

/** Common LPG cylinder sizes in Nigeria, in kg. */
export const CYLINDER_SIZES = [3, 5, 6, 12.5, 25, 50] as const;

export const SITE_KINDS: { id: GasSiteKind; label: string; help: string; roles: HubRole[] }[] = [
  { id: "TERMINAL", label: "Import terminal or refinery", help: "Where LPG enters the network: jetties, terminals, refinery gas plants", roles: ["SELLER", "REFINERY"] },
  { id: "DEPOT", label: "Bulk depot", help: "Bulk storage that loads bullet trucks", roles: ["SELLER", "REFINERY"] },
  { id: "REFILL_PLANT", label: "LPG refill (skid) plant", help: "Fills customers' cylinders from bulk storage", roles: ["SELLER"] },
  { id: "CYLINDER_RETAIL", label: "Cylinder retail or exchange point", help: "Kiosks and shops selling filled cylinders or swaps", roles: ["SELLER"] },
  { id: "CNG_STATION", label: "CNG refuelling station", help: "Fills CNG vehicles and cascades", roles: ["SELLER"] },
  { id: "CNG_MOTHER", label: "CNG mother station", help: "Compresses pipeline gas for virtual-pipeline trucks", roles: ["SELLER", "REFINERY"] },
  { id: "LOGISTICS_BASE", label: "Gas truck base", help: "Where bullet trucks, cylinder trucks or CNG cascades are based", roles: ["DELIVERY"] },
];
export const siteKindLabel = (id: string) => SITE_KINDS.find((k) => k.id === id)?.label ?? id;
const SUPPLY_KINDS = new Set<GasSiteKind>(["TERMINAL", "DEPOT", "REFILL_PLANT", "CYLINDER_RETAIL", "CNG_STATION", "CNG_MOTHER"]);
export const isSupplyKind = (k: GasSiteKind) => SUPPLY_KINDS.has(k);

export function allowedSiteKinds(roles: readonly string[]): GasSiteKind[] {
  return SITE_KINDS.filter((k) => k.roles.some((r) => roles.includes(r))).map((k) => k.id);
}

/** Details not confirmed by the owner for this long are shown as possibly out of date. */
export const STALE_AFTER_DAYS = 90;
export const isStale = (lastConfirmedAt: Date, now = new Date()) => now.getTime() - lastConfirmedAt.getTime() > STALE_AFTER_DAYS * 86_400_000;

/**
 * Schematic layout of Nigeria's 36 states and the FCT as equal tiles, roughly where each lies (north at the top).
 * It is not to scale, and the page says so; it keeps small southern states as visible as large northern ones.
 */
export const STATE_GRID: Record<(typeof NIGERIAN_STATES)[number], [col: number, row: number]> = {
  Sokoto: [1, 0], Katsina: [3, 0], Jigawa: [4, 0], Yobe: [5, 0], Borno: [6, 0],
  Kebbi: [0, 1], Zamfara: [1, 1], Kaduna: [2, 1], Kano: [3, 1], Bauchi: [4, 1], Gombe: [5, 1], Adamawa: [6, 1],
  Niger: [1, 2], "FCT Abuja": [2, 2], Nasarawa: [3, 2], Plateau: [4, 2], Taraba: [5, 2],
  Oyo: [0, 3], Kwara: [1, 3], Kogi: [2, 3], Benue: [3, 3],
  Ogun: [0, 4], Osun: [1, 4], Ekiti: [2, 4], Enugu: [3, 4], Ebonyi: [4, 4], "Cross River": [5, 4],
  Lagos: [0, 5], Ondo: [1, 5], Edo: [2, 5], Anambra: [3, 5], Abia: [4, 5], "Akwa Ibom": [5, 5],
  Delta: [2, 6], Imo: [3, 6], Rivers: [4, 6],
  Bayelsa: [3, 7],
};

/** State capitals (latitude, longitude), used for approximate distances between states. */
export const STATE_CAPITALS: Record<(typeof NIGERIAN_STATES)[number], [lat: number, lon: number]> = {
  Abia: [5.53, 7.49], Adamawa: [9.21, 12.48], "Akwa Ibom": [5.04, 7.91], Anambra: [6.21, 7.07], Bauchi: [10.31, 9.84], Bayelsa: [4.92, 6.26],
  Benue: [7.73, 8.52], Borno: [11.83, 13.15], "Cross River": [4.95, 8.32], Delta: [6.2, 6.73], Ebonyi: [6.32, 8.11], Edo: [6.34, 5.63],
  Ekiti: [7.62, 5.22], Enugu: [6.46, 7.55], "FCT Abuja": [9.06, 7.49], Gombe: [10.29, 11.17], Imo: [5.48, 7.03], Jigawa: [11.76, 9.34],
  Kaduna: [10.52, 7.44], Kano: [12.0, 8.52], Katsina: [12.99, 7.6], Kebbi: [12.45, 4.2], Kogi: [7.8, 6.74], Kwara: [8.5, 4.55],
  Lagos: [6.6, 3.35], Nasarawa: [8.49, 8.52], Niger: [9.61, 6.56], Ogun: [7.15, 3.35], Ondo: [7.25, 5.2], Osun: [7.77, 4.56],
  Oyo: [7.38, 3.95], Plateau: [9.9, 8.86], Rivers: [4.82, 7.03], Sokoto: [13.06, 5.24], Taraba: [8.89, 11.36], Yobe: [11.75, 11.96],
  Zamfara: [12.16, 6.66],
};

export const isNigerianState = (s: string): s is (typeof NIGERIAN_STATES)[number] => (NIGERIAN_STATES as readonly string[]).includes(s);

/** Straight-line distance between two states' capitals in km, rounded to 10 km. Road distance is longer. */
export function stateDistanceKm(a: string, b: string): number | null {
  if (!isNigerianState(a) || !isNigerianState(b)) return null;
  if (a === b) return 0;
  const [la1, lo1] = STATE_CAPITALS[a].map((d) => (d * Math.PI) / 180);
  const [la2, lo2] = STATE_CAPITALS[b].map((d) => (d * Math.PI) / 180);
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  return Math.round((2 * 6371 * Math.asin(Math.sqrt(h))) / 10) * 10;
}

export type NetworkLayer = "supply" | "delivery" | "demand" | "gaps";
export const LAYERS: { id: NetworkLayer; label: string; help: string }[] = [
  { id: "supply", label: "Supply points", help: "Operating terminals, depots, refill plants, retail points and CNG stations" },
  { id: "delivery", label: "Delivery coverage", help: "Gas truck bases plus live delivery listings serving the state" },
  { id: "demand", label: "Buyer demand", help: "Live buy requests for delivery to the state" },
  { id: "gaps", label: "Gaps", help: "States with buyer demand but no supply point and no delivery coverage" },
];

type SiteLike = { kind: GasSiteKind; status: string; state: string; gases: string[]; delivers: boolean };
type ListingLike = { kind: "OFFER" | "REQUEST" | "DELIVERY"; state: string; areas: string[]; products: string[] };
export type StateSummary = { state: string; supply: number; delivery: number; demand: number; gap: boolean };

/**
 * Counts per state for one gas (or all). A supply site counts where it is; a truck base or a delivery listing counts
 * in every state it serves; a buy request counts where delivery is wanted. Only operating sites count.
 */
export function summariseNetwork(sites: SiteLike[], listings: ListingLike[], gas: GasId | null): StateSummary[] {
  const hubProduct = gas ? GASES.find((g) => g.id === gas)!.hubProduct : null;
  const wants = (products: string[]) => (hubProduct ? products.includes(hubProduct) : products.some((p) => p === "lpg" || p === "cng"));
  const siteHasGas = (s: SiteLike) => (gas ? s.gases.includes(gas) : s.gases.length > 0);
  const rows = new Map<string, StateSummary>(NIGERIAN_STATES.map((s) => [s, { state: s, supply: 0, delivery: 0, demand: 0, gap: false }]));
  for (const s of sites) {
    const row = rows.get(s.state);
    if (!row || s.status !== "OPERATING" || !siteHasGas(s)) continue;
    if (s.kind === "LOGISTICS_BASE") row.delivery++;
    else row.supply++;
  }
  for (const l of listings) {
    if (!wants(l.products)) continue;
    if (l.kind === "REQUEST") {
      const row = rows.get(l.state);
      if (row) row.demand++;
    } else if (l.kind === "DELIVERY") {
      for (const st of new Set([l.state, ...l.areas])) {
        const row = rows.get(st);
        if (row) row.delivery++;
      }
    }
  }
  for (const row of rows.values()) row.gap = row.demand > 0 && row.supply === 0 && row.delivery === 0;
  return [...rows.values()];
}

export function layerValue(row: StateSummary, layer: NetworkLayer): number {
  if (layer === "gaps") return row.gap ? 1 : 0;
  return row[layer];
}
