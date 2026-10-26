import { z } from "zod";
import type { HubThread, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { createAlert } from "../services/alerts";
import { canSeeBusiness, requireMyBusiness } from "./business";

/**
 * Enquiries and replies are private to the two sides: the user who made the enquiry and the owner of the business it
 * went to. Administrators cannot read them; reports about a business go through HubReport instead.
 */

const body = z.string().trim().min(1, "Write a message").max(4000);
const NEW_THREADS_PER_HOUR = 20;
const MESSAGES_PER_10_MIN = 60;

export const enquiryInput = z.object({ businessId: z.string().min(1), listingId: z.string().min(1).nullable().default(null), body });

type ThreadWithBusiness = HubThread & { business: { id: string; name: string; ownerId: string } };

function side(actor: Actor, t: ThreadWithBusiness): "starter" | "owner" | null {
  if (t.starterId === actor.id) return "starter";
  if (t.business.ownerId === actor.id) return "owner";
  return null;
}

/** The other side had read everything before this message, so it starts a new unread spell worth one alert. */
const caughtUp = (readAt: Date | null, lastMessageAt: Date) => !!readAt && readAt >= lastMessageAt;

export function isUnread(actor: Actor, t: ThreadWithBusiness) {
  const s = side(actor, t);
  const readAt = s === "starter" ? t.starterReadAt : s === "owner" ? t.ownerReadAt : null;
  return !readAt || t.lastMessageAt > readAt;
}

async function checkSendRate(actor: Actor) {
  const since = new Date(Date.now() - 10 * 60_000);
  const recent = await db.hubMessage.count({ where: { senderId: actor.id, createdAt: { gt: since } } });
  if (recent >= MESSAGES_PER_10_MIN) throw new AppError("You are sending messages too quickly. Wait a few minutes and try again.", 429);
}

async function notify(tx: Prisma.TransactionClient, recipientId: string, fromName: string, t: { id: string; subject: string }, messageId: string) {
  await createAlert(
    {
      userId: recipientId,
      kind: "HUB_MESSAGE",
      title: `${fromName} sent you a message`,
      // The message itself stays in the inbox, so email copies of alerts never carry trade details.
      body: `About: ${t.subject}. Open your trade hub inbox to read and reply.`,
      link: `/hub/inbox/${t.id}`,
      dedupeKey: `hub:${messageId}`,
    },
    tx,
  );
}

/** Sends an enquiry to a business, about one of its listings or in general. Reuses the open conversation if there is one. */
export async function sendEnquiry(actor: Actor, raw: z.input<typeof enquiryInput>) {
  const input = enquiryInput.parse(raw);
  const mine = await requireMyBusiness(actor);
  if (mine.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended and cannot send messages.");
  const target = await db.hubBusiness.findUnique({ where: { id: input.businessId } });
  if (!target || !canSeeBusiness(actor, target)) throw new NotFoundError("Business not found");
  if (target.ownerId === actor.id) throw new AppError("This is your own business.");
  let subject = `Enquiry from ${mine.name}`;
  if (input.listingId) {
    const l = await db.hubListing.findUnique({ where: { id: input.listingId } });
    if (!l || l.businessId !== target.id || l.status !== "ACTIVE" || l.expiresAt <= new Date()) throw new NotFoundError("This listing has closed or expired.");
    subject = l.title;
  }
  await checkSendRate(actor);
  const existing = await db.hubThread.findFirst({ where: { starterId: actor.id, businessId: target.id, listingId: input.listingId } });
  if (!existing) {
    const recent = await db.hubThread.count({ where: { starterId: actor.id, createdAt: { gt: new Date(Date.now() - 3_600_000) } } });
    if (recent >= NEW_THREADS_PER_HOUR) throw new AppError("You have started many conversations in the last hour. Try again later.", 429);
  }
  return db.$transaction(async (tx) => {
    const now = new Date();
    const thread = existing
      ? await tx.hubThread.update({ where: { id: existing.id }, data: { lastMessageAt: now, starterReadAt: now } })
      : await tx.hubThread.create({ data: { starterId: actor.id, businessId: target.id, listingId: input.listingId, subject, lastMessageAt: now, starterReadAt: now } });
    const m = await tx.hubMessage.create({ data: { threadId: thread.id, senderId: actor.id, body: input.body, createdAt: now } });
    // Alert only when the other side had caught up, so a burst of messages makes one alert, not many.
    if (!existing || caughtUp(existing.ownerReadAt, existing.lastMessageAt)) await notify(tx, target.ownerId, mine.name, thread, m.id);
    return thread;
  });
}

async function participantThread(actor: Actor, id: string) {
  const t = await db.hubThread.findUnique({ where: { id }, include: { business: { select: { id: true, name: true, ownerId: true, verification: true } } } });
  if (!t || !side(actor, t)) throw new NotFoundError("Conversation not found");
  return t;
}

export async function reply(actor: Actor, threadId: string, text: string) {
  const t = await participantThread(actor, threadId);
  const s = side(actor, t)!;
  const sender = await requireMyBusiness(actor);
  if (sender.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended and cannot send messages.");
  if (s === "starter" && t.business.verification === "SUSPENDED") throw new AppError("This business has been suspended, so it can no longer receive messages.");
  const msg = body.parse(text);
  await checkSendRate(actor);
  const recipientId = s === "starter" ? t.business.ownerId : t.starterId;
  const theirRead = s === "starter" ? t.ownerReadAt : t.starterReadAt;
  return db.$transaction(async (tx) => {
    const now = new Date();
    const m = await tx.hubMessage.create({ data: { threadId, senderId: actor.id, body: msg, createdAt: now } });
    await tx.hubThread.update({ where: { id: threadId }, data: { lastMessageAt: now, ...(s === "starter" ? { starterReadAt: now } : { ownerReadAt: now }) } });
    if (caughtUp(theirRead, t.lastMessageAt)) await notify(tx, recipientId, sender.name, t, m.id);
    return m;
  });
}

/** Opens a conversation for one of its two participants and marks it read for them. */
export async function openThread(actor: Actor, id: string) {
  const t = await participantThread(actor, id);
  const s = side(actor, t)!;
  await db.hubThread.update({ where: { id }, data: s === "starter" ? { starterReadAt: new Date() } : { ownerReadAt: new Date() } });
  const [messages, starterBusiness, listing] = await Promise.all([
    db.hubMessage.findMany({ where: { threadId: id }, orderBy: { createdAt: "asc" } }),
    db.hubBusiness.findUnique({ where: { ownerId: t.starterId }, select: { id: true, name: true, verification: true, isDemo: true } }),
    t.listingId ? db.hubListing.findUnique({ where: { id: t.listingId }, select: { id: true, title: true, kind: true, status: true, expiresAt: true } }) : null,
  ]);
  return { thread: t, side: s, messages, starterBusiness, listing };
}

export async function listThreads(actor: Actor) {
  const threads = await db.hubThread.findMany({
    where: { OR: [{ starterId: actor.id }, { business: { ownerId: actor.id } }] },
    include: { business: { select: { id: true, name: true, ownerId: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
  });
  const starters = await db.hubBusiness.findMany({ where: { ownerId: { in: [...new Set(threads.map((t) => t.starterId))] } }, select: { ownerId: true, name: true } });
  const starterName = new Map(starters.map((b) => [b.ownerId, b.name]));
  return threads.map((t) => {
    const s = side(actor, t)!;
    return { ...t, side: s, unread: isUnread(actor, t), counterpart: s === "starter" ? t.business.name : (starterName.get(t.starterId) ?? "A RefineryLens user") };
  });
}

export async function unreadThreadCount(actor: Actor) {
  const rows = await db.hubThread.findMany({
    where: { OR: [{ starterId: actor.id }, { business: { ownerId: actor.id } }] },
    select: { id: true, starterId: true, starterReadAt: true, ownerReadAt: true, lastMessageAt: true, business: { select: { ownerId: true } } },
  });
  return rows.filter((t) => (t.starterId === actor.id ? t.lastMessageAt > t.starterReadAt : !t.ownerReadAt || t.lastMessageAt > t.ownerReadAt)).length;
}
