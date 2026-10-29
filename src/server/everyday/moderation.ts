import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { AUTO_HIDE_FLAGS, OUTLET_FLAG_REASONS, REPORT_FLAG_REASONS } from "@/lib/everyday";
import { audit } from "../audit";

export const flagInput = z.discriminatedUnion("target", [
  z.object({ target: z.literal("REPORT"), id: z.string().min(1), reason: z.enum(REPORT_FLAG_REASONS.map((r) => r.id) as [string, ...string[]]), note: z.string().trim().max(300).default("") }),
  z.object({ target: z.literal("OUTLET"), id: z.string().min(1), reason: z.enum(OUTLET_FLAG_REASONS.map((r) => r.id) as [string, ...string[]]), note: z.string().trim().max(300).default("") }),
]);

/**
 * A signed-in person flags a station report or a place. Once AUTO_HIDE_FLAGS different people have flagged a report
 * it is hidden until an administrator reviews it; places are hidden only by an administrator.
 */
export async function flagContent(actor: Actor, raw: z.input<typeof flagInput>) {
  const input = flagInput.parse(raw);
  if ((await db.contentFlag.count({ where: { userId: actor.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } })) >= 20) {
    throw new AppError("You have flagged 20 items today. Try again tomorrow.");
  }
  const where = input.target === "REPORT" ? { reportId: input.id } : { outletId: input.id };
  if (input.target === "REPORT") {
    const r = await db.outletReport.findUnique({ where: { id: input.id } });
    if (!r || r.hidden) throw new NotFoundError("Report not found");
    if (r.userId === actor.id) throw new AppError("This is your own report.");
  } else {
    const o = await db.outlet.findUnique({ where: { id: input.id } });
    if (!o || o.hidden) throw new NotFoundError("Place not found");
  }
  if (await db.contentFlag.findFirst({ where: { ...where, userId: actor.id, status: "OPEN" } })) throw new AppError("You have already flagged this. An administrator will review it.");
  await db.contentFlag.create({ data: { ...where, userId: actor.id, reason: input.reason, note: input.note } });
  if (input.target === "REPORT") {
    const flaggers = await db.contentFlag.findMany({ where: { reportId: input.id, status: "OPEN" }, select: { userId: true }, distinct: ["userId"] });
    if (flaggers.length >= AUTO_HIDE_FLAGS) await db.outletReport.update({ where: { id: input.id }, data: { hidden: true } });
  }
  await audit(actor.id, "content.flag", input.target === "REPORT" ? "OutletReport" : "Outlet", input.id, { reason: input.reason });
}

function requireModerator(actor: Actor) {
  if (!can.moderateHub(actor)) throw new ForbiddenError();
}

/** The review queue: everything with open flags, newest first, with who reported it so abusive accounts can be stopped. */
export async function flagQueue(actor: Actor) {
  requireModerator(actor);
  const flags = await db.contentFlag.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      user: { select: { name: true, email: true } },
      outlet: { select: { id: true, name: true, area: true, state: true, hidden: true, addedBy: { select: { id: true, name: true, email: true, reportingBlocked: true } } } },
      report: { include: { outlet: { select: { id: true, name: true, area: true, state: true } }, user: { select: { id: true, name: true, email: true, reportingBlocked: true } } } },
    },
  });
  const groups = new Map<string, { key: string; target: "REPORT" | "OUTLET"; id: string; flags: typeof flags }>();
  for (const f of flags) {
    const target = f.reportId ? "REPORT" : "OUTLET";
    const id = (f.reportId ?? f.outletId)!;
    const key = `${target}:${id}`;
    if (!groups.has(key)) groups.set(key, { key, target, id, flags: [] });
    groups.get(key)!.flags.push(f);
  }
  return [...groups.values()];
}

export type Resolution = "HIDE" | "RESTORE" | "DISMISS";

/**
 * Hide: the content stays hidden and the flags are closed as actioned. Restore: content an automatic hide took down
 * comes back. Dismiss: the flags were wrong; the content stays (or becomes) visible.
 */
export async function resolveFlags(actor: Actor, target: "REPORT" | "OUTLET", id: string, resolution: Resolution) {
  requireModerator(actor);
  const where = target === "REPORT" ? { reportId: id } : { outletId: id };
  const hidden = resolution === "HIDE";
  await db.$transaction([
    target === "REPORT" ? db.outletReport.update({ where: { id }, data: { hidden } }) : db.outlet.update({ where: { id }, data: { hidden } }),
    db.contentFlag.updateMany({ where: { ...where, status: "OPEN" }, data: { status: hidden ? "ACTIONED" : "DISMISSED", resolvedAt: new Date(), resolvedById: actor.id } }),
  ]);
  await audit(actor.id, `content.${resolution.toLowerCase()}`, target === "REPORT" ? "OutletReport" : "Outlet", id);
}

/** Stops (or allows again) a person adding places and reporting at stations. Their past reports are not changed. */
export async function setReportingBlocked(actor: Actor, userId: string, blocked: boolean) {
  requireModerator(actor);
  if (userId === actor.id) throw new AppError("You cannot block yourself.");
  await db.user.update({ where: { id: userId }, data: { reportingBlocked: blocked } });
  await audit(actor.id, blocked ? "user.reporting_block" : "user.reporting_unblock", "User", userId);
}

/** Recently blocked reporters, so a block can be lifted. */
export async function blockedReporters(actor: Actor) {
  requireModerator(actor);
  return db.user.findMany({ where: { reportingBlocked: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" }, take: 100 });
}

export async function openFlagCount() {
  const rows = await db.contentFlag.findMany({ where: { status: "OPEN" }, select: { reportId: true, outletId: true }, distinct: ["reportId", "outletId"] });
  return rows.length;
}
