import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { PRODUCTS, UNITS } from "@/lib/hub/catalog";
import { activePlan, LISTING_DAYS, PLAN_LIMITS, trustRank } from "@/lib/hub/rules";
import { audit } from "../audit";
import { requireBusiness, stateField } from "./business";

const productIds = PRODUCTS.map((p) => p.id) as [string, ...string[]];

export const listingInput = z.object({
  kind: z.enum(["OFFER", "REQUEST"]),
  product: z.enum(productIds),
  quantity: z.coerce.number().positive("Quantity must be more than zero").max(1e9),
  unit: z.enum(UNITS),
  state: stateField,
  details: z.string().trim().max(1000).default(""),
});

export async function createListing(actor: Actor, raw: z.input<typeof listingInput>) {
  const input = listingInput.parse(raw);
  const b = await requireBusiness(actor);
  const active = await db.hubListing.count({ where: { businessId: b.id, active: true, expiresAt: { gt: new Date() } } });
  const max = PLAN_LIMITS[activePlan(b)].listings;
  if (active >= max) throw new AppError(`You have ${max} live listings. Close some before adding more.`);
  const l = await db.hubListing.create({ data: { ...input, businessId: b.id, expiresAt: new Date(Date.now() + LISTING_DAYS * 86_400_000) } });
  await audit(actor.id, "hub.listing.create", "HubListing", l.id);
  return l;
}

export async function closeListing(actor: Actor, id: string) {
  const b = await requireBusiness(actor);
  const { count } = await db.hubListing.updateMany({ where: { id, businessId: b.id }, data: { active: false } });
  if (!count) throw new NotFoundError("Listing not found");
}

/** Paid placement is set by staff once paid for, and every promoted listing is labelled as such. */
export async function setPromoted(actor: Actor, id: string, promoted: boolean) {
  if (!can.reviewHub(actor)) throw new ForbiddenError();
  const { count } = await db.hubListing.updateMany({ where: { id }, data: { promoted } });
  if (!count) throw new NotFoundError("Listing not found");
  await audit(actor.id, promoted ? "hub.listing.promote" : "hub.listing.unpromote", "HubListing", id);
}

export type ListingFilter = { kind?: string; product?: string; state?: string };

export async function listListings(f: ListingFilter = {}, take = 100) {
  const where: Prisma.HubListingWhereInput = {
    active: true,
    expiresAt: { gt: new Date() },
    business: { verification: { not: "SUSPENDED" } },
    ...(f.kind === "OFFER" || f.kind === "REQUEST" ? { kind: f.kind } : {}),
    ...(f.product ? { product: f.product } : {}),
    ...(f.state ? { state: f.state } : {}),
  };
  const rows = await db.hubListing.findMany({ where, include: { business: true }, orderBy: { createdAt: "desc" }, take });
  // Promoted first (and labelled), then Verified Business members, then verified sellers, then newest.
  const rank = (l: (typeof rows)[number]) => (l.promoted ? 0 : 1 + trustRank(l.business));
  return rows.sort((a, b) => rank(a) - rank(b));
}

export async function businessListings(businessId: string, includeClosed = false) {
  return db.hubListing.findMany({ where: { businessId, ...(includeClosed ? {} : { active: true, expiresAt: { gt: new Date() } }) }, orderBy: { createdAt: "desc" } });
}

export const enquiryInput = z.object({ toId: z.string().min(1), listingId: z.string().optional().nullable(), message: z.string().trim().min(5, "Write a short message").max(2000) });

export async function sendEnquiry(actor: Actor, raw: z.input<typeof enquiryInput>) {
  const input = enquiryInput.parse(raw);
  const from = await requireBusiness(actor);
  const to = await db.hubBusiness.findUnique({ where: { id: input.toId } });
  if (!to || to.verification === "SUSPENDED") throw new NotFoundError("Business not found");
  if (to.id === from.id) throw new AppError("You cannot message your own business.");
  if (input.listingId) {
    const l = await db.hubListing.findFirst({ where: { id: input.listingId, businessId: to.id } });
    if (!l) throw new NotFoundError("Listing not found");
  }
  const today = await db.hubEnquiry.count({ where: { fromId: from.id, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  const max = PLAN_LIMITS[activePlan(from)].enquiriesPerDay;
  if (today >= max) throw new AppError(`You have sent ${max} enquiries in the last day. Try again tomorrow.`);
  return db.hubEnquiry.create({ data: { fromId: from.id, toId: to.id, listingId: input.listingId || null, message: input.message } });
}

export async function inbox(actor: Actor) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) return [];
  return db.hubEnquiry.findMany({ where: { toId: b.id }, include: { from: true, listing: true }, orderBy: { createdAt: "desc" }, take: 50 });
}

/** Enquiry analytics for Verified Business members: messages received in the last 30 days, in total and per listing. */
export async function enquiryStats(businessId: string, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const rows = await db.hubEnquiry.groupBy({ by: ["listingId"], where: { toId: businessId, createdAt: { gte: since } }, _count: { _all: true } });
  const total = rows.reduce((s, r) => s + r._count._all, 0);
  const listings = await db.hubListing.findMany({ where: { id: { in: rows.map((r) => r.listingId).filter((x): x is string => !!x) } } });
  return { total, byListing: rows.map((r) => ({ listing: listings.find((l) => l.id === r.listingId) ?? null, count: r._count._all })).sort((a, b) => b.count - a.count) };
}
