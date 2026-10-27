import { z } from "zod";
import { db } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { STATES } from "@/lib/hub/catalog";
import { activePlan, PLAN_LIMITS, SITE_EXPIRED_DAYS, SITE_STALE_DAYS } from "@/lib/hub/rules";
import { audit } from "../audit";
import { requireBusiness, stateField } from "./business";

const DAY = 86_400_000;

export const siteInput = z.object({
  kind: z.enum(["SUPPLY", "DELIVERY", "DEMAND"]),
  gas: z.enum(["LPG", "CNG", "PNG"]),
  name: z.string().trim().min(2, "Name the site").max(120),
  state: stateField,
  town: z.string().trim().max(80).default(""),
  capacityNote: z.string().trim().max(160).default(""),
});

export async function addSite(actor: Actor, raw: z.input<typeof siteInput>) {
  const input = siteInput.parse(raw);
  const b = await requireBusiness(actor);
  if (input.kind === "DELIVERY" && !b.roles.includes("HAULIER") && !b.roles.includes("SELLER")) throw new AppError("Delivery coverage is for hauliers and sellers. Add one of those roles to your profile first.");
  const max = PLAN_LIMITS[activePlan(b)].sites;
  if ((await db.gasSite.count({ where: { businessId: b.id } })) >= max) throw new AppError(`You can list up to ${max} sites.`);
  const s = await db.gasSite.create({ data: { ...input, businessId: b.id } });
  await audit(actor.id, "hub.site.create", "GasSite", s.id);
  return s;
}

/** Owners reconfirm sites; unconfirmed sites are flagged, then drop off the map. */
export async function confirmSite(actor: Actor, id: string) {
  const b = await requireBusiness(actor);
  const { count } = await db.gasSite.updateMany({ where: { id, businessId: b.id }, data: { lastConfirmedAt: new Date() } });
  if (!count) throw new NotFoundError("Site not found");
}

export async function removeSite(actor: Actor, id: string) {
  const b = await requireBusiness(actor);
  const { count } = await db.gasSite.deleteMany({ where: { id, businessId: b.id } });
  if (!count) throw new NotFoundError("Site not found");
}

export async function mySites(actor: Actor) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) return [];
  return db.gasSite.findMany({ where: { businessId: b.id }, orderBy: { createdAt: "desc" } });
}

export type StateStatus = "SERVED" | "GAP" | "DELIVERY_ONLY" | "NO_DATA";
export type StateCell = { state: string; supply: number; delivery: number; demand: number; stale: number; status: StateStatus };

export function stateStatus(c: { supply: number; delivery: number; demand: number }): StateStatus {
  if (c.supply > 0) return "SERVED";
  if (c.demand > 0) return "GAP";
  if (c.delivery > 0) return "DELIVERY_ONLY";
  return "NO_DATA";
}

/** Supply, delivery and demand by state for one gas. Sites not confirmed within SITE_EXPIRED_DAYS are left out. */
export async function gasNetwork(gas: string, now = new Date()) {
  const sites = await db.gasSite.findMany({
    where: { gas, lastConfirmedAt: { gte: new Date(now.getTime() - SITE_EXPIRED_DAYS * DAY) }, business: { verification: { not: "SUSPENDED" } } },
    include: { business: { select: { id: true, name: true, verification: true, isSample: true } } },
    orderBy: { lastConfirmedAt: "desc" },
  });
  const staleBefore = now.getTime() - SITE_STALE_DAYS * DAY;
  const cells: StateCell[] = STATES.map((s) => {
    const here = sites.filter((x) => x.state === s.id);
    const c = { supply: here.filter((x) => x.kind === "SUPPLY").length, delivery: here.filter((x) => x.kind === "DELIVERY").length, demand: here.filter((x) => x.kind === "DEMAND").length };
    return { state: s.id, ...c, stale: here.filter((x) => x.lastConfirmedAt.getTime() < staleBefore).length, status: stateStatus(c) };
  });
  return { sites: sites.map((s) => ({ ...s, stale: s.lastConfirmedAt.getTime() < staleBefore })), cells };
}
