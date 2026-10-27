import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { startOfDay } from "@/lib/hub/rules";
import { audit } from "../audit";
import { requireBusiness } from "./business";

/**
 * LPG cylinder tracking for the recirculation model. The owner (usually a marketer) registers cylinders; whoever holds
 * a cylinder records fills and hands it on; the owner records retests and condemns unsafe cylinders. Anyone can check a
 * serial number. A cylinder past its retest date, or condemned, cannot be recorded as filled.
 */
export const RETEST_YEARS = 5;
export const SIZES_KG = [3, 5, 6, 12.5, 25, 50] as const;
export const MAX_BATCH = 500;

export const normaliseSerial = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
const retestDue = (tested: Date) => { const d = startOfDay(tested); return new Date(Date.UTC(d.getUTCFullYear() + RETEST_YEARS, d.getUTCMonth(), d.getUTCDate())); };

export const registerInput = z.object({
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,12}$/, "Use 2 to 12 letters, numbers or dashes for the prefix"),
  from: z.coerce.number().int().min(0).max(9_999_999),
  count: z.coerce.number().int().min(1).max(MAX_BATCH, `Register up to ${MAX_BATCH} at a time`),
  sizeKg: z.coerce.number().refine((n) => (SIZES_KG as readonly number[]).includes(n), "Choose a cylinder size"),
  lastTestOn: z.coerce.date(),
});

/** Registers a numbered batch, e.g. prefix IKG, from 1, count 50 → IKG-000001 … IKG-000050. */
export async function registerCylinders(actor: Actor, raw: z.input<typeof registerInput>, now = new Date()) {
  const input = registerInput.parse(raw);
  const b = await requireBusiness(actor);
  if (!b.roles.includes("SELLER") && !b.roles.includes("REFINERY")) throw new AppError("Only sellers (marketers and refill plants) can register cylinders.");
  if (startOfDay(input.lastTestOn) > startOfDay(now)) throw new AppError("The last test date cannot be in the future.");
  const serials = Array.from({ length: input.count }, (_, i) => `${input.prefix}-${String(input.from + i).padStart(6, "0")}`);
  const taken = await db.cylinder.findMany({ where: { serial: { in: serials } }, select: { serial: true }, take: 3 });
  if (taken.length) throw new AppError(`Already registered: ${taken.map((t) => t.serial).join(", ")}. Choose another range.`);
  const tested = startOfDay(input.lastTestOn);
  await db.$transaction(async (tx) => {
    await tx.cylinder.createMany({ data: serials.map((serial) => ({ serial, ownerId: b.id, holderId: b.id, sizeKg: input.sizeKg, lastTestOn: tested, nextTestDue: retestDue(tested) })) });
    const rows = await tx.cylinder.findMany({ where: { serial: { in: serials } }, select: { id: true } });
    await tx.cylinderEvent.createMany({ data: rows.map((r) => ({ cylinderId: r.id, kind: "REGISTERED", byId: b.id, at: now })) });
  });
  await audit(actor.id, "hub.cylinder.register", "HubBusiness", b.id, { first: serials[0], count: serials.length });
  return { first: serials[0]!, last: serials.at(-1)!, count: serials.length };
}

export const ACTIONS = ["FILL", "DISPATCH", "RETURN", "TEST", "CONDEMN"] as const;
export const actionInput = z.object({
  serials: z.string().min(1, "Enter at least one serial number"),
  action: z.enum(ACTIONS),
  toBusinessId: z.string().optional().default(""),
  testedOn: z.coerce.date().optional(),
  note: z.string().trim().max(300).default(""),
});

/**
 * Applies one action to a list of serials (comma, space or line separated). All or nothing: if any serial cannot take
 * the action, nothing changes and the message names it.
 */
export async function recordCylinders(actor: Actor, raw: z.input<typeof actionInput>, now = new Date()) {
  const input = actionInput.parse(raw);
  const b = await requireBusiness(actor);
  const serials = [...new Set(input.serials.split(/[\s,;]+/).map(normaliseSerial).filter(Boolean))];
  if (!serials.length) throw new AppError("Enter at least one serial number.");
  if (serials.length > MAX_BATCH) throw new AppError(`Record up to ${MAX_BATCH} at a time.`);
  const cyls = await db.cylinder.findMany({ where: { serial: { in: serials } } });
  const missing = serials.filter((s) => !cyls.some((c) => c.serial === s));
  if (missing.length) throw new AppError(`Not registered: ${missing.slice(0, 5).join(", ")}.`);
  const today = startOfDay(now);

  let to: { id: string } | null = null;
  if (input.action === "DISPATCH") {
    to = await db.hubBusiness.findFirst({ where: { id: input.toBusinessId, verification: { not: "SUSPENDED" } }, select: { id: true } });
    if (!to) throw new AppError("Choose who you are handing the cylinders to.");
    if (to.id === b.id) throw new AppError("Choose another business.");
  }
  const problem = (c: (typeof cyls)[number]): string | null => {
    const isOwner = c.ownerId === b.id;
    const holds = c.holderId === b.id;
    if (c.status === "CONDEMNED" && input.action !== "TEST") return "is condemned";
    switch (input.action) {
      case "FILL":
        if (!holds) return "is not with you";
        if (!b.roles.includes("SELLER") && !b.roles.includes("REFINERY")) return "can only be filled by a seller";
        if (c.nextTestDue <= today) return "is past its retest date and must not be filled";
        return null;
      case "DISPATCH":
        return holds ? null : "is not with you";
      case "RETURN":
        if (!holds) return "is not with you";
        return isOwner ? "is already with its owner" : null;
      case "TEST":
      case "CONDEMN":
        if (!isOwner) return "is not yours";
        return holds ? null : "must be back with you first";
    }
  };
  const bad = cyls.map((c) => [c.serial, problem(c)] as const).filter(([, p]) => p);
  if (bad.length) throw new AppError(bad.slice(0, 5).map(([s, p]) => `${s} ${p}`).join("; ") + (bad.length > 5 ? ` (and ${bad.length - 5} more)` : "") + ".");

  let tested: Date | null = null;
  if (input.action === "TEST") {
    if (!input.testedOn) throw new AppError("Enter the test date.");
    tested = startOfDay(input.testedOn);
    if (tested > today) throw new AppError("The test date cannot be in the future.");
  }
  const ids = cyls.map((c) => c.id);
  await db.$transaction(async (tx) => {
    if (input.action === "FILL") await tx.cylinder.updateMany({ where: { id: { in: ids } }, data: { lastFilledAt: now } });
    if (input.action === "DISPATCH") await tx.cylinder.updateMany({ where: { id: { in: ids } }, data: { holderId: to!.id } });
    if (input.action === "RETURN") for (const c of cyls) await tx.cylinder.update({ where: { id: c.id }, data: { holderId: c.ownerId } });
    if (input.action === "TEST") await tx.cylinder.updateMany({ where: { id: { in: ids } }, data: { lastTestOn: tested!, nextTestDue: retestDue(tested!) } });
    if (input.action === "CONDEMN") await tx.cylinder.updateMany({ where: { id: { in: ids } }, data: { status: "CONDEMNED" } });
    const kind = { FILL: "FILLED", DISPATCH: "DISPATCHED", RETURN: "RETURNED", TEST: "TESTED", CONDEMN: "CONDEMNED" }[input.action];
    await tx.cylinderEvent.createMany({ data: cyls.map((c) => ({ cylinderId: c.id, kind, byId: b.id, toId: input.action === "DISPATCH" ? to!.id : input.action === "RETURN" ? c.ownerId : null, note: input.note, at: now })) });
  });
  await audit(actor.id, `hub.cylinder.${input.action.toLowerCase()}`, "HubBusiness", b.id, { count: ids.length });
  return { count: ids.length };
}

export async function cylinderOverview(actor: Actor, now = new Date()) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) return null;
  const today = startOfDay(now);
  const soon = new Date(today.getTime() + 90 * 86_400_000);
  const [owned, held, dueSoon, overdue, condemned, byHolder, recent] = await Promise.all([
    db.cylinder.count({ where: { ownerId: b.id, status: "ACTIVE" } }),
    db.cylinder.findMany({ where: { holderId: b.id, status: "ACTIVE" }, include: { owner: { select: { name: true, verification: true, isSample: true, id: true } } }, orderBy: { serial: "asc" }, take: 200 }),
    db.cylinder.count({ where: { ownerId: b.id, status: "ACTIVE", nextTestDue: { gt: today, lte: soon } } }),
    db.cylinder.count({ where: { ownerId: b.id, status: "ACTIVE", nextTestDue: { lte: today } } }),
    db.cylinder.count({ where: { ownerId: b.id, status: "CONDEMNED" } }),
    db.cylinder.groupBy({ by: ["holderId"], where: { ownerId: b.id, status: "ACTIVE" }, _count: { _all: true } }),
    db.cylinderEvent.findMany({ where: { OR: [{ byId: b.id }, { toId: b.id }] }, include: { cylinder: { select: { serial: true } }, by: { select: { name: true } } }, orderBy: { at: "desc" }, take: 30 }),
  ]);
  const holders = await db.hubBusiness.findMany({ where: { id: { in: byHolder.map((h) => h.holderId) } }, select: { id: true, name: true } });
  return {
    business: b, owned, held, dueSoon, overdue, condemned, recent,
    byHolder: byHolder.map((h) => ({ name: holders.find((x) => x.id === h.holderId)?.name ?? "", self: h.holderId === b.id, count: h._count._all })).sort((a, c) => c.count - a.count),
  };
}

/** Public safety check. Shows only what a buyer needs: size, owner, retest date, status and last fill. */
export async function checkCylinder(rawSerial: string, now = new Date()) {
  const serial = normaliseSerial(rawSerial);
  if (!serial) return null;
  const c = await db.cylinder.findUnique({ where: { serial }, include: { owner: { select: { name: true, verification: true, isSample: true } } } });
  if (!c) return null;
  const today = startOfDay(now);
  return {
    serial: c.serial, sizeKg: c.sizeKg, status: c.status, lastTestOn: c.lastTestOn, nextTestDue: c.nextTestDue, lastFilledAt: c.lastFilledAt,
    overdue: c.nextTestDue <= today,
    owner: { name: c.owner.name, verification: c.owner.verification, isSample: c.owner.isSample },
  };
}
