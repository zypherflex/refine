import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { currencyFor, dataPlan } from "@/lib/data-plans";
import { audit } from "../audit";
import { backfillIndex } from "../data/index-builder";
import { requireAdmin } from "./guard";

/** Data customers with usage, and recurring revenue: each paying account's monthly list price, kept per currency. */
export async function listDataAccounts(actor: Actor, now = new Date()) {
  requireAdmin(actor);
  const accounts = await db.dataAccount.findMany({ orderBy: { createdAt: "desc" }, include: { user: { select: { id: true, name: true, email: true } }, keys: { select: { id: true, revokedAt: true, lastUsedAt: true } } } });
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const usage = await db.apiUsage.groupBy({ by: ["keyId"], where: { day: { gte: since } }, _sum: { requests: true } });
  const used = new Map(usage.map((u) => [u.keyId, u._sum.requests ?? 0]));
  const rows = accounts.map((a) => ({ ...a, active: a.paidUntil > now, currency: currencyFor(a.billingCountry), requests30: a.keys.reduce((s, k) => s + (used.get(k.id) ?? 0), 0) }));
  const paying = rows.filter((r) => r.active && r.plan !== "trial");
  const mrr = { USD: 0, NGN: 0 };
  for (const r of paying) {
    const p = dataPlan(r.plan)!;
    mrr[r.currency] += (r.currency === "USD" ? p.usdMonthly : p.ngnMonthly) ?? 0;
  }
  const [indexRows, lastDay] = await Promise.all([db.priceIndexDaily.count(), db.priceIndexDaily.findFirst({ orderBy: { day: "desc" }, select: { day: true } })]);
  return { rows, mrr, paying: paying.length, trials: rows.filter((r) => r.active && r.plan === "trial").length, indexRows, lastDay: lastDay?.day ?? null };
}

export async function adminBackfillIndex(actor: Actor, days: number) {
  requireAdmin(actor);
  const n = await backfillIndex(Math.min(365, Math.max(1, days)));
  await audit(actor.id, "admin.data.backfill", "PriceIndexDaily", "all", { days, rows: n });
  return n;
}
