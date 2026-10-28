import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { BILLING_COUNTRIES, dataPlan, TRIAL_DAYS, type DataPlan } from "@/lib/data-plans";
import { audit } from "../audit";
import { requireAdmin } from "../admin/guard";
import { utcDay } from "./index-builder";

const DAY = 86_400_000;
const hashKey = (k: string) => createHash("sha256").update(k).digest("hex");

export const trialInput = z.object({
  organisation: z.string().trim().min(2, "Give your organisation's name").max(120),
  billingCountry: z.string().refine((c) => BILLING_COUNTRIES.some(([id]) => id === c), "Choose a country"),
});

/** Opens a data account on a 14-day trial with one API key's worth of access. One account per person. */
export async function startTrial(actor: Actor, raw: z.input<typeof trialInput>) {
  const input = trialInput.parse(raw);
  if (await db.dataAccount.findUnique({ where: { userId: actor.id } })) throw new AppError("You already have a data account.");
  const a = await db.dataAccount.create({ data: { userId: actor.id, ...input, plan: "trial", paidUntil: new Date(Date.now() + TRIAL_DAYS * DAY) } });
  await audit(actor.id, "data.trial", "DataAccount", a.id, { country: input.billingCountry });
  return a;
}

export async function myDataAccount(actor: Actor) {
  const a = await db.dataAccount.findUnique({ where: { userId: actor.id }, include: { keys: { orderBy: { createdAt: "desc" } } } });
  if (!a) return null;
  const since = utcDay(new Date(Date.now() - 29 * DAY));
  const usage = await db.apiUsage.findMany({ where: { key: { accountId: a.id }, day: { gte: since } }, select: { day: true, requests: true } });
  const today = utcDay(new Date()).getTime();
  return {
    account: a,
    plan: dataPlan(a.plan)!,
    active: a.paidUntil > new Date(),
    usedToday: usage.filter((u) => u.day.getTime() === today).reduce((s, u) => s + u.requests, 0),
    used30: usage.reduce((s, u) => s + u.requests, 0),
  };
}

/** Creates an API key and returns it once; only its hash is kept. */
export async function createKey(actor: Actor, name: string) {
  const a = await db.dataAccount.findUnique({ where: { userId: actor.id }, include: { keys: { where: { revokedAt: null } } } });
  if (!a) throw new NotFoundError("Open a data account first.");
  const plan = dataPlan(a.plan)!;
  if (a.keys.length >= plan.keys) throw new AppError(`Your ${plan.name} plan allows ${plan.keys} active key${plan.keys === 1 ? "" : "s"}. Revoke one or upgrade.`);
  const key = `rl_live_${randomBytes(24).toString("base64url")}`;
  const k = await db.apiKey.create({ data: { accountId: a.id, name: name.trim().slice(0, 60) || "Default", prefix: key.slice(0, 14), hash: hashKey(key) } });
  await audit(actor.id, "data.key.create", "ApiKey", k.id);
  return key;
}

export async function revokeKey(actor: Actor, keyId: string) {
  const k = await db.apiKey.findUnique({ where: { id: keyId }, include: { account: true } });
  if (!k || k.account.userId !== actor.id) throw new NotFoundError("Key not found");
  await db.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  await audit(actor.id, "data.key.revoke", "ApiKey", keyId);
}

export type ApiAuth =
  | { ok: true; keyId: string; accountId: string; plan: DataPlan }
  | { ok: false; status: 401 | 402; error: string };

/** Checks a bearer key: it must exist, not be revoked, and belong to an account whose access has not run out. */
export async function authenticateKey(raw: string | null, now = new Date()): Promise<ApiAuth> {
  const key = raw?.replace(/^Bearer\s+/i, "").trim() ?? "";
  if (!/^rl_live_[A-Za-z0-9_-]{20,64}$/.test(key)) return { ok: false, status: 401, error: "Send your API key as: Authorization: Bearer rl_live_..." };
  const k = await db.apiKey.findUnique({ where: { hash: hashKey(key) }, include: { account: true } });
  if (!k || k.revokedAt) return { ok: false, status: 401, error: "This API key is not valid or was revoked." };
  if (k.account.paidUntil <= now) return { ok: false, status: 402, error: "Your data plan has ended. Renew it at /account/data." };
  return { ok: true, keyId: k.id, accountId: k.accountId, plan: dataPlan(k.account.plan)! };
}

/** Counts a request against the account's daily allowance, across all its keys. */
export async function meter(auth: { keyId: string; accountId: string; plan: DataPlan }, now = new Date()) {
  const day = utcDay(now);
  const used = await db.apiUsage.aggregate({ where: { day, key: { accountId: auth.accountId } }, _sum: { requests: true } });
  const sofar = used._sum.requests ?? 0;
  if (sofar >= auth.plan.requestsPerDay) return { allowed: false, used: sofar, limit: auth.plan.requestsPerDay };
  await db.apiUsage.upsert({ where: { keyId_day: { keyId: auth.keyId, day } }, update: { requests: { increment: 1 } }, create: { keyId: auth.keyId, day, requests: 1 } });
  await db.apiKey.update({ where: { id: auth.keyId }, data: { lastUsedAt: now } });
  return { allowed: true, used: sofar + 1, limit: auth.plan.requestsPerDay };
}

/** After payment: sets the plan and adds the days, from today or from the current end if still running. */
export async function applyPaidPeriod(accountId: string, planId: string, days: number) {
  const a = await db.dataAccount.findUniqueOrThrow({ where: { id: accountId } });
  const from = a.paidUntil > new Date() && a.plan !== "trial" ? a.paidUntil : new Date();
  return db.dataAccount.update({ where: { id: accountId }, data: { plan: planId, paidUntil: new Date(from.getTime() + days * DAY) } });
}

/** Administrators set Enterprise and other negotiated terms after an invoice is paid. */
export async function adminSetDataPlan(actor: Actor, accountId: string, planId: string, days: number) {
  requireAdmin(actor);
  if (!dataPlan(planId)) throw new AppError("Unknown plan.");
  if (!Number.isInteger(days) || days < 1 || days > 800) throw new AppError("Give a number of days between 1 and 800.");
  const a = await applyPaidPeriod(accountId, planId, days);
  await audit(actor.id, "admin.data.set_plan", "DataAccount", accountId, { planId, days });
  return a;
}

/** Worker: tells data customers 3 days before their access ends, once per period. */
export async function sendDataRenewalReminders(now = new Date()) {
  const { createAlert } = await import("../services/alerts");
  const soon = await db.dataAccount.findMany({ where: { paidUntil: { gt: now, lt: new Date(now.getTime() + 3 * DAY) } } });
  for (const a of soon) {
    const plan = dataPlan(a.plan)!;
    await createAlert({
      userId: a.userId, kind: "DATA_PLAN", title: `Your RefineryLens Data ${plan.name} ${a.plan === "trial" ? "trial" : "plan"} ends soon`,
      body: `Access for ${a.organisation} ends on ${a.paidUntil.toISOString().slice(0, 10)}. Choose a plan to keep your API keys working.`,
      link: "/account/data", dedupeKey: `data-renew:${a.id}:${a.paidUntil.toISOString().slice(0, 10)}`,
    });
  }
  return soon.length;
}

/** The index as CSV for the signed-in customer, within their plan's history. Recorded in the audit log. */
export async function exportIndexCsv(actor: Actor, now = new Date()) {
  const a = await db.dataAccount.findUnique({ where: { userId: actor.id } });
  if (!a) throw new NotFoundError("Open a data account first.");
  if (a.paidUntil <= now) throw new AppError("Your data plan has ended. Renew it to download.");
  const plan = dataPlan(a.plan)!;
  const from = plan.historyDays === null ? undefined : utcDay(new Date(now.getTime() - (plan.historyDays - 1) * DAY));
  const rows = await db.priceIndexDaily.findMany({ where: from ? { day: { gte: from } } : {}, orderBy: [{ day: "asc" }, { state: "asc" }, { item: "asc" }, { source: "asc" }], take: 200_000 });
  const { toCsv } = await import("../admin/exports");
  await audit(actor.id, "data.export", "DataAccount", a.id, { rows: rows.length });
  return toCsv(["date", "state", "item", "source", "currency", "median", "low", "high", "reporters", "demo"], rows.map((r) => [r.day.toISOString().slice(0, 10), r.state, r.item, r.source, "NGN", r.median, r.low, r.high, r.reporters, r.includesDemo]));
}
