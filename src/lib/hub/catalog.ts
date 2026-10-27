import type { HubListingKind, HubRole, HubVerification } from "@prisma/client";
import type { SegmentId } from "../opportunities/catalog";

/**
 * The trade hub connects sellers, buyers, delivery partners and refineries. RefineryLens lists who is offering or
 * looking for what and carries their messages; it does not take payments, hold goods or vouch for anyone beyond the
 * document checks behind a "Verified" badge.
 */

export const HUB_ROLES: { id: HubRole; label: string; who: string }[] = [
  { id: "SELLER", label: "Seller", who: "Depots, marketers, distributors and retailers with product to sell" },
  { id: "BUYER", label: "Buyer", who: "Stations, factories, fleets and traders looking for supply" },
  { id: "DELIVERY", label: "Delivery partner", who: "Tanker, truck, vessel and last-mile operators" },
  { id: "REFINERY", label: "Refinery", who: "Large, modular and regional refineries selling product or buying feedstock" },
];

export const PRODUCTS = [
  { id: "pms", label: "Petrol (PMS)", segment: "fuels", unit: "litres" },
  { id: "ago", label: "Diesel (AGO)", segment: "fuels", unit: "litres" },
  { id: "dpk", label: "Kerosene (DPK)", segment: "fuels", unit: "litres" },
  { id: "jet", label: "Jet A-1", segment: "fuels", unit: "litres" },
  { id: "lpg", label: "LPG (cooking gas)", segment: "gas", unit: "tonnes" },
  { id: "cng", label: "CNG", segment: "gas", unit: "standard cubic metres" },
  { id: "pp", label: "Polypropylene resin", segment: "petrochemicals", unit: "tonnes" },
  { id: "crude", label: "Crude oil", segment: "feedstock", unit: "barrels" },
  { id: "condensate", label: "Condensate", segment: "feedstock", unit: "barrels" },
  { id: "lubricants", label: "Base oils and lubricants", segment: "fuels", unit: "litres" },
  { id: "services", label: "Plant services and supplies", segment: "services", unit: "" },
] as const satisfies readonly { id: string; label: string; segment: SegmentId; unit: string }[];
export type ProductId = (typeof PRODUCTS)[number]["id"];

export const UNITS = ["litres", "tonnes", "kg", "barrels", "standard cubic metres", "trucks", "litres per trip", "tonnes per trip", "trips per week"] as const;

export const LISTING_KINDS: { id: HubListingKind; label: string; verb: string; role: HubRole[] }[] = [
  { id: "OFFER", label: "Selling", verb: "Offer product for sale", role: ["SELLER", "REFINERY"] },
  { id: "REQUEST", label: "Buying", verb: "Ask for supply", role: ["BUYER", "REFINERY"] },
  { id: "DELIVERY", label: "Delivery capacity", verb: "Offer delivery capacity", role: ["DELIVERY"] },
];

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;
/** Outside Nigeria, for regional trade, import and export. */
export const OTHER_LOCATIONS = ["Benin", "Cameroon", "Chad", "Ghana", "Niger Republic", "Togo", "Elsewhere in West Africa", "Outside Africa"] as const;
export const LOCATIONS: readonly string[] = [...NIGERIAN_STATES, ...OTHER_LOCATIONS];

/** How long a new listing stays live before its owner must renew it, so stale offers drop off. */
export const LISTING_DAYS = [7, 30, 90] as const;

export const roleLabel = (id: string) => HUB_ROLES.find((r) => r.id === id)?.label ?? id;
export const productLabel = (id: string) => PRODUCTS.find((p) => p.id === id)?.label ?? id;
export const kindLabel = (id: string) => LISTING_KINDS.find((k) => k.id === id)?.label ?? id;

/** Products a hub search shows for an opportunity's segment, so opportunity pages can link to live listings. */
export function productsForSegment(segment: string): ProductId[] {
  if (segment === "logistics" || segment === "trade") return ["pms", "ago", "dpk", "jet", "lpg"];
  if (segment === "refining") return ["crude", "condensate"];
  return PRODUCTS.filter((p) => p.segment === segment).map((p) => p.id);
}

/**
 * Names nobody can trade under until an administrator has verified the business, so an unverified account cannot pass
 * itself off as Dangote or another well-known refiner. Compared without spaces or punctuation.
 */
const PROTECTED_NAMES = ["dangote", "nnpc", "aradel", "waltersmith", "nigerianpetroleum"];

export function isProtectedName(name: string): boolean {
  const flat = name.toLowerCase().replace(/[^a-z]/g, "");
  return PROTECTED_NAMES.some((p) => flat.includes(p));
}

type Visible = { verification: HubVerification; name: string };

/** Suspended businesses, and unverified ones trading under a protected name, are hidden from everyone but their owner. */
export function isPubliclyVisible(b: Visible): boolean {
  if (b.verification === "SUSPENDED") return false;
  if (isProtectedName(b.name) && b.verification !== "VERIFIED") return false;
  return true;
}

/**
 * A business on the paid Business plan is featured (listed first, always labelled "Featured") only while the plan runs
 * and the business is verified, so paid placement never goes to a business RefineryLens has not checked.
 */
export function isFeatured(b: { verification: HubVerification; planUntil: Date | null }, now = new Date()) {
  return b.verification === "VERIFIED" && !!b.planUntil && b.planUntil > now;
}

/** Live listings a business may have at once. */
export const listingLimit = (b: { planUntil: Date | null }, now = new Date()) => (b.planUntil && b.planUntil > now ? 200 : 50);

export const verificationLabel: Record<HubVerification, string> = {
  UNVERIFIED: "Unverified",
  PENDING_REVIEW: "Verification requested",
  VERIFIED: "Verified",
  SUSPENDED: "Suspended",
};

/** Which kinds of listing a business may post, from the roles it has chosen. */
export function allowedKinds(roles: readonly string[]): HubListingKind[] {
  return LISTING_KINDS.filter((k) => k.role.some((r) => roles.includes(r))).map((k) => k.id);
}

/** The counterpart a listing needs: offers look for buyers, requests for sellers and hauliers, delivery for both. */
export function counterpartKinds(kind: HubListingKind): HubListingKind[] {
  if (kind === "OFFER") return ["REQUEST", "DELIVERY"];
  if (kind === "REQUEST") return ["OFFER", "DELIVERY"];
  return ["OFFER", "REQUEST"];
}
