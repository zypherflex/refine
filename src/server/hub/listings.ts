import { z } from "zod";
import type { HubListingKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { allowedKinds, counterpartKinds, isPubliclyVisible, kindLabel, LISTING_DAYS, LOCATIONS, PRODUCTS, UNITS } from "@/lib/hub/catalog";
import { audit } from "../audit";
import { canSeeBusiness, requireMyBusiness } from "./business";

const DAY = 86_400_000;
const MAX_ACTIVE = 50;
const productIds = PRODUCTS.map((p) => p.id) as [string, ...string[]];
const location = z.string().refine((s) => LOCATIONS.includes(s), "Choose a location from the list");

export const listingInput = z.object({
  kind: z.enum(["OFFER", "REQUEST", "DELIVERY"]),
  title: z.string().trim().min(4).max(140),
  details: z.string().trim().max(4000).default(""),
  products: z.array(z.enum(productIds)).min(1, "Choose at least one product").max(6),
  quantity: z.number().positive().finite().max(1e12).nullable().default(null),
  unit: z.union([z.literal(""), z.enum(UNITS)]).default(""),
  priceNote: z.string().trim().max(200).default(""),
  state: location,
  areas: z.array(location).max(LOCATIONS.length).default([]),
  days: z.coerce.number().refine((d) => (LISTING_DAYS as readonly number[]).includes(d), "Choose how long the listing stays live").default(30),
});

/** A listing anyone can see: active, not expired, from a business that is publicly visible. */
const live = (now = new Date()): Prisma.HubListingWhereInput => ({ status: "ACTIVE", expiresAt: { gt: now }, business: { verification: { not: "SUSPENDED" } } });

function clean(input: z.output<typeof listingInput>) {
  const { days, ...rest } = input;
  if (rest.quantity !== null && !rest.unit) throw new AppError("Choose a unit for the quantity.");
  return { ...rest, products: [...new Set(rest.products)], areas: [...new Set(rest.areas)], expiresAt: new Date(Date.now() + days * DAY) };
}

export async function createListing(actor: Actor, raw: z.input<typeof listingInput>) {
  const business = await requireMyBusiness(actor);
  if (business.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended and cannot post.");
  const data = clean(listingInput.parse(raw));
  if (!allowedKinds(business.roles).includes(data.kind)) throw new AppError(`Add a matching role to your business profile to post “${kindLabel(data.kind)}” listings.`);
  const active = await db.hubListing.count({ where: { businessId: business.id, status: "ACTIVE", expiresAt: { gt: new Date() } } });
  if (active >= MAX_ACTIVE) throw new AppError(`You have ${MAX_ACTIVE} live listings. Close some before posting more.`);
  const l = await db.hubListing.create({ data: { ...data, businessId: business.id } });
  await audit(actor.id, "hub.listing.create", "HubListing", l.id, { kind: l.kind });
  return l;
}

async function ownListing(actor: Actor, id: string) {
  const l = await db.hubListing.findUnique({ where: { id }, include: { business: true } });
  if (!l || l.business.ownerId !== actor.id) throw new NotFoundError("Listing not found");
  if (l.business.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended and cannot change listings.");
  return l;
}

/** Saving a listing also renews it for the chosen number of days. */
export async function updateListing(actor: Actor, id: string, raw: z.input<typeof listingInput>) {
  const l = await ownListing(actor, id);
  const data = clean(listingInput.parse(raw));
  if (data.kind !== l.kind) throw new AppError("A listing's type cannot change. Post a new listing instead.");
  const updated = await db.hubListing.update({ where: { id }, data: { ...data, status: "ACTIVE" } });
  await audit(actor.id, "hub.listing.update", "HubListing", id);
  return updated;
}

export async function closeListing(actor: Actor, id: string) {
  await ownListing(actor, id);
  await db.hubListing.update({ where: { id }, data: { status: "CLOSED" } });
  await audit(actor.id, "hub.listing.close", "HubListing", id);
}

export async function renewListing(actor: Actor, id: string) {
  const l = await ownListing(actor, id);
  const active = await db.hubListing.count({ where: { businessId: l.businessId, status: "ACTIVE", expiresAt: { gt: new Date() }, id: { not: id } } });
  if (active >= MAX_ACTIVE) throw new AppError(`You have ${MAX_ACTIVE} live listings. Close some before renewing more.`);
  await db.hubListing.update({ where: { id }, data: { status: "ACTIVE", expiresAt: new Date(Date.now() + 30 * DAY) } });
}

export type BrowseFilter = { kind?: HubListingKind | null; product?: string | null; state?: string | null; verifiedOnly?: boolean; q?: string | null };

export async function browseListings(viewer: Actor, f: BrowseFilter) {
  const and: Prisma.HubListingWhereInput[] = [live()];
  if (f.kind) and.push({ kind: f.kind });
  if (f.product) and.push({ products: { has: f.product } });
  if (f.state) and.push({ OR: [{ state: f.state }, { areas: { has: f.state } }] });
  if (f.verifiedOnly) and.push({ business: { verification: "VERIFIED" } });
  const q = f.q?.trim();
  if (q) and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { details: { contains: q, mode: "insensitive" } }, { business: { name: { contains: q, mode: "insensitive" } } }] });
  const rows = await db.hubListing.findMany({ where: { AND: and }, include: { business: true }, orderBy: { createdAt: "desc" }, take: 150 });
  return rows.filter((l) => canSeeBusiness(viewer, l.business));
}

export async function getListing(viewer: Actor, id: string) {
  const l = await db.hubListing.findUnique({ where: { id }, include: { business: true } });
  if (!l) throw new NotFoundError("Listing not found");
  const own = l.business.ownerId === viewer.id;
  const isLive = l.status === "ACTIVE" && l.expiresAt > new Date() && isPubliclyVisible(l.business);
  if (!own && !isLive) throw new NotFoundError("This listing has closed or expired.");
  return { ...l, own, isLive };
}

/**
 * Live listings on the other side of the deal: the same product, in a place that overlaps where this listing is or
 * serves. Delivery partners are matched by any overlap in product and place.
 */
export async function matchesFor(viewer: Actor, l: { id: string; businessId: string; kind: HubListingKind; products: string[]; state: string; areas: string[] }) {
  const places = [...new Set([l.state, ...l.areas])];
  const rows = await db.hubListing.findMany({
    where: {
      AND: [
        live(),
        { kind: { in: counterpartKinds(l.kind) } },
        { businessId: { not: l.businessId } },
        { products: { hasSome: l.products } },
        { OR: [{ state: { in: places } }, { areas: { hasSome: places } }] },
      ],
    },
    include: { business: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const visible = rows.filter((r) => canSeeBusiness(viewer, r.business));
  // Verified counterparts first, then the most recent.
  return visible.sort((a, b) => Number(b.business.verification === "VERIFIED") - Number(a.business.verification === "VERIFIED")).slice(0, 8);
}

export async function myListings(actor: Actor) {
  return db.hubListing.findMany({ where: { business: { ownerId: actor.id } }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], include: { _count: { select: { threads: true } } } });
}

export async function businessListings(businessId: string) {
  return db.hubListing.findMany({ where: { AND: [live(), { businessId }] }, orderBy: { createdAt: "desc" } });
}
