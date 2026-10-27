import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { isState, PRODUCTS, ROLES } from "@/lib/hub/catalog";
import { trustRank } from "@/lib/hub/rules";
import { audit } from "../audit";

const roleIds = ROLES.map((r) => r.id) as [string, ...string[]];
const productIds = PRODUCTS.map((p) => p.id) as [string, ...string[]];
export const stateField = z.string().refine(isState, "Choose a state");

export const businessInput = z.object({
  name: z.string().trim().min(2, "Enter the business name").max(120),
  roles: z.array(z.enum(roleIds)).min(1, "Choose at least one role"),
  products: z.array(z.enum(productIds)).max(PRODUCTS.length).default([]),
  state: stateField,
  town: z.string().trim().max(80).default(""),
  description: z.string().trim().max(1000).default(""),
  phone: z.string().trim().max(40).regex(/^[0-9+() -]*$/, "Use digits, spaces and + only").default(""),
  cacNumber: z.string().trim().max(30).default(""),
  licenceNumbers: z.string().trim().max(300).default(""),
});

export async function myBusiness(actor: Actor) {
  return db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
}

/** The caller's own business, which every trade action needs. Suspended businesses cannot act. */
export async function requireBusiness(actor: Actor) {
  const b = await myBusiness(actor);
  if (!b) throw new AppError("Create your business profile on the trade hub first.");
  if (b.verification === "SUSPENDED") throw new ForbiddenError("Your business is suspended on RefineryLens. Contact support to appeal.");
  return b;
}

export async function saveBusiness(actor: Actor, raw: z.input<typeof businessInput>) {
  const input = businessInput.parse(raw);
  const existing = await myBusiness(actor);
  if (existing?.verification === "SUSPENDED") throw new ForbiddenError("Your business is suspended on RefineryLens. Contact support to appeal.");
  // Changing the identity a reviewer checked takes the badge away until it is checked again.
  const identityChanged = !!existing && (existing.name !== input.name || existing.cacNumber !== input.cacNumber || existing.licenceNumbers !== input.licenceNumbers);
  const reset = identityChanged && existing.verification !== "UNVERIFIED" ? { verification: "UNVERIFIED" as const, verifiedAt: null, verifiedById: null, verificationNote: "Name or registration details changed. Ask for verification again." } : {};
  const b = await db.hubBusiness.upsert({ where: { ownerId: actor.id }, update: { ...input, ...reset }, create: { ...input, ownerId: actor.id } });
  await audit(actor.id, existing ? "hub.business.update" : "hub.business.create", "HubBusiness", b.id, { identityChanged });
  return b;
}

export async function requestVerification(actor: Actor) {
  const b = await requireBusiness(actor);
  if (b.verification === "VERIFIED") throw new AppError("Your business is already verified.");
  if (!b.cacNumber) throw new AppError("Add your CAC registration number before asking for verification.");
  if (!b.phone) throw new AppError("Add a phone number so a reviewer can reach you.");
  const u = await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "PENDING", verificationAskedAt: new Date(), verificationNote: "" } });
  await audit(actor.id, "hub.verification.request", "HubBusiness", b.id);
  return u;
}

export const reviewDecision = z.object({ businessId: z.string().min(1), decision: z.enum(["VERIFY", "REJECT", "SUSPEND", "REINSTATE"]), note: z.string().trim().max(500).default("") });

export async function reviewBusiness(actor: Actor, raw: z.input<typeof reviewDecision>) {
  if (!can.reviewHub(actor)) throw new ForbiddenError();
  const { businessId, decision, note } = reviewDecision.parse(raw);
  const b = await db.hubBusiness.findUnique({ where: { id: businessId } });
  if (!b) throw new NotFoundError("Business not found");
  if (b.ownerId === actor.id) throw new ForbiddenError("You cannot review your own business.");
  if ((decision === "REJECT" || decision === "SUSPEND") && !note) throw new AppError("Say why, so the business knows what to fix.");
  const data: Prisma.HubBusinessUpdateInput =
    decision === "VERIFY" ? { verification: "VERIFIED", verifiedAt: new Date(), verifiedById: actor.id, verificationNote: note }
    : decision === "REJECT" ? { verification: "UNVERIFIED", verifiedAt: null, verifiedById: null, verificationNote: note }
    : decision === "SUSPEND" ? { verification: "SUSPENDED", verificationNote: note }
    : { verification: "UNVERIFIED", verifiedAt: null, verifiedById: null, verificationNote: note || "Reinstated. Ask for verification again." };
  const u = await db.$transaction(async (tx) => {
    const u = await tx.hubBusiness.update({ where: { id: b.id }, data });
    // A suspended business's listings come down at once.
    if (decision === "SUSPEND") await tx.hubListing.updateMany({ where: { businessId: b.id }, data: { active: false } });
    await audit(actor.id, `hub.review.${decision.toLowerCase()}`, "HubBusiness", b.id, { note }, tx);
    return u;
  });
  return u;
}

export const REPORT_REASONS = [
  { id: "ADVANCE_PAYMENT", label: "Asked for advance payment and did not deliver" },
  { id: "SHORT_LOADING", label: "Short-loaded or short-filled" },
  { id: "QUALITY", label: "Adulterated or off-spec product" },
  { id: "IMPERSONATION", label: "Pretending to be another company" },
  { id: "PRICE_COORDINATION", label: "Tried to agree prices with competitors" },
  { id: "OTHER", label: "Something else" },
] as const;

export const reportInput = z.object({ businessId: z.string().min(1), reason: z.enum(REPORT_REASONS.map((r) => r.id) as [string, ...string[]]), details: z.string().trim().max(2000).default("") });

export async function reportBusiness(actor: Actor, raw: z.input<typeof reportInput>) {
  const input = reportInput.parse(raw);
  const b = await db.hubBusiness.findUnique({ where: { id: input.businessId } });
  if (!b) throw new NotFoundError("Business not found");
  if (b.ownerId === actor.id) throw new AppError("You cannot report your own business.");
  const open = await db.hubReport.count({ where: { businessId: b.id, reporterId: actor.id, resolved: false } });
  if (open) throw new AppError("You already have an open report on this business. A reviewer will look at it.");
  const r = await db.hubReport.create({ data: { businessId: b.id, reporterId: actor.id, reason: input.reason, details: input.details } });
  await audit(actor.id, "hub.report.create", "HubBusiness", b.id, { reason: input.reason });
  return r;
}

export async function resolveReport(actor: Actor, id: string) {
  if (!can.reviewHub(actor)) throw new ForbiddenError();
  const { count } = await db.hubReport.updateMany({ where: { id, resolved: false }, data: { resolved: true } });
  if (!count) throw new NotFoundError("Report not found");
  await audit(actor.id, "hub.report.resolve", "HubReport", id);
}

export async function reviewQueue(actor: Actor) {
  if (!can.reviewHub(actor)) throw new ForbiddenError();
  const [pending, reports, suspended] = await Promise.all([
    db.hubBusiness.findMany({ where: { verification: "PENDING" }, orderBy: { verificationAskedAt: "asc" }, include: { owner: { select: { email: true, name: true } } } }),
    db.hubReport.findMany({ where: { resolved: false }, orderBy: { createdAt: "asc" }, include: { business: true } }),
    db.hubBusiness.findMany({ where: { verification: "SUSPENDED" }, orderBy: { updatedAt: "desc" }, take: 50 }),
  ]);
  return { pending, reports, suspended };
}

export type DirectoryFilter = { role?: string; state?: string; product?: string; q?: string; verifiedOnly?: boolean };

/** The public directory. Suspended businesses never appear; Verified Business members, then verified ones, come first. */
export async function listDirectory(f: DirectoryFilter = {}) {
  const where: Prisma.HubBusinessWhereInput = {
    verification: f.verifiedOnly ? "VERIFIED" : { not: "SUSPENDED" },
    ...(f.role ? { roles: { has: f.role } } : {}),
    ...(f.state ? { state: f.state } : {}),
    ...(f.product ? { products: { has: f.product } } : {}),
    ...(f.q ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { town: { contains: f.q, mode: "insensitive" } }, { description: { contains: f.q, mode: "insensitive" } }] } : {}),
  };
  const rows = await db.hubBusiness.findMany({ where, orderBy: [{ name: "asc" }], take: 200 });
  return rows.sort((a, b) => trustRank(a) - trustRank(b));
}

/** A business page. Suspended businesses are visible only to their owner and reviewers. */
export async function getBusiness(actor: Actor, id: string) {
  const b = await db.hubBusiness.findUnique({ where: { id } });
  if (!b) throw new NotFoundError("Business not found");
  if (b.verification === "SUSPENDED" && b.ownerId !== actor.id && !can.reviewHub(actor)) throw new NotFoundError("Business not found");
  return b;
}

/**
 * The delivery record: only trades both sides confirmed count. This is the start of the reliability score and,
 * later, the signal a licensed lender could read.
 */
export async function deliveryRecord(businessId: string) {
  const both = { posterConfirmedAt: { not: null }, haulierConfirmedAt: { not: null } };
  const [asPoster, asHaulier, supplyConfirmed, supplyPending] = await Promise.all([
    db.deliveryJob.count({ where: { posterId: businessId, status: "DELIVERED", ...both } }),
    db.deliveryJob.count({ where: { status: "DELIVERED", ...both, quotes: { some: { haulierId: businessId, status: "ACCEPTED" } } } }),
    db.supplyDelivery.count({ where: { sellerConfirmedAt: { not: null }, buyerConfirmedAt: { not: null }, agreement: { OR: [{ buyerId: businessId }, { sellerId: businessId }] } } }),
    db.supplyDelivery.count({ where: { OR: [{ sellerConfirmedAt: null }, { buyerConfirmedAt: null }], agreement: { OR: [{ buyerId: businessId }, { sellerId: businessId }] } } }),
  ]);
  return { jobs: asPoster + asHaulier, supply: supplyConfirmed, pending: supplyPending, total: asPoster + asHaulier + supplyConfirmed };
}

export const planInput = z.object({ businessId: z.string().min(1), plan: z.enum(["FREE", "VERIFIED_BUSINESS"]), months: z.coerce.number().int().min(1).max(24).default(12) });

/** Administrators assign the Verified Business plan (after payment is agreed offline) to verified businesses only. */
export async function setBusinessPlan(actor: Actor, raw: z.input<typeof planInput>, now = new Date()) {
  if (!can.manageUsers(actor)) throw new ForbiddenError();
  const input = planInput.parse(raw);
  const b = await db.hubBusiness.findUnique({ where: { id: input.businessId } });
  if (!b) throw new NotFoundError("Business not found");
  if (input.plan === "VERIFIED_BUSINESS" && b.verification !== "VERIFIED") throw new AppError("Only verified businesses can join the Verified Business plan.");
  const until = input.plan === "FREE" ? null : new Date(now.getTime() + input.months * 30 * 86_400_000);
  const u = await db.hubBusiness.update({ where: { id: b.id }, data: { plan: input.plan, planUntil: until } });
  await audit(actor.id, "hub.plan.set", "HubBusiness", b.id, { plan: input.plan, until: until?.toISOString() ?? null });
  return u;
}
