import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { cylinderOutlook, HOME_CYLINDER_SIZES, REMIND_DAYS_BEFORE } from "@/lib/everyday";
import { createAlert } from "../services/alerts";

// Checked at call time, so a long-running server does not freeze "today".
const notFuture = z.date().refine((d) => d.getTime() <= Date.now() + 86_400_000, "The refill date cannot be in the future");

export const cylinderInput = z.object({
  label: z.string().trim().min(1).max(40).default("Kitchen"),
  sizeKg: z.number().refine((n) => (HOME_CYLINDER_SIZES as readonly number[]).includes(n), "Choose a cylinder size"),
  usualDays: z.number().int().min(3).max(180),
  lastFilledAt: notFuture.nullable().default(null),
});

export async function addCylinder(actor: Actor, raw: z.input<typeof cylinderInput>) {
  const input = cylinderInput.parse(raw);
  if ((await db.gasCylinder.count({ where: { userId: actor.id } })) >= 5) throw new AppError("You can track up to 5 cylinders.");
  return db.gasCylinder.create({
    data: { userId: actor.id, label: input.label, sizeKg: input.sizeKg, usualDays: input.usualDays, refills: input.lastFilledAt ? { create: { filledAt: input.lastFilledAt } } : undefined },
  });
}

async function mine(actor: Actor, id: string) {
  const c = await db.gasCylinder.findUnique({ where: { id } });
  if (!c || c.userId !== actor.id) throw new NotFoundError("Cylinder not found");
  return c;
}

export const refillInput = z.object({
  filledAt: notFuture,
  priceNaira: z.number().min(500).max(500_000).nullable().default(null),
});

/** Logs a refill. The reminder resets, so the next "running low" alert follows this fill. */
export async function logRefill(actor: Actor, cylinderId: string, raw: z.input<typeof refillInput>) {
  await mine(actor, cylinderId);
  const input = refillInput.parse(raw);
  await db.$transaction([
    db.cylinderRefill.create({ data: { cylinderId, ...input } }),
    db.gasCylinder.update({ where: { id: cylinderId }, data: { remindedAt: null } }),
  ]);
}

export async function setReminder(actor: Actor, cylinderId: string, remind: boolean) {
  await mine(actor, cylinderId);
  await db.gasCylinder.update({ where: { id: cylinderId }, data: { remind } });
}

export async function deleteCylinder(actor: Actor, cylinderId: string) {
  await mine(actor, cylinderId);
  await db.gasCylinder.delete({ where: { id: cylinderId } });
}

export async function myCylinders(actor: Actor, now = new Date()) {
  const rows = await db.gasCylinder.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "asc" }, include: { refills: { orderBy: { filledAt: "desc" }, take: 12 } } });
  return rows.map((c) => ({ ...c, outlook: cylinderOutlook(c.refills.map((r) => r.filledAt), c.usualDays, now) }));
}

/** Worker: alerts people whose gas is expected to run out within REMIND_DAYS_BEFORE days, once per refill. */
export async function sendRefillReminders(now = new Date()) {
  const rows = await db.gasCylinder.findMany({ where: { remind: true, remindedAt: null }, include: { refills: { orderBy: { filledAt: "desc" }, take: 6 } } });
  let sent = 0;
  for (const c of rows) {
    const o = cylinderOutlook(c.refills.map((r) => r.filledAt), c.usualDays, now);
    if (o.daysLeft === null || o.daysLeft > REMIND_DAYS_BEFORE) continue;
    const when = o.daysLeft <= 0 ? "may be empty now" : `may run out in about ${o.daysLeft} day${o.daysLeft === 1 ? "" : "s"}`;
    await createAlert({
      userId: c.userId, kind: "REFILL_DUE", title: `Your ${c.label.toLowerCase()} gas ${when}`,
      body: `Your ${c.sizeKg} kg cylinder was last filled ${Math.round((now.getTime() - o.lastFilled!.getTime()) / 86_400_000)} days ago. Order a refill or check today's gas prices.`,
      link: "/my-gas", dedupeKey: `refill:${c.id}:${o.lastFilled!.toISOString().slice(0, 10)}`,
    });
    await db.gasCylinder.update({ where: { id: c.id }, data: { remindedAt: now } });
    sent++;
  }
  return sent;
}
