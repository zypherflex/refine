import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { median, priceItem } from "@/lib/hub/prices";
import { EVERYDAY_ITEMS } from "@/lib/everyday";
import { authenticateKey, meter } from "./accounts";
import { utcDay } from "./index-builder";
import type { DataPlan } from "@/lib/data-plans";

const DAY = 86_400_000;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
export const apiError = (status: number, code: string, message: string) => json({ error: { code, message } }, status);

/** Authenticates the key, counts the request and runs the endpoint; every response carries the day's allowance. */
export async function withKey(req: NextRequest, run: (plan: DataPlan, q: URLSearchParams) => Promise<unknown>) {
  const auth = await authenticateKey(req.headers.get("authorization"));
  if (!auth.ok) return apiError(auth.status, auth.status === 401 ? "unauthorized" : "payment_required", auth.error);
  const m = await meter(auth);
  const limits = { "X-RateLimit-Limit": String(m.limit), "X-RateLimit-Remaining": String(Math.max(0, m.limit - m.used)) };
  if (!m.allowed) return json({ error: { code: "rate_limited", message: `Your plan allows ${m.limit} requests a day. It resets at 00:00 UTC.` } }, 429, limits);
  try {
    return json(await run(auth.plan, req.nextUrl.searchParams), 200, limits);
  } catch (e) {
    if (e instanceof BadRequest) return json({ error: { code: "bad_request", message: e.message } }, 400, limits);
    throw e;
  }
}

export class BadRequest extends Error {}

const day = (s: string | null, name: string) => {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequest(`${name} must be a date like 2026-10-01.`);
  return new Date(`${s}T00:00:00Z`);
};

/** The earliest day a plan may read; plans with full history have no limit. */
const earliest = (plan: DataPlan, now = new Date()) => (plan.historyDays === null ? null : utcDay(new Date(now.getTime() - (plan.historyDays - 1) * DAY)));

function filters(plan: DataPlan, q: URLSearchParams) {
  const where: Prisma.PriceIndexDailyWhereInput = {};
  const item = q.get("item");
  if (item) {
    if (!(EVERYDAY_ITEMS as readonly string[]).includes(item)) throw new BadRequest(`Unknown item. Use one of: ${EVERYDAY_ITEMS.join(", ")}.`);
    where.item = item;
  }
  const state = q.get("state");
  if (state) {
    if (!(NIGERIAN_STATES as readonly string[]).includes(state)) throw new BadRequest("Unknown state. See /api/v1/meta for the list.");
    where.state = state;
  }
  const source = q.get("source")?.toUpperCase();
  if (source) {
    if (source !== "PUBLIC" && source !== "SELLER") throw new BadRequest("source must be PUBLIC or SELLER.");
    where.source = source;
  }
  const min = earliest(plan);
  const from = day(q.get("from"), "from");
  const to = day(q.get("to"), "to");
  const start = from && min ? new Date(Math.max(from.getTime(), min.getTime())) : from ?? min;
  where.day = { ...(start ? { gte: start } : {}), ...(to ? { lte: to } : {}) };
  return { where, historyFrom: min };
}

const shape = (r: { day: Date; state: string; item: string; source: string; median: number; low: number; high: number; reporters: number; includesDemo: boolean }) => ({
  date: r.day.toISOString().slice(0, 10), state: r.state, item: r.item, unit: priceItem(r.item)?.unit ?? "", source: r.source, currency: "NGN",
  median: r.median, low: r.low, high: r.high, reporters: r.reporters, ...(r.includesDemo ? { demo: true } : {}),
});

export async function pricesEndpoint(plan: DataPlan, q: URLSearchParams) {
  const { where, historyFrom } = filters(plan, q);
  const limit = Math.min(1000, Math.max(1, Number(q.get("limit") ?? 500) || 500));
  const offset = Math.max(0, Number(q.get("offset") ?? 0) || 0);
  const [total, rows] = await Promise.all([
    db.priceIndexDaily.count({ where }),
    db.priceIndexDaily.findMany({ where, orderBy: [{ day: "desc" }, { state: "asc" }, { item: "asc" }, { source: "asc" }], skip: offset, take: limit }),
  ]);
  return { data: rows.map(shape), meta: { total, limit, offset, plan: plan.id, historyFrom: historyFrom?.toISOString().slice(0, 10) ?? null } };
}

/** The most recent row for each state, item and source. */
export async function latestEndpoint(plan: DataPlan, q: URLSearchParams) {
  const { where } = filters(plan, q);
  const rows = await db.priceIndexDaily.findMany({ where, orderBy: { day: "desc" }, take: 5000 });
  const seen = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!seen.has(`${r.state}|${r.item}|${r.source}`)) seen.set(`${r.state}|${r.item}|${r.source}`, r);
  return { data: [...seen.values()].map(shape), meta: { plan: plan.id } };
}

/** A daily national figure: the median of the state medians that day, with how many states contributed. */
export async function nationalEndpoint(plan: DataPlan, q: URLSearchParams) {
  if (!q.get("item")) throw new BadRequest("item is required, e.g. item=pms_retail_litre.");
  const { where } = filters(plan, q);
  const rows = await db.priceIndexDaily.findMany({ where, orderBy: { day: "asc" }, take: 50_000 });
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.day.toISOString().slice(0, 10)}|${r.source}`;
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }
  return {
    data: [...byDay.entries()].map(([k, rs]) => {
      const [date, source] = k.split("|");
      return { date, item: q.get("item"), source, currency: "NGN", median: median(rs.map((r) => r.median)), states: rs.length, ...(rs.some((r) => r.includesDemo) ? { demo: true } : {}) };
    }),
    meta: { plan: plan.id, method: "median of state medians" },
  };
}

export function metaEndpoint() {
  return {
    items: EVERYDAY_ITEMS.map((id) => ({ id, label: priceItem(id)!.label, unit: priceItem(id)!.unit })),
    states: NIGERIAN_STATES,
    sources: [
      { id: "PUBLIC", about: "What members of the public paid at named stations and gas shops: each person's latest price in the 3 days to the date, shown with at least 3 people." },
      { id: "SELLER", about: "What sellers on the RefineryLens trade hub charged: each seller's latest price in the 7 days to the date, shown with at least 3 sellers." },
    ],
    currency: "NGN",
  };
}
