import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { requireAdmin } from "./guard";

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Key numbers for the overview, each compared with the period before where that means something. */
export async function overviewStats(actor: Actor, now = new Date()) {
  requireAdmin(actor);
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d14 = new Date(now.getTime() - 14 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);
  const [users, households, new7, newPrev7, businesses, verified, orders7, delivered7, liveTrips, reports24, reports7, outlets, paid30, revenue30, activePlans, listings] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { audience: "PERSONAL" } }),
    db.user.count({ where: { createdAt: { gte: d7 } } }),
    db.user.count({ where: { createdAt: { gte: d14, lt: d7 } } }),
    db.hubBusiness.count(),
    db.hubBusiness.count({ where: { verification: "VERIFIED" } }),
    db.gasOrder.count({ where: { createdAt: { gte: d7 } } }),
    db.gasOrder.count({ where: { createdAt: { gte: d7 }, status: "DELIVERED" } }),
    db.driverTrip.count({ where: { status: "LIVE" } }),
    db.outletReport.count({ where: { createdAt: { gte: new Date(now.getTime() - DAY) } } }),
    db.outletReport.count({ where: { createdAt: { gte: d7 } } }),
    db.outlet.count({ where: { hidden: false } }),
    db.payment.count({ where: { status: "SUCCESS", paidAt: { gte: d30 } } }),
    db.payment.aggregate({ where: { status: "SUCCESS", paidAt: { gte: d30 } }, _sum: { amountKobo: true } }),
    db.hubBusiness.count({ where: { planUntil: { gt: now } } }),
    db.hubListing.count({ where: { status: "ACTIVE", expiresAt: { gt: now } } }),
  ]);
  return {
    users, households, businessesUsers: users - households, new7, newPrev7, businesses, verified, orders7, delivered7, liveTrips, reports24, reports7, outlets,
    paid30, revenue30Naira: (revenue30._sum.amountKobo ?? 0) / 100, activePlans, listings,
  };
}

/** New accounts, gas orders and station reports per day for the last `days` days (UTC days). */
export async function dailySeries(actor: Actor, days = 14, now = new Date()) {
  requireAdmin(actor);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - (days - 1) * DAY);
  const [u, o, r] = await Promise.all([
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.gasOrder.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.outletReport.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
  ]);
  const series = (rows: { createdAt: Date }[]) => {
    const counts = new Map<string, number>();
    for (const x of rows) counts.set(dayKey(x.createdAt), (counts.get(dayKey(x.createdAt)) ?? 0) + 1);
    return Array.from({ length: days }, (_, i) => {
      const day = dayKey(new Date(since.getTime() + i * DAY));
      return { day: day.slice(5), n: counts.get(day) ?? 0 };
    });
  };
  return { signups: series(u), orders: series(o), reports: series(r) };
}

/** Where people are: accounts by home state, for households who chose one. */
export async function usersByState(actor: Actor) {
  requireAdmin(actor);
  const rows = await db.user.groupBy({ by: ["homeState"], where: { homeState: { not: null } }, _count: true, orderBy: { _count: { homeState: "desc" } }, take: 8 });
  return rows.map((r) => ({ state: r.homeState!, n: r._count }));
}
