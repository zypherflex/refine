import { z } from "zod";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { audit } from "./audit";
import { requireAdmin } from "./admin/guard";

export const PLACEMENTS = [
  { id: "cng-savings", label: "CNG savings calculator", fits: "CNG conversion centres and kit makers" },
  { id: "stations", label: "Stations and gas shops", fits: "Fuel brands, lubricants, safety and fire equipment" },
  { id: "today", label: "Today's prices", fits: "Cylinder makers, LPG brands, clean-cooking programmes" },
  { id: "gas-network", label: "Gas network (business)", fits: "Skid plants, storage tanks, bullet trucks, cylinder requalification" },
  { id: "hub", label: "Trade hub (business)", fits: "Equipment, insurance, trade finance and logistics services" },
] as const;
export type PlacementId = (typeof PLACEMENTS)[number]["id"];

/**
 * The sponsorship to show in a placement now: active, within its dates, aimed at this state or every state. The one
 * shown least so far is chosen, so sponsors sharing a placement get similar exposure. Never more than one at a time.
 */
export async function sponsorFor(placement: PlacementId, state?: string | null, now = new Date()) {
  const candidates = await db.sponsorship.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gt: now }, placements: { has: placement }, OR: [{ states: { isEmpty: true } }, ...(state ? [{ states: { has: state } }] : [])] },
    // Least shown first; on a tie the older sponsorship, so rotation is even and predictable.
    orderBy: [{ impressions: "asc" }, { createdAt: "asc" }],
    take: 1,
    select: { id: true, sponsor: true, headline: true, body: true },
  });
  const s = candidates[0];
  if (!s) return null;
  await db.sponsorship.update({ where: { id: s.id }, data: { impressions: { increment: 1 } } }).catch(() => undefined);
  return s;
}

/** Counts a click and returns where to send the person. */
export async function clickThrough(id: string) {
  const s = await db.sponsorship.findUnique({ where: { id } });
  if (!s) throw new NotFoundError("Not found");
  await db.sponsorship.update({ where: { id }, data: { clicks: { increment: 1 } } });
  const u = new URL(s.url);
  u.searchParams.set("utm_source", "refinerylens");
  u.searchParams.set("utm_medium", "sponsored");
  return u.toString();
}

export const sponsorshipInput = z.object({
  sponsor: z.string().trim().min(2).max(80),
  headline: z.string().trim().min(5).max(80),
  body: z.string().trim().min(10).max(220),
  url: z.string().trim().url().refine((u) => u.startsWith("https://"), "Use an https:// address"),
  placements: z.array(z.enum(PLACEMENTS.map((p) => p.id) as [PlacementId, ...PlacementId[]])).min(1, "Choose at least one placement"),
  states: z.array(z.string().refine((s) => (NIGERIAN_STATES as readonly string[]).includes(s))).default([]),
  priceUsd: z.number().min(0).max(1_000_000),
  startsAt: z.date(),
  endsAt: z.date(),
}).refine((x) => x.endsAt > x.startsAt, { message: "The end date must be after the start date", path: ["endsAt"] });

/** Sponsorships are sold and invoiced by the team in US dollars, then entered here. */
export async function createSponsorship(actor: Actor, raw: z.input<typeof sponsorshipInput>) {
  requireAdmin(actor);
  const input = sponsorshipInput.parse(raw);
  const s = await db.sponsorship.create({ data: { ...input, createdById: actor.id } });
  await audit(actor.id, "admin.sponsorship.create", "Sponsorship", s.id, { sponsor: input.sponsor, priceUsd: input.priceUsd });
  return s;
}

export async function setSponsorshipActive(actor: Actor, id: string, active: boolean) {
  requireAdmin(actor);
  await db.sponsorship.update({ where: { id }, data: { active } });
  await audit(actor.id, active ? "admin.sponsorship.resume" : "admin.sponsorship.pause", "Sponsorship", id);
}

export async function listSponsorships(actor: Actor, now = new Date()) {
  requireAdmin(actor);
  const rows = await db.sponsorship.findMany({ orderBy: { startsAt: "desc" }, take: 200 });
  const live = rows.filter((r) => r.active && r.startsAt <= now && r.endsAt > now);
  // Monthly value of what is running now: each live sponsorship's price spread over its length in months.
  const monthlyUsd = live.reduce((sum, r) => sum + r.priceUsd / Math.max(1, (r.endsAt.getTime() - r.startsAt.getTime()) / (30 * 86_400_000)), 0);
  return { rows, live: live.length, monthlyUsd, bookedUsd: rows.reduce((s, r) => s + r.priceUsd, 0) };
}
