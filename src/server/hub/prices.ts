import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { dayOf, nationalMedian, PRICE_ITEMS, priceItem, summarisePrices } from "@/lib/hub/prices";
import { audit } from "../audit";
import { canSeeBusiness, requireMyBusiness } from "./business";

export const priceInput = z.object({
  state: z.string().refine((s) => (NIGERIAN_STATES as readonly string[]).includes(s), "Choose a Nigerian state"),
  // When the price applied: today or up to 6 days ago. Future prices are never collected.
  daysAgo: z.number().int().min(0).max(6).default(0),
  prices: z.record(z.string(), z.number().positive().finite().nullable()),
});

/** Records the prices a seller charged. Only sellers and refineries report; each item is checked against sane bounds. */
export async function reportPrices(actor: Actor, raw: z.input<typeof priceInput>) {
  const business = await requireMyBusiness(actor);
  if (business.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended and cannot report prices.");
  if (!business.roles.some((r) => r === "SELLER" || r === "REFINERY")) throw new AppError("Only sellers and refineries report prices. Add the seller role to your business profile.");
  const input = priceInput.parse(raw);
  const entries = Object.entries(input.prices).filter((e): e is [string, number] => e[1] !== null);
  if (!entries.length) throw new AppError("Enter at least one price.");
  for (const [id, price] of entries) {
    const item = priceItem(id);
    if (!item) throw new AppError("Unknown product.");
    if (price < item.min || price > item.max) throw new AppError(`${item.label}: ₦${price.toLocaleString("en-GB")} ${item.unit} is outside the expected range (₦${item.min.toLocaleString("en-GB")}–₦${item.max.toLocaleString("en-GB")}). Check the unit.`);
  }
  const day = dayOf(new Date(Date.now() - input.daysAgo * 86_400_000));
  await db.$transaction(
    entries.map(([item, priceNaira]) =>
      db.priceReport.upsert({
        where: { businessId_item_state_day: { businessId: business.id, item, state: input.state, day } },
        update: { priceNaira },
        create: { businessId: business.id, item, state: input.state, day, priceNaira },
      }),
    ),
  );
  await audit(actor.id, "price.report", "HubBusiness", business.id, { items: entries.map(([i]) => i), state: input.state });
  return entries.length;
}

/** The board for one item: per-state medians and the national median, from reports by businesses `viewer` can see. */
export async function priceBoard(viewer: Actor, itemId: string, now = new Date()) {
  const item = priceItem(itemId) ?? PRICE_ITEMS[0];
  const since = new Date(dayOf(now).getTime() - 14 * 86_400_000);
  const rows = await db.priceReport.findMany({
    where: { item: item.id, day: { gte: since }, business: { verification: { not: "SUSPENDED" } } },
    select: { businessId: true, state: true, priceNaira: true, day: true, business: { select: { ownerId: true, name: true, verification: true, isDemo: true } } },
  });
  const seen = rows.filter((r) => canSeeBusiness(viewer, r.business));
  return { item, cells: summarisePrices(seen, now), national: nationalMedian(seen, now), includesDemo: seen.some((r) => r.business.isDemo) };
}

/** A seller's own recent reports, so they can see what they entered. */
export async function myReports(actor: Actor) {
  return db.priceReport.findMany({ where: { business: { ownerId: actor.id } }, orderBy: [{ day: "desc" }, { item: "asc" }], take: 60 });
}
