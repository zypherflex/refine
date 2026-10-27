import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { isState, PRICED_PRODUCTS } from "@/lib/hub/catalog";
import { median, MIN_SELLERS_FOR_MEDIAN, startOfDay } from "@/lib/hub/rules";
import { audit } from "../audit";

/**
 * Price index history: weekly medians of seller-stated past prices, by product and state (or all of Nigeria).
 * The same rules as the price board apply to every point: each seller counts once per week (their latest report),
 * and a median is published only from MIN_SELLERS_FOR_MEDIAN or more sellers. Individual prices are never returned.
 */
const DAY = 86_400_000;
export const NATIONAL = "NG";
/** Free users see this many weeks; price data subscribers and the API get up to MAX_WEEKS. */
export const FREE_WEEKS = 8;
export const MAX_WEEKS = 104;

const pricedIds = PRICED_PRODUCTS.map((p) => p.id as string);
export const historyQuery = z.object({
  product: z.string().refine((p) => pricedIds.includes(p), "Unknown product"),
  state: z.string().refine((s) => s === NATIONAL || isState(s), "Unknown state"),
  weeks: z.coerce.number().int().min(1).max(MAX_WEEKS).default(26),
});

export type IndexPoint = { weekEnding: string; median: number | null; sellers: number };

export async function priceHistory(raw: z.input<typeof historyQuery>, now = new Date()): Promise<IndexPoint[]> {
  const q = historyQuery.parse(raw);
  const end = startOfDay(now);
  const start = new Date(end.getTime() - (q.weeks * 7 - 1) * DAY);
  const rows = await db.priceReport.findMany({
    where: { product: q.product, ...(q.state === NATIONAL ? {} : { state: q.state }), chargedOn: { gte: start, lte: end }, business: { verification: { not: "SUSPENDED" } } },
    select: { businessId: true, state: true, priceNgn: true, chargedOn: true },
    orderBy: { chargedOn: "desc" },
  });
  const points: IndexPoint[] = [];
  for (let w = q.weeks - 1; w >= 0; w--) {
    const weekEnd = end.getTime() - w * 7 * DAY;
    const weekStart = weekEnd - 6 * DAY;
    const latest = new Map<string, number>();
    for (const r of rows) {
      const t = r.chargedOn.getTime();
      if (t < weekStart || t > weekEnd) continue;
      const key = `${r.businessId}|${r.state}`; // nationally, a seller in two states counts in each
      if (!latest.has(key)) latest.set(key, r.priceNgn);
    }
    const prices = [...latest.values()];
    points.push({ weekEnding: new Date(weekEnd).toISOString().slice(0, 10), median: prices.length >= MIN_SELLERS_FOR_MEDIAN ? median(prices) : null, sellers: prices.length });
  }
  return points;
}

export function hasPriceData(u: { priceDataUntil: Date | null } | null, now = new Date()) {
  return !!u?.priceDataUntil && u.priceDataUntil > now;
}

export const subscriberInput = z.object({ email: z.string().trim().toLowerCase().email(), months: z.coerce.number().int().min(0).max(24) });

/** Administrators turn price data on for a customer after payment is agreed offline. 0 months turns it off. */
export async function setPriceDataAccess(actor: Actor, raw: z.input<typeof subscriberInput>, now = new Date()) {
  if (!can.manageUsers(actor)) throw new ForbiddenError();
  const input = subscriberInput.parse(raw);
  const u = await db.user.findUnique({ where: { email: input.email } });
  if (!u) throw new NotFoundError("No account with that email.");
  const until = input.months ? new Date(now.getTime() + input.months * 30 * DAY) : null;
  await db.user.update({ where: { id: u.id }, data: { priceDataUntil: until } });
  if (!until) await db.apiKey.updateMany({ where: { userId: u.id, revokedAt: null }, data: { revokedAt: now } });
  await audit(actor.id, "hub.pricedata.set", "User", u.id, { until: until?.toISOString() ?? null });
}

export async function priceDataSubscribers() {
  return db.user.findMany({ where: { priceDataUntil: { not: null } }, select: { id: true, name: true, email: true, priceDataUntil: true }, orderBy: { priceDataUntil: "desc" } });
}

const KEY_PREFIX = "rl_live_";
const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export const MAX_KEYS = 5;

/** Creates an API key and returns it once. Only its hash is stored. */
export async function createApiKey(actor: Actor, name: string, now = new Date()) {
  const u = await db.user.findUnique({ where: { id: actor.id } });
  if (!hasPriceData(u, now)) throw new ForbiddenError("API keys come with a price data subscription.");
  const label = name.trim().slice(0, 60);
  if (label.length < 2) throw new AppError("Name the key, for example “Credit team”.");
  if ((await db.apiKey.count({ where: { userId: actor.id, revokedAt: null } })) >= MAX_KEYS) throw new AppError(`You can have ${MAX_KEYS} active keys. Revoke one first.`);
  const key = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  const row = await db.apiKey.create({ data: { userId: actor.id, name: label, prefix: key.slice(0, KEY_PREFIX.length + 6), hash: hashKey(key) } });
  await audit(actor.id, "hub.apikey.create", "ApiKey", row.id);
  return { id: row.id, key };
}

export async function revokeApiKey(actor: Actor, id: string, now = new Date()) {
  const { count } = await db.apiKey.updateMany({ where: { id, userId: actor.id, revokedAt: null }, data: { revokedAt: now } });
  if (!count) throw new NotFoundError("Key not found");
  await audit(actor.id, "hub.apikey.revoke", "ApiKey", id);
}

export async function listApiKeys(actor: Actor) {
  return db.apiKey.findMany({ where: { userId: actor.id }, select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true, revokedAt: true }, orderBy: { createdAt: "desc" } });
}

/** Resolves a bearer key to its user, if the key is live and the subscription current. */
export async function userForApiKey(key: string, now = new Date()) {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const row = await db.apiKey.findUnique({ where: { hash: hashKey(key) }, include: { user: true } });
  if (!row || row.revokedAt || !hasPriceData(row.user, now)) return null;
  await db.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: now } });
  return row.user;
}

export function historyCsv(product: string, state: string, points: IndexPoint[]) {
  const lines = ["week_ending,product,state,median_ngn,sellers"];
  for (const p of points) lines.push([p.weekEnding, product, state, p.median ?? "", p.sellers].join(","));
  return `${lines.join("\n")}\n`;
}

export const METHODOLOGY = "Weekly medians of past prices that sellers on RefineryLens state they charged. Each seller counts once per week (latest report). A median is published only from three or more sellers; individual prices are never published. Not an offer, a forecast or advice.";
