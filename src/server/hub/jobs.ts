import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { LOCATIONS, PRODUCTS, UNITS } from "@/lib/hub/catalog";
import { audit } from "../audit";
import { createAlert } from "../services/alerts";
import { canSeeBusiness, requireMyBusiness } from "./business";

/**
 * Delivery jobs: a business posts a load, delivery partners quote, the poster accepts one quote, and the job counts
 * as delivered once both the poster and the carrier confirm. Payment is settled between them, outside RefineryLens.
 */

const location = z.string().refine((s) => LOCATIONS.includes(s), "Choose a location from the list");
const productIds = PRODUCTS.map((p) => p.id) as [string, ...string[]];

export const jobInput = z.object({
  title: z.string().trim().min(4).max(140),
  products: z.array(z.enum(productIds)).min(1, "Choose what is being carried").max(6),
  quantity: z.number().positive().finite().max(1e9),
  unit: z.enum(UNITS),
  fromState: location,
  fromTown: z.string().trim().max(80).default(""),
  toState: location,
  toTown: z.string().trim().max(80).default(""),
  pickupDate: z.coerce.date(),
  details: z.string().trim().max(2000).default(""),
});

export const quoteInput = z.object({ priceNaira: z.number().positive().finite().max(1e11), note: z.string().trim().max(1000).default("") });

const MAX_OPEN_JOBS = 30;

async function activeBusiness(actor: Actor) {
  const b = await requireMyBusiness(actor);
  if (b.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended.");
  return b;
}

export async function postJob(actor: Actor, raw: z.input<typeof jobInput>) {
  const b = await activeBusiness(actor);
  const input = jobInput.parse(raw);
  const today = new Date(new Date().toDateString());
  if (input.pickupDate < new Date(today.getTime() - 86_400_000)) throw new AppError("The pickup date has passed.");
  if ((await db.deliveryJob.count({ where: { posterId: b.id, status: "OPEN" } })) >= MAX_OPEN_JOBS) throw new AppError(`You have ${MAX_OPEN_JOBS} open jobs. Award or cancel some first.`);
  const job = await db.deliveryJob.create({ data: { ...input, products: [...new Set(input.products)], posterId: b.id } });
  await audit(actor.id, "job.post", "DeliveryJob", job.id);
  return job;
}

/** Open jobs carriers can quote on, optionally by route and product. */
export async function openJobs(viewer: Actor, f: { fromState?: string; toState?: string; product?: string } = {}) {
  const where: Prisma.DeliveryJobWhereInput = {
    status: "OPEN",
    pickupDate: { gte: new Date(Date.now() - 2 * 86_400_000) },
    poster: { verification: { not: "SUSPENDED" } },
    ...(f.fromState ? { fromState: f.fromState } : {}),
    ...(f.toState ? { toState: f.toState } : {}),
    ...(f.product ? { products: { has: f.product } } : {}),
  };
  const rows = await db.deliveryJob.findMany({ where, include: { poster: true, _count: { select: { quotes: true } } }, orderBy: { pickupDate: "asc" }, take: 100 });
  return rows.filter((j) => canSeeBusiness(viewer, j.poster));
}

/** Jobs the viewer posted, and jobs they quoted on. */
export async function myJobs(actor: Actor) {
  const [posted, quoted] = await Promise.all([
    db.deliveryJob.findMany({ where: { poster: { ownerId: actor.id } }, include: { _count: { select: { quotes: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.deliveryQuote.findMany({ where: { carrier: { ownerId: actor.id } }, include: { job: { include: { poster: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return { posted, quoted };
}

/**
 * A job with what `viewer` may see: the poster sees every quote; a carrier sees only its own; anyone else sees the job
 * while it is open. Carrier details of the accepted quote are shown to both parties.
 */
export async function getJob(viewer: Actor, id: string) {
  const job = await db.deliveryJob.findUnique({ where: { id }, include: { poster: true, quotes: { include: { carrier: true }, orderBy: { priceNaira: "asc" } } } });
  if (!job) throw new NotFoundError("Job not found");
  const isPoster = job.poster.ownerId === viewer.id;
  const myQuote = job.quotes.find((q) => q.carrier.ownerId === viewer.id) ?? null;
  const accepted = job.quotes.find((q) => q.id === job.acceptedQuoteId) ?? null;
  const isCarrier = !!accepted && accepted.carrier.ownerId === viewer.id;
  if (!isPoster && !myQuote && (job.status !== "OPEN" || !canSeeBusiness(viewer, job.poster))) throw new NotFoundError("Job not found");
  return { job, isPoster, isCarrier, myQuote, accepted, quotes: isPoster ? job.quotes : myQuote ? [myQuote] : [] };
}

export async function submitQuote(actor: Actor, jobId: string, raw: z.input<typeof quoteInput>) {
  const carrier = await activeBusiness(actor);
  if (!carrier.roles.includes("DELIVERY")) throw new AppError("Add the delivery partner role to your business profile to quote on jobs.");
  const input = quoteInput.parse(raw);
  const job = await db.deliveryJob.findUnique({ where: { id: jobId }, include: { poster: true } });
  if (!job || !canSeeBusiness(actor, job.poster)) throw new NotFoundError("Job not found");
  if (job.status !== "OPEN") throw new AppError("This job is no longer taking quotes.");
  if (job.posterId === carrier.id) throw new AppError("You cannot quote on your own job.");
  const q = await db.deliveryQuote.upsert({
    where: { jobId_carrierId: { jobId, carrierId: carrier.id } },
    update: { ...input, status: "PENDING" },
    create: { ...input, jobId, carrierId: carrier.id },
  });
  await createAlert({ userId: job.poster.ownerId, kind: "HUB_JOB", title: `New quote from ${carrier.name}`, body: `For “${job.title}”. Compare quotes and accept one on the job page.`, link: `/hub/jobs/${job.id}`, dedupeKey: `job-quote:${q.id}:${q.updatedAt.getTime()}` });
  return q;
}

export async function withdrawQuote(actor: Actor, jobId: string) {
  const q = await db.deliveryQuote.findFirst({ where: { jobId, carrier: { ownerId: actor.id } }, include: { job: true } });
  if (!q) throw new NotFoundError("Quote not found");
  if (q.status !== "PENDING" || q.job.status !== "OPEN") throw new AppError("Only a pending quote on an open job can be withdrawn.");
  await db.deliveryQuote.update({ where: { id: q.id }, data: { status: "WITHDRAWN" } });
}

async function posterJob(actor: Actor, jobId: string) {
  const job = await db.deliveryJob.findUnique({ where: { id: jobId }, include: { poster: true } });
  if (!job || job.poster.ownerId !== actor.id) throw new NotFoundError("Job not found");
  return job;
}

/** Accepts one quote; every other pending quote is declined and the carriers are told. */
export async function acceptQuote(actor: Actor, jobId: string, quoteId: string) {
  const job = await posterJob(actor, jobId);
  if (job.status !== "OPEN") throw new AppError("This job has already been awarded or closed.");
  const quote = await db.deliveryQuote.findUnique({ where: { id: quoteId }, include: { carrier: true } });
  if (!quote || quote.jobId !== jobId || quote.status !== "PENDING") throw new NotFoundError("Quote not found");
  if (quote.carrier.verification === "SUSPENDED") throw new AppError("This carrier has been suspended and cannot be awarded the job.");
  const others = await db.deliveryQuote.findMany({ where: { jobId, status: "PENDING", id: { not: quoteId } }, include: { carrier: true } });
  await db.$transaction(async (tx) => {
    await tx.deliveryJob.update({ where: { id: jobId }, data: { status: "AWARDED", acceptedQuoteId: quoteId } });
    await tx.deliveryQuote.update({ where: { id: quoteId }, data: { status: "ACCEPTED" } });
    await tx.deliveryQuote.updateMany({ where: { jobId, status: "PENDING", id: { not: quoteId } }, data: { status: "DECLINED" } });
    await createAlert({ userId: quote.carrier.ownerId, kind: "HUB_JOB", title: "Your quote was accepted", body: `${job.poster.name} accepted your quote for “${job.title}”. Confirm the pickup with them.`, link: `/hub/jobs/${job.id}`, dedupeKey: `job-accept:${quoteId}` }, tx);
    for (const o of others) await createAlert({ userId: o.carrier.ownerId, kind: "HUB_JOB", title: "Job awarded to another carrier", body: `“${job.title}” went to another quote.`, link: `/hub/jobs/${job.id}`, dedupeKey: `job-decline:${o.id}` }, tx);
  });
  await audit(actor.id, "job.accept", "DeliveryJob", jobId, { quoteId });
}

export async function cancelJob(actor: Actor, jobId: string) {
  const job = await posterJob(actor, jobId);
  if (job.status === "DELIVERED" || job.status === "CANCELLED") throw new AppError("This job is already closed.");
  await db.deliveryJob.update({ where: { id: jobId }, data: { status: "CANCELLED" } });
  await db.deliveryQuote.updateMany({ where: { jobId, status: "PENDING" }, data: { status: "DECLINED" } });
}

/** Poster or carrier confirms the delivery; the job becomes delivered when both have. */
export async function confirmDelivered(actor: Actor, jobId: string) {
  const { job, isPoster, isCarrier, accepted } = await getJob(actor, jobId);
  if (job.status !== "AWARDED" || !accepted) throw new AppError("Only an awarded job can be confirmed.");
  if (!isPoster && !isCarrier) throw new NotFoundError("Job not found");
  const now = new Date();
  const posterConfirmedAt = isPoster ? now : job.posterConfirmedAt;
  const carrierConfirmedAt = isCarrier ? now : job.carrierConfirmedAt;
  const done = !!posterConfirmedAt && !!carrierConfirmedAt;
  await db.deliveryJob.update({ where: { id: jobId }, data: { posterConfirmedAt, carrierConfirmedAt, ...(done ? { status: "DELIVERED" } : {}) } });
  const other = isPoster ? accepted.carrier.ownerId : job.poster.ownerId;
  await createAlert({ userId: other, kind: "HUB_JOB", title: done ? "Delivery confirmed by both sides" : "Delivery marked as done", body: done ? `“${job.title}” is complete.` : `Confirm “${job.title}” on the job page if the load arrived.`, link: `/hub/jobs/${job.id}`, dedupeKey: `job-confirm:${jobId}:${isPoster ? "p" : "c"}` });
  return done;
}

/** Completed jobs per carrier, for its public record. */
export async function carrierRecord(businessId: string) {
  return db.deliveryJob.count({ where: { status: "DELIVERED", quotes: { some: { carrierId: businessId, status: "ACCEPTED" } } } });
}
