import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { isState, PRICED_PRODUCTS, productById, productLabel, stateName } from "@/lib/hub/catalog";
import { sendText } from "../messaging";
import { audit } from "../audit";
import { hasPriceData } from "./priceindex";
import { priceBoard } from "./prices";

/**
 * Threshold alerts for price data customers: "tell me when the Lagos LPG median goes above ₦1,400". Each alert fires
 * once when its condition becomes true, and can fire again only after the median has crossed back. It uses the
 * published board median, so it never reveals more than the board.
 */
export const MAX_THRESHOLDS = 20;
const priced = PRICED_PRODUCTS.map((p) => p.id as string);

export const thresholdInput = z.object({
  product: z.string().refine((p) => priced.includes(p), "Choose a product"),
  state: z.string().refine(isState, "Choose a state"),
  direction: z.enum(["ABOVE", "BELOW"]),
  priceNgn: z.number().int().min(1, "Enter a price in naira").max(1_000_000),
});

export async function addThreshold(actor: Actor, raw: z.input<typeof thresholdInput>) {
  const input = thresholdInput.parse(raw);
  if (!hasPriceData(await db.user.findUnique({ where: { id: actor.id } }))) throw new ForbiddenError("Threshold alerts come with a price data subscription.");
  if ((await db.priceThreshold.count({ where: { userId: actor.id, active: true } })) >= MAX_THRESHOLDS) throw new AppError(`You can have ${MAX_THRESHOLDS} threshold alerts. Remove one first.`);
  // Start from the current state so an alert set below today's median does not fire straight away.
  const cell = (await priceBoard()).find((c) => c.product === input.product && c.state === input.state);
  const met = cell?.median != null && isMet(input.direction, cell.median, input.priceNgn);
  const t = await db.priceThreshold.create({ data: { ...input, userId: actor.id, met } });
  await audit(actor.id, "hub.threshold.add", "PriceThreshold", t.id);
  return t;
}

export async function removeThreshold(actor: Actor, id: string) {
  const { count } = await db.priceThreshold.deleteMany({ where: { id, userId: actor.id } });
  if (!count) throw new NotFoundError("Alert not found");
}

export async function listThresholds(actor: Actor) {
  return db.priceThreshold.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "asc" } });
}

const isMet = (direction: string, median: number, price: number) => (direction === "ABOVE" ? median > price : median < price);

/** Checks every active threshold against today's board. Safe to call often: a threshold fires only on a crossing. */
export async function checkThresholds(now = new Date()) {
  const rows = await db.priceThreshold.findMany({ where: { active: true }, include: { user: { include: { priceAlert: true } } }, take: 5000 });
  if (!rows.length) return { fired: 0 };
  const board = await priceBoard(now);
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let fired = 0;
  for (const t of rows) {
    if (!hasPriceData(t.user, now)) continue;
    const cell = board.find((c) => c.product === t.product && c.state === t.state);
    if (cell?.median == null) continue; // no published median: leave the state as it was
    const met = isMet(t.direction, cell.median, t.priceNgn);
    if (met === t.met) continue;
    const { count } = await db.priceThreshold.updateMany({ where: { id: t.id, met: t.met }, data: { met, ...(met ? { lastFiredAt: now } : {}) } });
    if (!count || !met) continue;
    const unit = productById(t.product)?.priceUnit ?? "";
    const median = `₦${Math.round(cell.median).toLocaleString("en-GB")}`;
    const limit = `₦${t.priceNgn.toLocaleString("en-GB")}`;
    const title = `${productLabel(t.product)} in ${stateName(t.state)} is ${t.direction === "ABOVE" ? "above" : "below"} ${limit}`;
    const body = `The median is now ${median}/${unit} across ${cell.sellers} sellers. Median of seller-stated past prices, not an offer.`;
    const link = `/hub/prices/history?product=${t.product}&state=${t.state}`;
    await db.alert.create({ data: { userId: t.userId, kind: "PRICE_THRESHOLD", title, body, link, dedupeKey: `threshold-${t.id}-${now.getTime()}` } });
    const sub = t.user.priceAlert;
    if (sub?.phone && sub.phoneConfirmedAt) {
      for (const channel of ["SMS", "WHATSAPP"] as const) {
        if (sub.channels.includes(channel)) await sendText(t.userId, { channel, to: sub.phone, body: `RefineryLens: ${title}. ${body} ${base}${link}` });
      }
    }
    fired++;
  }
  return { fired };
}
