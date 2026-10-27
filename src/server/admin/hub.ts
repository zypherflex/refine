import type { DeliveryJobStatus, HubListingKind, HubRole, HubVerification, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { audit } from "../audit";
import { createAlert } from "../services/alerts";
import { endTripFor } from "../tracking";
import { PAGE_SIZE, requireAdmin } from "./guard";

const note = (s: string) => {
  const t = s.trim();
  if (t.length < 5) throw new AppError("Give a short reason; the business is told.");
  return t.slice(0, 500);
};

export type BusinessFilter = { q?: string; verification?: string; role?: string; state?: string; delivery?: string; plan?: string; page: number };

export async function listBusinesses(actor: Actor, f: BusinessFilter, now = new Date()) {
  requireAdmin(actor);
  const where: Prisma.HubBusinessWhereInput = {};
  if (f.q?.trim()) where.OR = [{ name: { contains: f.q.trim(), mode: "insensitive" } }, { registrationNumber: { contains: f.q.trim(), mode: "insensitive" } }, { owner: { email: { contains: f.q.trim(), mode: "insensitive" } } }];
  if (f.verification) where.verification = f.verification as HubVerification;
  if (f.role) where.roles = { has: f.role as HubRole };
  if (f.state) where.state = f.state;
  if (f.delivery === "yes") where.homeDelivery = true;
  if (f.plan === "active") where.planUntil = { gt: now };
  if (f.plan === "expiring") where.planUntil = { gt: now, lt: new Date(now.getTime() + 14 * 86_400_000) };
  const [total, rows] = await Promise.all([
    db.hubBusiness.count({ where }),
    db.hubBusiness.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { owner: { select: { id: true, name: true, email: true } }, _count: { select: { listings: true, gasOrders: true, priceReports: true, reports: true } } },
    }),
  ]);
  return { total, rows };
}

export type ListingFilter = { q?: string; kind?: string; status?: string; state?: string; page: number };

export async function listListings(actor: Actor, f: ListingFilter, now = new Date()) {
  requireAdmin(actor);
  const where: Prisma.HubListingWhereInput = {};
  if (f.q?.trim()) where.OR = [{ title: { contains: f.q.trim(), mode: "insensitive" } }, { business: { name: { contains: f.q.trim(), mode: "insensitive" } } }];
  if (f.kind) where.kind = f.kind as HubListingKind;
  if (f.state) where.state = f.state;
  if (f.status === "LIVE") Object.assign(where, { status: "ACTIVE", expiresAt: { gt: now } });
  if (f.status === "EXPIRED") Object.assign(where, { status: "ACTIVE", expiresAt: { lte: now } });
  if (f.status === "CLOSED") where.status = "CLOSED";
  const [total, rows] = await Promise.all([
    db.hubListing.count({ where }),
    db.hubListing.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { business: { select: { id: true, name: true, ownerId: true, verification: true } }, _count: { select: { threads: true } } } }),
  ]);
  return { total, rows };
}

/** Takes down a listing that breaks the rules; the business is told why. */
export async function adminCloseListing(actor: Actor, id: string, reason: string) {
  requireAdmin(actor);
  const why = note(reason);
  const l = await db.hubListing.findUnique({ where: { id }, include: { business: true } });
  if (!l) throw new NotFoundError("Listing not found");
  await db.hubListing.update({ where: { id }, data: { status: "CLOSED" } });
  await createAlert({ userId: l.business.ownerId, kind: "HUB_LISTING", title: "Your listing was taken down", body: `“${l.title}”: ${why}`, link: "/hub/me", dedupeKey: `listing-takedown:${id}` });
  await audit(actor.id, "admin.listing.close", "HubListing", id, { reason: why });
}

export type JobFilter = { q?: string; status?: string; stale?: string; page: number };

export async function listJobs(actor: Actor, f: JobFilter, now = new Date()) {
  requireAdmin(actor);
  const where: Prisma.DeliveryJobWhereInput = {};
  if (f.q?.trim()) where.OR = [{ title: { contains: f.q.trim(), mode: "insensitive" } }, { poster: { name: { contains: f.q.trim(), mode: "insensitive" } } }];
  if (f.status) where.status = f.status as DeliveryJobStatus;
  // Awarded more than two weeks ago and still not confirmed by both sides.
  if (f.stale === "yes") Object.assign(where, { status: "AWARDED", updatedAt: { lt: new Date(now.getTime() - 14 * 86_400_000) } });
  const [total, rows] = await Promise.all([
    db.deliveryJob.count({ where }),
    db.deliveryJob.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { poster: { select: { id: true, name: true } }, quotes: { select: { status: true, priceNaira: true, carrier: { select: { name: true } } } }, trip: { select: { status: true, lastAt: true } } },
    }),
  ]);
  return { total, rows };
}

/** Cancels a job that is abandoned or fraudulent; the poster and the awarded carrier are told. */
export async function adminCancelJob(actor: Actor, id: string, reason: string) {
  requireAdmin(actor);
  const why = note(reason);
  const j = await db.deliveryJob.findUnique({ where: { id }, include: { poster: true, quotes: { where: { status: "ACCEPTED" }, include: { carrier: true } } } });
  if (!j) throw new NotFoundError("Job not found");
  if (j.status === "DELIVERED" || j.status === "CANCELLED") throw new AppError("This job is already closed.");
  await db.deliveryJob.update({ where: { id }, data: { status: "CANCELLED" } });
  await db.deliveryQuote.updateMany({ where: { jobId: id, status: "PENDING" }, data: { status: "DECLINED" } });
  await endTripFor({ kind: "DELIVERY_JOB", id });
  for (const userId of [j.poster.ownerId, ...j.quotes.map((q) => q.carrier.ownerId)]) {
    await createAlert({ userId, kind: "HUB_JOB", title: "A delivery job was cancelled by RefineryLens", body: `“${j.title}”: ${why}`, link: `/hub/jobs/${id}`, dedupeKey: `job-admin-cancel:${id}` });
  }
  await audit(actor.id, "admin.job.cancel", "DeliveryJob", id, { reason: why });
}
