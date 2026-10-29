import { z } from "zod";
import type { GasOrderStatus, OutletKind, Prisma, TripStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { median } from "@/lib/hub/prices";
import { communityPrice, EVERYDAY_ITEMS, FRESH_HOURS } from "@/lib/everyday";
import { audit } from "../audit";
import { createAlert } from "../services/alerts";
import { endTripFor } from "../tracking";
import { stuckOrderWhere, STALE_TRIP_MS } from "./attention";
import { PAGE_SIZE, requireAdmin } from "./guard";

// ---------------------------------------------------------------------------------------------------------------
// Stations and gas shops

export type OutletFilter = { q?: string; state?: string; kind?: string; hidden?: string; page: number };

export async function listOutletsAdmin(actor: Actor, f: OutletFilter) {
  requireAdmin(actor);
  const where: Prisma.OutletWhereInput = {};
  if (f.q?.trim()) where.OR = [{ name: { contains: f.q.trim(), mode: "insensitive" } }, { area: { contains: f.q.trim(), mode: "insensitive" } }, { brand: { contains: f.q.trim(), mode: "insensitive" } }];
  if (f.state) where.state = f.state;
  if (f.kind) where.kind = f.kind as OutletKind;
  if (f.hidden === "yes") where.hidden = true;
  if (f.hidden === "no") where.hidden = false;
  const [total, rows] = await Promise.all([
    db.outlet.count({ where }),
    db.outlet.findMany({
      where, orderBy: [{ state: "asc" }, { area: "asc" }, { name: "asc" }], skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { addedBy: { select: { id: true, name: true } }, _count: { select: { reports: true, contentFlags: { where: { status: "OPEN" } } } } },
    }),
  ]);
  return { total, rows };
}

export const outletEdit = z.object({
  name: z.string().trim().min(2).max(100),
  brand: z.string().trim().max(60).default(""),
  kind: z.enum(["FILLING_STATION", "GAS_RETAILER", "CNG_STATION"]),
  area: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).default(""),
});

export async function updateOutlet(actor: Actor, id: string, raw: z.input<typeof outletEdit>) {
  requireAdmin(actor);
  const data = outletEdit.parse(raw);
  await db.outlet.update({ where: { id }, data });
  await audit(actor.id, "admin.outlet.edit", "Outlet", id, data);
}

export async function setOutletHidden(actor: Actor, id: string, hidden: boolean) {
  requireAdmin(actor);
  await db.outlet.update({ where: { id }, data: { hidden } });
  await audit(actor.id, hidden ? "admin.outlet.hide" : "admin.outlet.show", "Outlet", id);
}

/** Folds a duplicate into the place it duplicates: its reports and flags move across, and the duplicate is hidden. */
export async function mergeOutlets(actor: Actor, fromId: string, intoId: string) {
  requireAdmin(actor);
  if (fromId === intoId) throw new AppError("Choose a different place to merge into.");
  const [from, into] = await Promise.all([db.outlet.findUnique({ where: { id: fromId } }), db.outlet.findUnique({ where: { id: intoId } })]);
  if (!from || !into) throw new NotFoundError("Place not found");
  if (from.state !== into.state) throw new AppError("Places in different states cannot be merged.");
  if (into.hidden) throw new AppError("The place to keep is hidden. Show it first.");
  const [moved] = await db.$transaction([
    db.outletReport.updateMany({ where: { outletId: fromId }, data: { outletId: intoId } }),
    db.contentFlag.updateMany({ where: { outletId: fromId }, data: { status: "ACTIONED", resolvedAt: new Date(), resolvedById: actor.id } }),
    db.outlet.update({ where: { id: fromId }, data: { hidden: true } }),
  ]);
  await audit(actor.id, "admin.outlet.merge", "Outlet", fromId, { into: intoId, reports: moved.count });
  return moved.count;
}

// ---------------------------------------------------------------------------------------------------------------
// Price watch

/** Share away from the state's median at which a report is listed for a second look. */
export const SUSPICIOUS_SHARE = 0.3;

/**
 * Community medians per state and product over the last three days, and the week's reports that sit far from their
 * state's median, so wrong prices can be hidden before they mislead people.
 */
export async function priceWatch(actor: Actor, f: { state?: string; item?: string }, now = new Date()) {
  requireAdmin(actor);
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const rows = await db.outletReport.findMany({
    where: { kind: "PRICE", hidden: false, createdAt: { gte: since }, outlet: { hidden: false, ...(f.state ? { state: f.state } : {}) }, ...(f.item ? { item: f.item } : {}) },
    include: { outlet: { select: { id: true, name: true, state: true, area: true } }, user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const key = (state: string, item: string) => `${state}|${item}`;
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(key(r.outlet.state, r.item!), [...(groups.get(key(r.outlet.state, r.item!)) ?? []), r]);
  const table = [...groups.entries()].map(([k, rs]) => {
    const [state, item] = k.split("|");
    const fresh = communityPrice(rs.map((r) => ({ userId: r.userId, priceNaira: r.priceNaira!, createdAt: r.createdAt })), now, FRESH_HOURS);
    return { state, item, fresh, week: { median: median(rs.map((r) => r.priceNaira!)), reports: rs.length } };
  }).sort((a, b) => a.state.localeCompare(b.state) || EVERYDAY_ITEMS.indexOf(a.item as never) - EVERYDAY_ITEMS.indexOf(b.item as never));
  const weekMedian = new Map(table.map((t) => [key(t.state, t.item), t.week.median]));
  const suspicious = rows
    .map((r) => {
      const m = weekMedian.get(key(r.outlet.state, r.item!)) ?? null;
      return { r, median: m, off: m ? (r.priceNaira! - m) / m : 0 };
    })
    .filter((x) => x.median !== null && Math.abs(x.off) >= SUSPICIOUS_SHARE && (groups.get(key(x.r.outlet.state, x.r.item!))?.length ?? 0) >= 3)
    .sort((a, b) => Math.abs(b.off) - Math.abs(a.off))
    .slice(0, 50);
  return { table, suspicious };
}

// ---------------------------------------------------------------------------------------------------------------
// Gas orders

export type OrderFilter = { q?: string; status?: string; view?: string; state?: string; page: number };

export async function listOrdersAdmin(actor: Actor, f: OrderFilter, now = new Date()) {
  requireAdmin(actor);
  const where: Prisma.GasOrderWhereInput = f.view === "stuck" ? stuckOrderWhere(now) : {};
  if (f.status) where.status = f.status as GasOrderStatus;
  if (f.state) where.state = f.state;
  if (f.q?.trim()) where.AND = [{ OR: [{ area: { contains: f.q.trim(), mode: "insensitive" } }, { business: { name: { contains: f.q.trim(), mode: "insensitive" } } }, { user: { email: { contains: f.q.trim(), mode: "insensitive" } } }] }];
  const [total, rows, byStatus] = await Promise.all([
    db.gasOrder.count({ where }),
    db.gasOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (f.page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { id: true, name: true } }, business: { select: { id: true, name: true } }, trip: { select: { status: true } } } }),
    db.gasOrder.groupBy({ by: ["status"], _count: true }),
  ]);
  return { total, rows, byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count])) as Partial<Record<GasOrderStatus, number>> };
}

/** Cancels an order that is stuck or disputed. Both the customer and the seller are told why. */
export async function adminCancelOrder(actor: Actor, id: string, reason: string) {
  requireAdmin(actor);
  const why = reason.trim();
  if (why.length < 5) throw new AppError("Give a short reason; the customer and the seller are told.");
  const o = await db.gasOrder.findUnique({ where: { id }, include: { business: true } });
  if (!o) throw new NotFoundError("Order not found");
  if (["DELIVERED", "CANCELLED", "DECLINED"].includes(o.status)) throw new AppError("This order is already closed.");
  await db.gasOrder.update({ where: { id }, data: { status: "CANCELLED", sellerNote: `Cancelled by RefineryLens: ${why.slice(0, 250)}` } });
  await endTripFor({ kind: "GAS_ORDER", id });
  await createAlert({ userId: o.userId, kind: "GAS_ORDER", title: "Your gas order was cancelled", body: `RefineryLens cancelled it: ${why}`, link: `/orders/${id}`, dedupeKey: `order:admin-cancel:${id}` });
  await createAlert({ userId: o.business.ownerId, kind: "GAS_ORDER", title: "A gas order was cancelled by RefineryLens", body: `${o.cylinders} × ${o.cylinderKg} kg to ${o.area}: ${why}`, link: "/hub/orders", dedupeKey: `order:admin-cancel-seller:${id}` });
  await audit(actor.id, "admin.order.cancel", "GasOrder", id, { reason: why });
}

// ---------------------------------------------------------------------------------------------------------------
// Live trips

export async function listTrips(actor: Actor, f: { status?: string; stale?: string }, now = new Date()) {
  requireAdmin(actor);
  const where: Prisma.DriverTripWhereInput = {};
  if (f.status) where.status = f.status as TripStatus;
  else where.status = { not: "ENDED" };
  if (f.stale === "yes") Object.assign(where, { status: "LIVE", lastAt: { lt: new Date(now.getTime() - STALE_TRIP_MS) } });
  return db.driverTrip.findMany({
    where, orderBy: [{ lastAt: "desc" }, { createdAt: "desc" }], take: 200,
    include: { business: { select: { id: true, name: true } }, gasOrder: { select: { id: true, area: true, state: true, status: true } }, deliveryJob: { select: { id: true, title: true, status: true } }, _count: { select: { pings: true } } },
  });
}

/** Stops a trip that was left running; the driver's page stops sending on its next position. */
export async function adminEndTrip(actor: Actor, id: string) {
  requireAdmin(actor);
  await db.driverTrip.update({ where: { id }, data: { status: "ENDED", endedAt: new Date() } });
  await audit(actor.id, "admin.trip.end", "DriverTrip", id);
}
