import type { Prisma, AlertFrequency } from "@prisma/client";
import { db } from "@/lib/db";

/** Next digest time for daily (07:00 UTC next day) and weekly (Monday 07:00 UTC) subscribers. */
export function digestTime(freq: AlertFrequency, now = new Date()): Date {
  if (freq === "IMMEDIATE") return now;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 0, 0));
  if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
  if (freq === "WEEKLY") while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export type AlertInput = { userId: string; kind: string; title: string; body: string; link: string; dedupeKey: string; visibleAt?: Date };

/**
 * Creates an in-app alert unless an identical one already exists (same user and dedupe key).
 * Email or push delivery is not claimed: only the in-app channel is configured in release 1.
 */
export async function createAlert(a: AlertInput, tx: Prisma.TransactionClient = db) {
  await tx.alert.upsert({
    where: { userId_dedupeKey: { userId: a.userId, dedupeKey: a.dedupeKey } },
    update: {},
    create: { ...a, visibleAt: a.visibleAt ?? new Date(), channel: "IN_APP" },
  });
}

type AnnouncementLike = { id: string; companyId: string; headline: string; summary: string; topics: string[]; revision: number };

export async function listAlerts(userId: string) {
  const now = new Date();
  const [visible, queued] = await Promise.all([
    db.alert.findMany({ where: { userId, visibleAt: { lte: now } }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.alert.count({ where: { userId, visibleAt: { gt: now } } }),
  ]);
  return { visible, queued };
}

export async function unreadCount(userId: string) {
  return db.alert.count({ where: { userId, readAt: null, visibleAt: { lte: new Date() } } });
}

export async function markRead(userId: string, alertId?: string) {
  await db.alert.updateMany({ where: { userId, ...(alertId ? { id: alertId } : {}), readAt: null }, data: { readAt: new Date() } });
}
