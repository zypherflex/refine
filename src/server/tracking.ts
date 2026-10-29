import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { DriverTrip, GasOrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { STATE_CAPITALS } from "@/lib/hub/gas";
import { distanceKm, etaMinutes, isValidPosition, KEEP_PINGS_DAYS, LIVE_FOR_MS, MAX_ACCURACY_M, PING_EVERY_MS, thinTrail } from "@/lib/tracking";
import { audit } from "./audit";
import { createAlert } from "./services/alerts";
import { geocodePlace } from "./connect/geocode";
import { getJob } from "./hub/jobs";

export type TripRef = { kind: "GAS_ORDER"; id: string } | { kind: "DELIVERY_JOB"; id: string };

const ACTIVE_ORDER: GasOrderStatus[] = ["ACCEPTED", "OUT_FOR_DELIVERY"];
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** What a trip is for, and whether the delivery is still under way (tracking stops as soon as it is not). */
async function loadRef(ref: TripRef) {
  if (ref.kind === "GAS_ORDER") {
    const o = await db.gasOrder.findUnique({ where: { id: ref.id }, include: { business: true } });
    if (!o) throw new NotFoundError("Order not found");
    return { business: o.business, active: ACTIVE_ORDER.includes(o.status), watchers: [o.userId], order: o, job: null };
  }
  const j = await db.deliveryJob.findUnique({ where: { id: ref.id }, include: { poster: true, quotes: { where: { status: "ACCEPTED" }, include: { carrier: true } } } });
  if (!j) throw new NotFoundError("Job not found");
  const carrier = j.quotes[0]?.carrier ?? null;
  return { business: carrier, active: j.status === "AWARDED" && !!carrier, watchers: [j.poster.ownerId], order: null, job: j };
}

export const driverInput = z.object({
  driverName: z.string().trim().min(2, "Give the driver's name").max(80),
  driverPhone: z.string().trim().max(20).default(""),
});

/**
 * The seller of a gas order or the carrier of a job creates a private link for its driver. Creating a new link
 * replaces the old one, so a link sent to the wrong person can be cancelled. The secret is shown once.
 */
export async function createDriverLink(actor: Actor, ref: TripRef, raw: z.input<typeof driverInput>) {
  const r = await loadRef(ref);
  if (!r.business || r.business.ownerId !== actor.id) throw new ForbiddenError();
  if (!r.active) throw new AppError(ref.kind === "GAS_ORDER" ? "Accept the order before sending a driver link." : "Driver links are for awarded jobs that are not yet delivered.");
  const input = driverInput.parse(raw);
  const token = randomBytes(24).toString("base64url");
  const existing = await db.driverTrip.findFirst({ where: ref.kind === "GAS_ORDER" ? { gasOrderId: ref.id } : { deliveryJobId: ref.id } });
  const dest = existing?.destLat != null ? null : await destination(r).catch(() => null);
  const data = { ...input, tokenHash: hash(token), status: existing?.status === "LIVE" ? ("LIVE" as const) : ("WAITING" as const), endedAt: null, ...(dest ?? {}) };
  const trip = existing
    ? await db.driverTrip.update({ where: { id: existing.id }, data })
    : await db.driverTrip.create({ data: { ...data, businessId: r.business.id, ...(ref.kind === "GAS_ORDER" ? { gasOrderId: ref.id } : { deliveryJobId: ref.id }) } });
  await audit(actor.id, "trip.driver_link", "DriverTrip", trip.id, { kind: ref.kind });
  return { trip, path: `/drive/${token}` };
}

/** Best-effort map position of the drop-off: the geocoder when set up, else (for jobs) the destination state's capital. */
async function destination(r: Awaited<ReturnType<typeof loadRef>>) {
  if (r.order) {
    const hit = await geocodePlace([r.order.area, r.order.state]);
    return hit ? { destLat: hit.lat, destLon: hit.lon, destLabel: `${r.order.area}, ${r.order.state} (area, approximate)` } : null;
  }
  const j = r.job!;
  const hit = await geocodePlace([j.toTown, j.toState]);
  if (hit) return { destLat: hit.lat, destLon: hit.lon, destLabel: `${[j.toTown, j.toState].filter(Boolean).join(", ")} (approximate)` };
  const cap = STATE_CAPITALS[j.toState as keyof typeof STATE_CAPITALS];
  return cap ? { destLat: cap[0], destLon: cap[1], destLabel: `${j.toState} state capital (approximate)` } : null;
}

async function tripByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundError("This driver link is not valid.");
  const trip = await db.driverTrip.findUnique({ where: { tokenHash: hash(token) } });
  if (!trip) throw new NotFoundError("This driver link is not valid. Ask for a new one.");
  return trip;
}

const refOf = (t: DriverTrip): TripRef => (t.gasOrderId ? { kind: "GAS_ORDER", id: t.gasOrderId } : { kind: "DELIVERY_JOB", id: t.deliveryJobId! });

export class TripEndedError extends AppError {}

/** What the driver page shows: the drop-off, and for gas orders the customer's address and phone. */
export async function driverView(token: string) {
  const trip = await tripByToken(token);
  const r = await loadRef(refOf(trip));
  return { trip, ...r };
}

export const pingInput = z.object({
  lat: z.number(),
  lon: z.number(),
  accuracy: z.number().min(0).nullable().default(null),
  speed: z.number().min(0).max(100).nullable().default(null),
  heading: z.number().min(0).max(360).nullable().default(null),
});

/**
 * Stores a position from the driver's phone. The first position marks a gas order as on its way and tells the
 * customer (or the job poster) that they can follow it. Ended deliveries refuse positions, which stops the phone.
 */
export async function recordPing(token: string, raw: z.input<typeof pingInput>, now = new Date()) {
  const trip = await tripByToken(token);
  const p = pingInput.parse(raw);
  if (!isValidPosition(p)) throw new AppError("That position is not valid.");
  if (trip.status === "ENDED") throw new TripEndedError("Sharing has ended for this delivery.");
  const ref = refOf(trip);
  const r = await loadRef(ref);
  if (!r.active) {
    await endTrip(trip.id, now);
    throw new TripEndedError("This delivery is finished, so sharing has stopped.");
  }
  if (p.accuracy !== null && p.accuracy > MAX_ACCURACY_M) return { stored: false, reason: "inaccurate" as const };
  if (trip.lastAt && now.getTime() - trip.lastAt.getTime() < PING_EVERY_MS / 2) return { stored: false, reason: "too_soon" as const };
  const first = trip.status === "WAITING";
  await db.$transaction([
    db.tripPing.create({ data: { tripId: trip.id, lat: p.lat, lon: p.lon, accuracy: p.accuracy, speed: p.speed, heading: p.heading, recordedAt: now } }),
    db.driverTrip.update({
      where: { id: trip.id },
      data: { status: "LIVE", startedAt: trip.startedAt ?? now, lastLat: p.lat, lastLon: p.lon, lastAccuracy: p.accuracy, lastSpeed: p.speed, lastAt: now },
    }),
  ]);
  if (first) await announceStart(trip, r);
  return { stored: true as const };
}

async function announceStart(trip: DriverTrip, r: Awaited<ReturnType<typeof loadRef>>) {
  if (r.order) {
    if (r.order.status === "ACCEPTED") await db.gasOrder.update({ where: { id: r.order.id }, data: { status: "OUT_FOR_DELIVERY" } });
    // Same key as the seller's "On the way" button, so the customer is told once either way.
    await createAlert({ userId: r.order.userId, kind: "GAS_ORDER", title: "Your gas is on the way", body: `${trip.driverName} from ${r.business!.name} is bringing it. Follow them live on the order page.`, link: `/orders/${r.order.id}`, dedupeKey: `order:dispatch:${r.order.id}` });
  } else {
    await createAlert({ userId: r.job!.poster.ownerId, kind: "HUB_JOB", title: "Your load is moving", body: `${trip.driverName} from ${r.business!.name} is sharing their location for “${r.job!.title}”.`, link: `/hub/jobs/${r.job!.id}`, dedupeKey: `job-track:${r.job!.id}` });
  }
}

/** The driver stops sharing. A new position from the same link starts it again while the delivery is active. */
export async function stopSharing(token: string) {
  const trip = await tripByToken(token);
  await db.driverTrip.update({ where: { id: trip.id }, data: { status: trip.status === "ENDED" ? "ENDED" : "WAITING" } });
}

/** A gas order's driver marks it delivered from the driver page, as the seller can from its order list. */
export async function driverDelivered(token: string, now = new Date()) {
  const trip = await tripByToken(token);
  if (!trip.gasOrderId) throw new AppError("Jobs are confirmed by both businesses on the job page.");
  const r = await loadRef(refOf(trip));
  if (!r.active) throw new TripEndedError("This order is already closed.");
  await db.gasOrder.update({ where: { id: trip.gasOrderId }, data: { status: "DELIVERED", deliveredAt: now } });
  await endTrip(trip.id, now);
  await createAlert({ userId: r.order!.userId, kind: "GAS_ORDER", title: "Your gas was delivered", body: `Rate ${r.business!.name} to help your neighbours choose.`, link: `/orders/${r.order!.id}`, dedupeKey: `order:deliver:${r.order!.id}` });
}

async function endTrip(tripId: string, now = new Date()) {
  await db.driverTrip.update({ where: { id: tripId }, data: { status: "ENDED", endedAt: now } });
}

/** Called when an order or job closes (delivered, declined or cancelled). */
export async function endTripFor(ref: TripRef, now = new Date()) {
  await db.driverTrip.updateMany({ where: { ...(ref.kind === "GAS_ORDER" ? { gasOrderId: ref.id } : { deliveryJobId: ref.id }), status: { not: "ENDED" } }, data: { status: "ENDED", endedAt: now } });
}

/** Who may watch: the customer and seller of a gas order; the poster and carrier of a job. */
async function canWatch(actor: Actor, ref: TripRef) {
  if (ref.kind === "GAS_ORDER") {
    const o = await db.gasOrder.findUnique({ where: { id: ref.id }, include: { business: { select: { ownerId: true } } } });
    return !!o && (o.userId === actor.id || o.business.ownerId === actor.id);
  }
  const { isPoster, isCarrier } = await getJob(actor, ref.id).catch(() => ({ isPoster: false, isCarrier: false }));
  return isPoster || isCarrier;
}

export type TripView = {
  status: "NONE" | "WAITING" | "LIVE" | "ENDED";
  driverName?: string;
  driverPhone?: string;
  live?: boolean;
  last?: { lat: number; lon: number; accuracy: number | null; at: string } | null;
  trail?: [number, number][];
  dest?: { lat: number; lon: number; label: string } | null;
  distanceKm?: number | null;
  etaMin?: number | null;
};

/** The live map's data, polled by the order or job page. */
export async function tripView(actor: Actor, ref: TripRef, now = new Date()): Promise<TripView> {
  if (!(await canWatch(actor, ref))) throw new NotFoundError("Not found");
  const trip = await db.driverTrip.findFirst({ where: ref.kind === "GAS_ORDER" ? { gasOrderId: ref.id } : { deliveryJobId: ref.id } });
  if (!trip) return { status: "NONE" };
  const pings = await db.tripPing.findMany({ where: { tripId: trip.id }, orderBy: { recordedAt: "asc" }, select: { lat: true, lon: true, speed: true } });
  const last = trip.lastLat != null && trip.lastLon != null && trip.lastAt ? { lat: trip.lastLat, lon: trip.lastLon, accuracy: trip.lastAccuracy, at: trip.lastAt.toISOString() } : null;
  const dest = trip.destLat != null && trip.destLon != null ? { lat: trip.destLat, lon: trip.destLon, label: trip.destLabel } : null;
  const km = last && dest ? distanceKm(last, dest) : null;
  const live = trip.status === "LIVE" && !!trip.lastAt && now.getTime() - trip.lastAt.getTime() < LIVE_FOR_MS;
  return {
    status: trip.status,
    driverName: trip.driverName,
    driverPhone: trip.driverPhone,
    live,
    last,
    trail: thinTrail(pings.map((p) => [p.lat, p.lon] as [number, number])),
    dest,
    distanceKm: km === null ? null : Math.round(km * 10) / 10,
    etaMin: km === null || trip.status === "ENDED" ? null : etaMinutes(km, pings.slice(-6).map((p) => p.speed), ref.kind),
  };
}

/** Worker: ends trips whose delivery has closed, and deletes positions a week after a trip ends. */
export async function tidyTrips(now = new Date()) {
  const open = await db.driverTrip.findMany({ where: { status: { not: "ENDED" } }, include: { gasOrder: { select: { status: true } }, deliveryJob: { select: { status: true } } } });
  for (const t of open) {
    const active = t.gasOrder ? ACTIVE_ORDER.includes(t.gasOrder.status) : t.deliveryJob?.status === "AWARDED";
    if (!active) await endTrip(t.id, now);
  }
  const { count } = await db.tripPing.deleteMany({ where: { trip: { status: "ENDED", endedAt: { lt: new Date(now.getTime() - KEEP_PINGS_DAYS * 86_400_000) } } } });
  await db.driverTrip.updateMany({ where: { status: "ENDED", endedAt: { lt: new Date(now.getTime() - KEEP_PINGS_DAYS * 86_400_000) } }, data: { lastLat: null, lastLon: null, lastAccuracy: null, lastSpeed: null } });
  return count;
}
