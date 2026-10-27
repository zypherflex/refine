import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { PRODUCTS, UNITS } from "@/lib/hub/catalog";
import { startOfDay } from "@/lib/hub/rules";
import { audit } from "../audit";
import { requireBusiness, stateField } from "./business";

const productIds = PRODUCTS.map((p) => p.id) as [string, ...string[]];

export const jobInput = z.object({
  product: z.enum(productIds),
  quantity: z.coerce.number().positive("Quantity must be more than zero").max(1e9),
  unit: z.enum(UNITS),
  fromState: stateField,
  fromPlace: z.string().trim().min(2, "Where is the load collected?").max(120),
  toState: stateField,
  toPlace: z.string().trim().min(2, "Where is it going?").max(120),
  readyBy: z.coerce.date(),
  notes: z.string().trim().max(1000).default(""),
});

export async function postJob(actor: Actor, raw: z.input<typeof jobInput>, now = new Date()) {
  const input = jobInput.parse(raw);
  const b = await requireBusiness(actor);
  if (startOfDay(input.readyBy) < startOfDay(now)) throw new AppError("The ready date cannot be in the past.");
  if ((await db.deliveryJob.count({ where: { posterId: b.id, status: "OPEN" } })) >= 20) throw new AppError("You have 20 open jobs. Award or cancel some first.");
  const j = await db.deliveryJob.create({ data: { ...input, readyBy: startOfDay(input.readyBy), posterId: b.id } });
  await audit(actor.id, "hub.job.create", "DeliveryJob", j.id);
  return j;
}

export async function listJobs(f: { status?: string; state?: string; product?: string } = {}) {
  const where: Prisma.DeliveryJobWhereInput = {
    status: f.status === "ALL" ? undefined : ((f.status as never) ?? "OPEN"),
    poster: { verification: { not: "SUSPENDED" } },
    ...(f.state ? { OR: [{ fromState: f.state }, { toState: f.state }] } : {}),
    ...(f.product ? { product: f.product } : {}),
  };
  return db.deliveryJob.findMany({ where, include: { poster: true, _count: { select: { quotes: true } } }, orderBy: [{ readyBy: "asc" }], take: 100 });
}

export async function myJobs(actor: Actor) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) return { posted: [], quoted: [] };
  const [posted, quoted] = await Promise.all([
    db.deliveryJob.findMany({ where: { posterId: b.id }, include: { _count: { select: { quotes: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.deliveryQuote.findMany({ where: { haulierId: b.id }, include: { job: { include: { poster: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return { posted, quoted };
}

/**
 * A job and the quotes the caller may see. The poster sees every quote; a haulier sees only their own;
 * everyone else sees how many quotes there are.
 */
export async function getJob(actor: Actor, id: string) {
  const job = await db.deliveryJob.findUnique({ where: { id }, include: { poster: true, quotes: { include: { haulier: true }, orderBy: { priceNgn: "asc" } } } });
  if (!job) throw new NotFoundError("Delivery job not found");
  const me = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  const isPoster = !!me && me.id === job.posterId;
  if (job.poster.verification === "SUSPENDED" && !isPoster) throw new NotFoundError("Delivery job not found");
  const accepted = job.quotes.find((q) => q.id === job.acceptedQuoteId) ?? null;
  const isHaulier = !!me && !!accepted && accepted.haulierId === me.id;
  const quotes = isPoster ? job.quotes : job.quotes.filter((q) => q.haulierId === me?.id);
  return { job: { ...job, quotes: undefined }, quotes, quoteCount: job.quotes.length, accepted: isPoster || isHaulier ? accepted : null, me, isPoster, isHaulier };
}

export const quoteInput = z.object({
  jobId: z.string().min(1),
  priceNgn: z.coerce.number().positive("Enter your price in naira").max(1e11),
  days: z.coerce.number().int().min(0).max(60),
  note: z.string().trim().max(500).default(""),
});

export async function quoteJob(actor: Actor, raw: z.input<typeof quoteInput>) {
  const input = quoteInput.parse(raw);
  const b = await requireBusiness(actor);
  if (!b.roles.includes("HAULIER")) throw new AppError("Only hauliers can quote. Add the Haulier role to your business profile first.");
  const job = await db.deliveryJob.findUnique({ where: { id: input.jobId } });
  if (!job) throw new NotFoundError("Delivery job not found");
  if (job.posterId === b.id) throw new AppError("You cannot quote on your own job.");
  if (job.status !== "OPEN") throw new AppError("This job is no longer taking quotes.");
  const data = { priceNgn: input.priceNgn, days: input.days, note: input.note, status: "PENDING" as const };
  const q = await db.deliveryQuote.upsert({ where: { jobId_haulierId: { jobId: job.id, haulierId: b.id } }, update: data, create: { ...data, jobId: job.id, haulierId: b.id } });
  await audit(actor.id, "hub.quote.submit", "DeliveryQuote", q.id);
  return q;
}

export async function withdrawQuote(actor: Actor, quoteId: string) {
  const b = await requireBusiness(actor);
  const { count } = await db.deliveryQuote.updateMany({ where: { id: quoteId, haulierId: b.id, status: "PENDING" }, data: { status: "WITHDRAWN" } });
  if (!count) throw new NotFoundError("Quote not found");
}

export async function acceptQuote(actor: Actor, quoteId: string) {
  const b = await requireBusiness(actor);
  const q = await db.deliveryQuote.findUnique({ where: { id: quoteId }, include: { job: true, haulier: true } });
  if (!q || q.job.posterId !== b.id) throw new NotFoundError("Quote not found");
  if (q.job.status !== "OPEN") throw new AppError("This job already has an accepted quote.");
  if (q.status !== "PENDING") throw new AppError("This quote was withdrawn.");
  if (q.haulier.verification === "SUSPENDED") throw new AppError("This haulier is suspended and cannot be booked.");
  return db.$transaction(async (tx) => {
    // The status guard makes a double accept fail instead of awarding the job twice.
    const { count } = await tx.deliveryJob.updateMany({ where: { id: q.jobId, status: "OPEN" }, data: { status: "AWARDED", acceptedQuoteId: q.id } });
    if (!count) throw new AppError("This job already has an accepted quote.");
    await tx.deliveryQuote.update({ where: { id: q.id }, data: { status: "ACCEPTED" } });
    await tx.deliveryQuote.updateMany({ where: { jobId: q.jobId, id: { not: q.id }, status: "PENDING" }, data: { status: "DECLINED" } });
    await audit(actor.id, "hub.quote.accept", "DeliveryQuote", q.id, undefined, tx);
    return q;
  });
}

/** Each side confirms delivery separately. The job counts as delivered only when both have. */
export async function confirmDelivery(actor: Actor, jobId: string) {
  const b = await requireBusiness(actor);
  const job = await db.deliveryJob.findUnique({ where: { id: jobId }, include: { quotes: { where: { status: "ACCEPTED" } } } });
  if (!job) throw new NotFoundError("Delivery job not found");
  const haulierId = job.quotes[0]?.haulierId;
  const side = job.posterId === b.id ? "poster" : haulierId === b.id ? "haulier" : null;
  if (!side) throw new ForbiddenError("Only the two sides of this job can confirm delivery.");
  if (job.status !== "AWARDED") throw new AppError(job.status === "DELIVERED" ? "Delivery is already confirmed by both sides." : "Accept a quote before confirming delivery.");
  const now = new Date();
  const data = side === "poster" ? { posterConfirmedAt: job.posterConfirmedAt ?? now } : { haulierConfirmedAt: job.haulierConfirmedAt ?? now };
  const both = (side === "poster" ? job.haulierConfirmedAt : job.posterConfirmedAt) != null;
  const u = await db.deliveryJob.update({ where: { id: job.id }, data: { ...data, ...(both ? { status: "DELIVERED" as const } : {}) } });
  await audit(actor.id, "hub.job.confirm", "DeliveryJob", job.id, { side, both });
  return u;
}

export async function cancelJob(actor: Actor, jobId: string) {
  const b = await requireBusiness(actor);
  const { count } = await db.deliveryJob.updateMany({ where: { id: jobId, posterId: b.id, status: "OPEN" }, data: { status: "CANCELLED" } });
  if (!count) throw new AppError("Only open jobs you posted can be cancelled.");
  await db.deliveryQuote.updateMany({ where: { jobId, status: "PENDING" }, data: { status: "DECLINED" } });
}
