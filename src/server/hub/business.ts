import { z } from "zod";
import type { HubBusiness, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { isFeatured, isPubliclyVisible, LOCATIONS } from "@/lib/hub/catalog";
import { audit } from "../audit";
import { enqueue } from "../jobs";
import { registryConfigured } from "../connect/registry";

const location = z.string().refine((s) => LOCATIONS.includes(s), "Choose a location from the list");

export const businessInput = z.object({
  name: z.string().trim().min(2).max(120),
  roles: z.array(z.enum(["SELLER", "BUYER", "DELIVERY", "REFINERY"])).min(1, "Choose at least one role").max(4),
  about: z.string().trim().max(2000).default(""),
  state: location,
  city: z.string().trim().max(80).default(""),
  website: z.union([z.literal(""), z.string().trim().url().max(200).refine((u) => /^https?:\/\//.test(u), "Use an http or https address")]).default(""),
  registrationNumber: z.string().trim().max(40).default(""),
  licences: z.string().trim().max(500).default(""),
  capacityBpd: z.number().int().min(1).max(2_000_000).nullable().default(null),
});

/** Fields an administrator checks. Changing any of them after verification removes the badge until checked again. */
const IDENTITY = ["name", "registrationNumber", "licences"] as const;

export async function getMyBusiness(actor: Actor) {
  return db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
}

export async function requireMyBusiness(actor: Actor) {
  const b = await getMyBusiness(actor);
  if (!b) throw new AppError("Set up your business profile on the trade hub first.");
  return b;
}

export async function saveBusiness(actor: Actor, raw: z.input<typeof businessInput>) {
  const input = businessInput.parse(raw);
  const data = { ...input, roles: [...new Set(input.roles)], capacityBpd: input.roles.includes("REFINERY") ? input.capacityBpd : null };
  const existing = await getMyBusiness(actor);
  if (!existing) {
    const b = await db.hubBusiness.create({ data: { ...data, ownerId: actor.id } });
    await audit(actor.id, "hub.business.create", "HubBusiness", b.id, { roles: data.roles });
    return b;
  }
  if (existing.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended. Contact RefineryLens to resolve it.");
  const identityChanged = IDENTITY.some((k) => existing[k] !== data[k]) || (data.roles.includes("REFINERY") && !existing.roles.includes("REFINERY"));
  const reset: Prisma.HubBusinessUpdateInput =
    identityChanged && existing.verification !== "UNVERIFIED"
      ? { verification: "UNVERIFIED", verifiedAt: null, verifiedById: null, verificationNote: "Your name, registration, licences or refinery role changed, so the business needs to be checked again. Request verification when ready." }
      : {};
  const b = await db.hubBusiness.update({ where: { id: existing.id }, data: { ...data, ...reset } });
  await audit(actor.id, "hub.business.update", "HubBusiness", b.id, { identityChanged });
  return b;
}

export async function requestVerification(actor: Actor) {
  const b = await requireMyBusiness(actor);
  if (b.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended. Contact RefineryLens to resolve it.");
  if (b.verification === "VERIFIED") throw new AppError("This business is already verified.");
  if (b.verification === "PENDING_REVIEW") throw new AppError("Verification has already been requested.");
  if (!b.registrationNumber) throw new AppError("Add your CAC registration number before requesting verification.");
  const updated = await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "PENDING_REVIEW", verificationNote: "" } });
  await audit(actor.id, "hub.business.request_verification", "HubBusiness", b.id);
  // Look the number up in the company registry in the background, for the administrator who checks the request.
  if (registryConfigured()) await enqueue("hub.registry-lookup", { businessId: b.id }, actor.id);
  return updated;
}

/** Whether `viewer` may see this business at all: everyone for a visible one, otherwise only its owner. */
export function canSeeBusiness(viewer: Actor, b: Pick<HubBusiness, "ownerId" | "verification" | "name">) {
  return b.ownerId === viewer.id || isPubliclyVisible(b);
}

export async function getBusiness(viewer: Actor, id: string) {
  const b = await db.hubBusiness.findUnique({ where: { id } });
  if (!b || !canSeeBusiness(viewer, b)) throw new NotFoundError("Business not found");
  return b;
}

export async function listRefineries(viewer: Actor, opts: { state?: string; verifiedOnly?: boolean } = {}) {
  const where: Prisma.HubBusinessWhereInput = {
    roles: { has: "REFINERY" },
    verification: opts.verifiedOnly ? "VERIFIED" : { not: "SUSPENDED" },
    ...(opts.state ? { state: opts.state } : {}),
  };
  const list = await db.hubBusiness.findMany({
    where,
    orderBy: [{ verification: "asc" }, { name: "asc" }],
    include: { _count: { select: { listings: { where: { status: "ACTIVE", expiresAt: { gt: new Date() } } } } } },
    take: 200,
  });
  // VERIFIED sorts after PENDING_REVIEW in the enum, so put verified refineries first here.
  const rank = (b: (typeof list)[number]) => (isFeatured(b) ? 2 : b.verification === "VERIFIED" ? 1 : 0);
  return list.filter((b) => canSeeBusiness(viewer, b)).sort((a, b) => rank(b) - rank(a));
}
