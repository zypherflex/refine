import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { PRICED_PRODUCTS, productLabel } from "@/lib/hub/catalog";
import { MAX_PRICE_AGE_DAYS, median, MIN_SELLERS_FOR_MEDIAN, PRICE_BOUNDS, PRICE_WINDOW_DAYS, startOfDay } from "@/lib/hub/rules";
import { audit } from "../audit";
import { requireBusiness, stateField } from "./business";

const priced = PRICED_PRODUCTS.map((p) => p.id) as [string, ...string[]];
const DAY = 86_400_000;

export const priceInput = z.object({
  product: z.enum(priced),
  state: stateField,
  priceNgn: z.coerce.number().positive("Enter the price in naira"),
  chargedOn: z.coerce.date(),
  // The seller confirms this is a price already charged, not a planned or future price.
  confirmCharged: z.literal(true, { errorMap: () => ({ message: "Confirm this is a price you actually charged" }) }),
});

export async function reportPrice(actor: Actor, raw: z.input<typeof priceInput>, now = new Date()) {
  const input = priceInput.parse(raw);
  const b = await requireBusiness(actor);
  if (!b.roles.includes("SELLER") && !b.roles.includes("REFINERY")) throw new AppError("Only sellers can report prices. Add the Seller role to your business profile first.");
  const day = startOfDay(input.chargedOn);
  const today = startOfDay(now);
  if (day > today) throw new AppError("Only report prices you have already charged. Planned or future prices are not accepted.");
  if (today.getTime() - day.getTime() > MAX_PRICE_AGE_DAYS * DAY) throw new AppError(`Report prices charged in the last ${MAX_PRICE_AGE_DAYS} days.`);
  const [lo, hi] = PRICE_BOUNDS[input.product]!;
  if (input.priceNgn < lo || input.priceNgn > hi) throw new AppError(`That price is outside the expected range for ${productLabel(input.product)} (₦${lo.toLocaleString("en-GB")}–₦${hi.toLocaleString("en-GB")}). Check the unit and the zeros.`);
  const r = await db.priceReport.upsert({
    where: { businessId_product_state_chargedOn: { businessId: b.id, product: input.product, state: input.state, chargedOn: day } },
    update: { priceNgn: input.priceNgn },
    create: { businessId: b.id, product: input.product, state: input.state, priceNgn: input.priceNgn, chargedOn: day },
  });
  await audit(actor.id, "hub.price.report", "PriceReport", r.id, { product: input.product, state: input.state });
  return r;
}

export type BoardCell = {
  product: string;
  state: string;
  sellers: number;
  verifiedSellers: number;
  median: number | null;
  latest: Date | null;
  oldest: Date | null;
  includesSample: boolean;
};

/**
 * The price board. Each seller counts once (their latest report in the window). A median is published only when
 * MIN_SELLERS_FOR_MEDIAN different sellers reported; individual prices and ranges are never returned.
 */
export async function priceBoard(now = new Date()): Promise<BoardCell[]> {
  const since = new Date(startOfDay(now).getTime() - PRICE_WINDOW_DAYS * DAY);
  const rows = await db.priceReport.findMany({
    where: { chargedOn: { gte: since, lte: startOfDay(now) }, business: { verification: { not: "SUSPENDED" } } },
    include: { business: { select: { verification: true, isSample: true } } },
    orderBy: { chargedOn: "desc" },
  });
  const groups = new Map<string, Map<string, (typeof rows)[number]>>();
  for (const r of rows) {
    const k = `${r.product}|${r.state}`;
    const g = groups.get(k) ?? new Map();
    if (!g.has(r.businessId)) g.set(r.businessId, r); // rows are newest first
    groups.set(k, g);
  }
  const out: BoardCell[] = [];
  for (const [k, g] of groups) {
    const [product, state] = k.split("|") as [string, string];
    const latestPerSeller = [...g.values()];
    const enough = latestPerSeller.length >= MIN_SELLERS_FOR_MEDIAN;
    const dates = latestPerSeller.map((r) => r.chargedOn.getTime());
    out.push({
      product,
      state,
      sellers: latestPerSeller.length,
      verifiedSellers: latestPerSeller.filter((r) => r.business.verification === "VERIFIED").length,
      median: enough ? median(latestPerSeller.map((r) => r.priceNgn)) : null,
      latest: enough ? new Date(Math.max(...dates)) : null,
      oldest: enough ? new Date(Math.min(...dates)) : null,
      includesSample: latestPerSeller.some((r) => r.business.isSample),
    });
  }
  const order = PRICED_PRODUCTS.map((p) => p.id as string);
  return out.sort((a, b) => order.indexOf(a.product) - order.indexOf(b.product) || a.state.localeCompare(b.state));
}

/** A seller's own recent reports, for their own records. */
export async function myPriceReports(actor: Actor) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) return [];
  return db.priceReport.findMany({ where: { businessId: b.id }, orderBy: { chargedOn: "desc" }, take: 30 });
}
