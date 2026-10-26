import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { audit } from "../audit";
import { createAlert } from "../services/alerts";
import { canSeeBusiness } from "./business";

/**
 * Verification means an administrator has checked the business's registration and licence details against public
 * registers. It is not a guarantee of the business, its products or its prices, and the UI says so.
 */

function requireModerator(actor: Actor) {
  if (!can.moderateHub(actor)) throw new ForbiddenError();
}

const note = z.string().trim().max(1000);

export async function verificationQueue(actor: Actor) {
  requireModerator(actor);
  return db.hubBusiness.findMany({ where: { verification: "PENDING_REVIEW" }, orderBy: { updatedAt: "asc" }, include: { owner: { select: { email: true, name: true } } } });
}

export async function moderatedBusinesses(actor: Actor) {
  requireModerator(actor);
  return db.hubBusiness.findMany({ where: { verification: { in: ["VERIFIED", "SUSPENDED"] } }, orderBy: { updatedAt: "desc" }, take: 100 });
}

async function tell(userId: string, businessId: string, title: string, body: string, key: string) {
  await createAlert({ userId, kind: "HUB_VERIFICATION", title, body, link: "/hub/me", dedupeKey: `hub-verify:${businessId}:${key}:${Date.now()}` });
}

export async function decideVerification(actor: Actor, businessId: string, decision: "VERIFY" | "RETURN", rawNote: string) {
  requireModerator(actor);
  const b = await db.hubBusiness.findUnique({ where: { id: businessId } });
  if (!b) throw new NotFoundError("Business not found");
  if (b.verification !== "PENDING_REVIEW") throw new AppError("This business is not waiting for verification.");
  const n = note.parse(rawNote);
  if (decision === "RETURN" && !n) throw new AppError("Say what the business needs to fix.");
  if (decision === "VERIFY") {
    await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "VERIFIED", verifiedAt: new Date(), verifiedById: actor.id, verificationNote: n } });
    await tell(b.ownerId, b.id, "Your business is verified", `${b.name} now shows a Verified badge on the trade hub.`, "verified");
  } else {
    await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "UNVERIFIED", verificationNote: n } });
    await tell(b.ownerId, b.id, "Verification needs more information", n, "returned");
  }
  await audit(actor.id, decision === "VERIFY" ? "hub.business.verify" : "hub.business.return", "HubBusiness", b.id, { note: n });
}

/** Hides a business, its listings and its ability to message. Existing conversations stay readable to the other side. */
export async function suspendBusiness(actor: Actor, businessId: string, rawNote: string) {
  requireModerator(actor);
  const n = note.min(1, "Give the reason for suspending").parse(rawNote);
  const b = await db.hubBusiness.update({ where: { id: businessId }, data: { verification: "SUSPENDED", verificationNote: n, verifiedAt: null, verifiedById: null } }).catch(() => null);
  if (!b) throw new NotFoundError("Business not found");
  await audit(actor.id, "hub.business.suspend", "HubBusiness", b.id, { note: n });
}

/** Lifts a suspension. The business starts again as unverified and must request verification. */
export async function reinstateBusiness(actor: Actor, businessId: string) {
  requireModerator(actor);
  const b = await db.hubBusiness.findUnique({ where: { id: businessId } });
  if (!b || b.verification !== "SUSPENDED") throw new NotFoundError("Suspended business not found");
  await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "UNVERIFIED", verificationNote: "Suspension lifted. Request verification again to get the Verified badge." } });
  await audit(actor.id, "hub.business.reinstate", "HubBusiness", b.id);
}

export const reportInput = z.object({ businessId: z.string().min(1), reason: z.string().trim().min(10, "Describe what happened in a sentence or two").max(2000) });

export async function reportBusiness(actor: Actor, raw: z.input<typeof reportInput>) {
  const input = reportInput.parse(raw);
  const b = await db.hubBusiness.findUnique({ where: { id: input.businessId } });
  if (!b || !canSeeBusiness(actor, b)) throw new NotFoundError("Business not found");
  if (b.ownerId === actor.id) throw new AppError("You cannot report your own business.");
  const open = await db.hubReport.findFirst({ where: { businessId: b.id, reporterId: actor.id, status: "OPEN" } });
  if (open) throw new AppError("You have already reported this business. RefineryLens will review it.");
  const r = await db.hubReport.create({ data: { businessId: b.id, reporterId: actor.id, reason: input.reason } });
  await audit(actor.id, "hub.report.create", "HubReport", r.id, { businessId: b.id });
  return r;
}

export async function openReports(actor: Actor) {
  requireModerator(actor);
  return db.hubReport.findMany({ where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, include: { business: true, reporter: { select: { name: true, email: true } } } });
}

export async function closeReport(actor: Actor, id: string) {
  requireModerator(actor);
  await db.hubReport.update({ where: { id }, data: { status: "CLOSED" } }).catch(() => {
    throw new NotFoundError("Report not found");
  });
  await audit(actor.id, "hub.report.close", "HubReport", id);
}
