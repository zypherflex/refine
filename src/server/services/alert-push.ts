import { z } from "zod";
import { db } from "@/lib/db";
import { getPushSender, type PushSender } from "../connect/push";

/**
 * Push notifications in the store apps for trade hub alerts (messages, quotes, deliveries, verification), to every
 * phone the user turned notifications on for. Research alerts stay in-app and email.
 */

const PUSHED_KINDS = ["HUB_MESSAGE", "HUB_JOB", "HUB_SUPPLY", "HUB_VERIFICATION"];
const MAX_DEVICES = 10;

export const deviceInput = z.object({ token: z.string().trim().min(20).max(4096), platform: z.enum(["android", "ios"]) });

/**
 * Saves a phone's push token for the signed-in user. A token moves to the new user if someone else signs in on the
 * same phone, so alerts never reach the previous account holder. Older devices beyond ten are dropped.
 */
export async function registerDevice(userId: string, raw: z.input<typeof deviceInput>) {
  const { token, platform } = deviceInput.parse(raw);
  const existing = await db.deviceToken.findUnique({ where: { token } });
  const fresh = !existing || existing.userId !== userId;
  await db.deviceToken.upsert({ where: { token }, update: { userId, platform, lastSeenAt: new Date() }, create: { userId, token, platform } });
  // Turning notifications on covers alerts from now on, not the backlog.
  if (fresh) await db.alert.updateMany({ where: { userId, pushedAt: null }, data: { pushedAt: new Date() } });
  const devices = await db.deviceToken.findMany({ where: { userId }, orderBy: { lastSeenAt: "desc" }, select: { id: true } });
  if (devices.length > MAX_DEVICES) await db.deviceToken.deleteMany({ where: { id: { in: devices.slice(MAX_DEVICES).map((d) => d.id) } } });
}

export async function unregisterDevice(userId: string, token: string) {
  await db.deviceToken.deleteMany({ where: { userId, token } });
}

export async function sendDueAlertPushes(now = new Date(), sender: PushSender | null = getPushSender()) {
  if (!sender) return { sent: 0, removed: 0 };
  const due = await db.alert.findMany({
    where: { pushedAt: null, visibleAt: { lte: now }, kind: { in: PUSHED_KINDS }, user: { devices: { some: {} } } },
    include: { user: { select: { devices: { select: { id: true, token: true, platform: true } } } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  let sent = 0;
  let removed = 0;
  for (const a of due) {
    let delivered = false;
    let failed = false;
    for (const d of a.user.devices) {
      try {
        const r = await sender.send(d.platform, d.token, { title: a.title, body: a.body.slice(0, 180), link: a.link });
        if (r === "gone") {
          await db.deviceToken.delete({ where: { id: d.id } }).catch(() => undefined);
          removed++;
        } else delivered = true;
      } catch (e) {
        console.error("push failed", a.id, d.platform, e);
        failed = true;
      }
    }
    // Retry next round only if a phone failed and none received it.
    if (failed && !delivered) continue;
    await db.alert.update({ where: { id: a.id }, data: { pushedAt: new Date() } });
    if (delivered) sent++;
  }
  return { sent, removed };
}
