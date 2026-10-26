import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { allowedSiteKinds, CYLINDER_SIZES, GASES, isSupplyKind, siteKindLabel, stateDistanceKm, summariseNetwork, type GasId } from "@/lib/hub/gas";
import { audit } from "../audit";
import { canSeeBusiness, requireMyBusiness } from "./business";

const MAX_SITES = 200;
const gasIds = GASES.map((g) => g.id) as [string, ...string[]];

export const siteInput = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["TERMINAL", "DEPOT", "REFILL_PLANT", "CYLINDER_RETAIL", "CNG_STATION", "CNG_MOTHER", "LOGISTICS_BASE"]),
  status: z.enum(["OPERATING", "PLANNED", "CLOSED"]).default("OPERATING"),
  gases: z.array(z.enum(gasIds)).min(1, "Choose at least one gas").max(GASES.length),
  cylinderSizes: z.array(z.number().refine((n) => (CYLINDER_SIZES as readonly number[]).includes(n), "Unknown cylinder size")).max(CYLINDER_SIZES.length).default([]),
  // Gas sites are mapped by Nigerian state; regional trade stays on hub listings.
  state: z.string().refine((s) => (NIGERIAN_STATES as readonly string[]).includes(s), "Choose a Nigerian state"),
  town: z.string().trim().max(80).default(""),
  address: z.string().trim().max(200).default(""),
  storageTonnes: z.number().positive().finite().max(1_000_000).nullable().default(null),
  hours: z.string().trim().max(120).default(""),
  delivers: z.boolean().default(false),
  notes: z.string().trim().max(1000).default(""),
});

function clean(input: z.output<typeof siteInput>) {
  const gases = [...new Set(input.gases)];
  if (!isSupplyKind(input.kind) && input.storageTonnes !== null) throw new AppError("Storage applies to supply sites, not truck bases.");
  // Cylinder sizes only make sense where cylinders are handled.
  const cylinderSizes = gases.includes("lpg_cylinder") ? [...new Set(input.cylinderSizes)].sort((a, b) => a - b) : [];
  return { ...input, gases, cylinderSizes };
}

export async function createSite(actor: Actor, raw: z.input<typeof siteInput>) {
  const business = await requireMyBusiness(actor);
  if (business.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended and cannot add sites.");
  const data = clean(siteInput.parse(raw));
  if (!allowedSiteKinds(business.roles).includes(data.kind)) throw new AppError(`Add a matching role to your business profile to add a “${siteKindLabel(data.kind)}”.`);
  if ((await db.gasSite.count({ where: { businessId: business.id } })) >= MAX_SITES) throw new AppError(`A business can list up to ${MAX_SITES} sites.`);
  const s = await db.gasSite.create({ data: { ...data, businessId: business.id } });
  await audit(actor.id, "gas.site.create", "GasSite", s.id, { kind: s.kind, state: s.state });
  return s;
}

async function ownSite(actor: Actor, id: string) {
  const s = await db.gasSite.findUnique({ where: { id }, include: { business: true } });
  if (!s || s.business.ownerId !== actor.id) throw new NotFoundError("Site not found");
  if (s.business.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended and cannot change sites.");
  return s;
}

/** Saving a site also confirms its details as current. */
export async function updateSite(actor: Actor, id: string, raw: z.input<typeof siteInput>) {
  const s = await ownSite(actor, id);
  const data = clean(siteInput.parse(raw));
  if (data.kind !== s.kind && !allowedSiteKinds(s.business.roles).includes(data.kind)) throw new AppError(`Add a matching role to your business profile to make this a “${siteKindLabel(data.kind)}”.`);
  const updated = await db.gasSite.update({ where: { id }, data: { ...data, lastConfirmedAt: new Date() } });
  await audit(actor.id, "gas.site.update", "GasSite", id);
  return updated;
}

export async function confirmSite(actor: Actor, id: string) {
  await ownSite(actor, id);
  await db.gasSite.update({ where: { id }, data: { lastConfirmedAt: new Date() } });
}

export async function mySites(actor: Actor) {
  return db.gasSite.findMany({ where: { business: { ownerId: actor.id } }, orderBy: [{ state: "asc" }, { name: "asc" }] });
}

const visibleSites = (gas: GasId | null): Prisma.GasSiteWhereInput => ({
  status: { not: "CLOSED" },
  business: { verification: { not: "SUSPENDED" } },
  ...(gas ? { gases: { has: gas } } : {}),
});

/** Every site and gas listing `viewer` can see, and the per-state summary built from them. */
export async function networkData(viewer: Actor, gas: GasId | null) {
  const hubProducts = gas ? [GASES.find((g) => g.id === gas)!.hubProduct] : ["lpg", "cng"];
  const [sites, listings] = await Promise.all([
    db.gasSite.findMany({ where: visibleSites(gas), include: { business: { select: { id: true, name: true, ownerId: true, verification: true, isDemo: true } } }, orderBy: { name: "asc" } }),
    db.hubListing.findMany({
      where: { status: "ACTIVE", expiresAt: { gt: new Date() }, kind: { in: ["REQUEST", "DELIVERY"] }, products: { hasSome: hubProducts }, business: { verification: { not: "SUSPENDED" } } },
      select: { kind: true, state: true, areas: true, products: true, business: { select: { ownerId: true, verification: true, name: true } } },
    }),
  ]);
  const seenSites = sites.filter((s) => canSeeBusiness(viewer, s.business));
  const seenListings = listings.filter((l) => canSeeBusiness(viewer, l.business));
  return { sites: seenSites, summary: summariseNetwork(seenSites, seenListings, gas) };
}

type NetworkSite = Awaited<ReturnType<typeof networkData>>["sites"][number];

/** Operating supply sites outside `state`, nearest first by distance between state capitals. */
export function nearestSupply(sites: NetworkSite[], state: string, limit = 8) {
  return sites
    .filter((s) => s.state !== state && s.status === "OPERATING" && isSupplyKind(s.kind))
    .map((s) => ({ site: s, km: stateDistanceKm(state, s.state) ?? Infinity }))
    .sort((a, b) => a.km - b.km || Number(b.site.business.verification === "VERIFIED") - Number(a.site.business.verification === "VERIFIED"))
    .slice(0, limit);
}

export async function getSite(viewer: Actor, id: string) {
  const s = await db.gasSite.findUnique({ where: { id }, include: { business: true } });
  if (!s) throw new NotFoundError("Site not found");
  const own = s.business.ownerId === viewer.id;
  if (!own && (s.status === "CLOSED" || !canSeeBusiness(viewer, s.business) || s.business.verification === "SUSPENDED")) throw new NotFoundError("Site not found");
  return { ...s, own };
}
