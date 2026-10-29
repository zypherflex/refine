import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { requireAdmin } from "./guard";

/** A gas order waiting this long for the seller to accept, or this long in progress, needs a look. */
export const STUCK_PLACED_MS = 2 * 3_600_000;
export const STUCK_OPEN_MS = 24 * 3_600_000;
/** A live trip with no position for this long is probably abandoned. */
export const STALE_TRIP_MS = 30 * 60_000;

export const stuckOrderWhere = (now = new Date()) => ({
  OR: [
    { status: "PLACED" as const, createdAt: { lt: new Date(now.getTime() - STUCK_PLACED_MS) } },
    { status: { in: ["ACCEPTED" as const, "OUT_FOR_DELIVERY" as const] }, updatedAt: { lt: new Date(now.getTime() - STUCK_OPEN_MS) } },
  ],
});

/** Counts behind the admin navigation badges and the overview's "needs attention" list. */
export async function attentionCounts(actor: Actor, now = new Date()) {
  requireAdmin(actor);
  const [verifications, hubReports, flagRows, stuckOrders, staleTrips, failedJobs, failedPayments] = await Promise.all([
    db.hubBusiness.count({ where: { verification: "PENDING_REVIEW" } }),
    db.hubReport.count({ where: { status: "OPEN" } }),
    db.contentFlag.findMany({ where: { status: "OPEN" }, select: { reportId: true, outletId: true }, distinct: ["reportId", "outletId"] }),
    db.gasOrder.count({ where: stuckOrderWhere(now) }),
    db.driverTrip.count({ where: { status: "LIVE", lastAt: { lt: new Date(now.getTime() - STALE_TRIP_MS) } } }),
    db.job.count({ where: { status: "FAILED" } }),
    db.payment.count({ where: { status: "FAILED", createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } }),
  ]);
  return { verifications, hubReports, flags: flagRows.length, stuckOrders, staleTrips, failedJobs, failedPayments };
}
export type Attention = Awaited<ReturnType<typeof attentionCounts>>;
