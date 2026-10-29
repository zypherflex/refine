import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { audit } from "../audit";
import { requireAdmin } from "./guard";

export const SEGMENTS = [
  { id: "all", label: "Everyone" },
  { id: "households", label: "Households" },
  { id: "businesses", label: "Business accounts" },
  { id: "sellers", label: "Sellers" },
  { id: "buyers", label: "Buyers" },
  { id: "delivery", label: "Delivery partners" },
  { id: "refineries", label: "Refineries" },
  { id: "home_delivery", label: "Sellers delivering gas to homes" },
] as const;
export type SegmentId = (typeof SEGMENTS)[number]["id"];

/** Who a segment reaches. The state means a household's home state, or a business's state. */
export function segmentWhere(segment: SegmentId, state?: string | null): Prisma.UserWhereInput {
  const biz = (extra: Prisma.HubBusinessWhereInput): Prisma.UserWhereInput => ({ hubBusiness: { is: { verification: { not: "SUSPENDED" }, ...(state ? { state } : {}), ...extra } } });
  switch (segment) {
    case "households": return { audience: "PERSONAL", ...(state ? { homeState: state } : {}) };
    case "businesses": return state ? { OR: [{ audience: "BUSINESS", homeState: state }, biz({})] } : { audience: "BUSINESS" };
    case "sellers": return biz({ roles: { has: "SELLER" } });
    case "buyers": return biz({ roles: { has: "BUYER" } });
    case "delivery": return biz({ roles: { has: "DELIVERY" } });
    case "refineries": return biz({ roles: { has: "REFINERY" } });
    case "home_delivery": return biz({ homeDelivery: true });
    default: return state ? { OR: [{ homeState: state }, biz({})] } : {};
  }
}

export async function countRecipients(actor: Actor, segment: SegmentId, state?: string | null) {
  requireAdmin(actor);
  return db.user.count({ where: segmentWhere(segment, state) });
}

export const broadcastInput = z.object({
  segment: z.enum(SEGMENTS.map((s) => s.id) as [SegmentId, ...SegmentId[]]),
  state: z.string().refine((s) => (NIGERIAN_STATES as readonly string[]).includes(s), "Choose a state").nullable().default(null),
  title: z.string().trim().min(5, "Give a title of at least 5 characters").max(80),
  body: z.string().trim().min(10, "Write a message of at least 10 characters").max(400),
  // Only links inside RefineryLens, so a broadcast cannot send people to a look-alike site.
  link: z.string().trim().regex(/^\/[A-Za-z0-9/_?=&%.-]*$/, "Use a path inside RefineryLens, starting with /").default("/today"),
  confirmCount: z.number().int().min(1),
});

/**
 * Sends an alert to everyone in a segment. The admin confirms the recipient count they were shown, so a changed
 * filter cannot send to more people than expected. Delivered in the app and by push, never by SMS.
 */
export async function sendBroadcast(actor: Actor, raw: z.input<typeof broadcastInput>) {
  requireAdmin(actor);
  const input = broadcastInput.parse(raw);
  const recent = await db.broadcast.findFirst({ where: { title: input.title, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent) throw new AppError("A broadcast with this title went out in the last hour.");
  const users = await db.user.findMany({ where: segmentWhere(input.segment, input.state), select: { id: true } });
  if (!users.length) throw new AppError("Nobody is in that group.");
  if (users.length !== input.confirmCount) throw new AppError(`The group now has ${users.length} people, not ${input.confirmCount}. Check the count and send again.`);
  const b = await db.broadcast.create({ data: { title: input.title, body: input.body, link: input.link, segment: input.segment, state: input.state, recipients: users.length, sentById: actor.id } });
  for (let i = 0; i < users.length; i += 1000) {
    await db.alert.createMany({
      data: users.slice(i, i + 1000).map((u) => ({ userId: u.id, kind: "BROADCAST", title: input.title, body: input.body, link: input.link, dedupeKey: `broadcast:${b.id}` })),
      skipDuplicates: true,
    });
  }
  await audit(actor.id, "admin.broadcast", "Broadcast", b.id, { segment: input.segment, state: input.state, recipients: users.length });
  return b;
}

export async function recentBroadcasts(actor: Actor) {
  requireAdmin(actor);
  const rows = await db.broadcast.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  const read = await db.alert.groupBy({ by: ["dedupeKey"], where: { dedupeKey: { in: rows.map((r) => `broadcast:${r.id}`) }, readAt: { not: null } }, _count: true });
  return rows.map((r) => ({ ...r, read: read.find((x) => x.dedupeKey === `broadcast:${r.id}`)?._count ?? 0 }));
}
