import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { isState, PRICED_PRODUCTS, productById, productLabel, stateName } from "@/lib/hub/catalog";
import { isLang, translator, type Lang } from "@/lib/i18n/hub";
import { channelAvailable, sendText, toE164 } from "../messaging";
import { audit } from "../audit";
import { priceBoard, type BoardCell } from "./prices";

/** Alerts go out once a day after this hour, West Africa Time (UTC+1, no daylight saving). */
export const ALERT_HOUR_WAT = 7;
const WAT_OFFSET_MS = 3_600_000;
const DEFAULT_PRODUCTS = ["LPG", "DIESEL", "PETROL"];
const CODE_TTL_MS = 15 * 60_000;

/** The calendar day in Lagos, as a UTC-midnight Date (what Postgres stores for a DATE column). */
export function watDay(now: Date) {
  const w = new Date(now.getTime() + WAT_OFFSET_MS);
  return new Date(Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()));
}
const watHour = (now: Date) => new Date(now.getTime() + WAT_OFFSET_MS).getUTCHours();

const pricedIds = PRICED_PRODUCTS.map((p) => p.id as string);
export const alertInput = z.object({
  states: z.array(z.string().refine(isState, "Unknown state")).min(1, "Choose at least one state").max(5, "Choose up to five states"),
  products: z.array(z.string().refine((p) => pricedIds.includes(p), "Unknown product")).max(pricedIds.length).default([]),
  channels: z.array(z.enum(["IN_APP", "SMS", "WHATSAPP"])).default(["IN_APP"]),
  language: z.string().refine(isLang).default("en"),
  active: z.boolean().default(true),
});

export async function getAlertSettings(actor: Actor) {
  return db.priceAlertSubscription.findUnique({ where: { userId: actor.id } });
}

export async function saveAlertSettings(actor: Actor, raw: z.input<typeof alertInput>) {
  const input = alertInput.parse(raw);
  for (const c of ["SMS", "WHATSAPP"] as const) {
    if (input.channels.includes(c) && !channelAvailable(c)) throw new AppError(`${c === "SMS" ? "SMS" : "WhatsApp"} alerts are not switched on in this installation yet.`);
  }
  const channels = Array.from(new Set(["IN_APP", ...input.channels]));
  const data = { states: input.states, products: input.products, channels, language: input.language, active: input.active };
  return db.priceAlertSubscription.upsert({ where: { userId: actor.id }, update: data, create: { ...data, userId: actor.id } });
}

const hashCode = (userId: string, code: string) => createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}:${userId}:${code}`).digest("hex");

/** Sends a 6-digit code to the number. Texts go only to numbers their owner has confirmed. */
export async function startPhoneConfirmation(actor: Actor, rawPhone: string, now = new Date()) {
  const phone = toE164(rawPhone);
  if (!phone) throw new AppError("Enter a mobile number, for example 0803 123 4567 or +234 803 123 4567.");
  const channel = channelAvailable("SMS") ? "SMS" : channelAvailable("WHATSAPP") ? "WHATSAPP" : null;
  if (!channel) throw new AppError("Text alerts are not switched on in this installation yet.");
  const sub = await getAlertSettings(actor);
  if (!sub) throw new AppError("Save your alert settings first.");
  if (sub.phoneCodeSentAt && now.getTime() - sub.phoneCodeSentAt.getTime() < 60_000) throw new AppError("Wait a minute before asking for another code.");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.priceAlertSubscription.update({ where: { id: sub.id }, data: { phone, phoneConfirmedAt: null, phoneCodeHash: hashCode(actor.id, code), phoneCodeSentAt: now } });
  const sent = await sendText(actor.id, { channel, to: phone, body: translator(sub.language as Lang)("sms.code", { code }) });
  if (!sent) throw new AppError("The code could not be sent. Check the number and try again.");
  await audit(actor.id, "hub.alerts.phone_code", "PriceAlertSubscription", sub.id);
}

export async function confirmPhone(actor: Actor, code: string, now = new Date()) {
  const sub = await getAlertSettings(actor);
  if (!sub?.phoneCodeHash || !sub.phoneCodeSentAt) throw new AppError("Ask for a code first.");
  if (now.getTime() - sub.phoneCodeSentAt.getTime() > CODE_TTL_MS) throw new AppError("That code has expired. Ask for a new one.");
  if (hashCode(actor.id, code.trim()) !== sub.phoneCodeHash) throw new AppError("That code is not right.");
  await db.priceAlertSubscription.update({ where: { id: sub.id }, data: { phoneConfirmedAt: now, phoneCodeHash: "" } });
}

/** The alert text for one subscriber, in their language. Only published medians are used, never individual prices. */
export function composeAlert(board: BoardCell[], sub: { states: string[]; products: string[]; language: string }, day: Date, link: string) {
  const t = translator(isLang(sub.language) ? sub.language : "en");
  const products = sub.products.length ? sub.products : DEFAULT_PRODUCTS;
  const date = day.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  const blocks = sub.states.map((state) => {
    const cells = board.filter((c) => c.state === state && c.median != null && products.includes(c.product));
    const header = t("sms.header", { state: stateName(state), date });
    if (!cells.length) return `${header}\n${t("sms.none", { state: stateName(state) })}`;
    const lines = cells.map((c) => t("sms.line", { product: productLabel(c.product).replace(/ \(.*\)$/, ""), price: `₦${Math.round(c.median!).toLocaleString("en-GB")}`, unit: productById(c.product)?.priceUnit ?? "", n: c.sellers }));
    return [header, ...lines].join("\n");
  });
  return `${blocks.join("\n\n")}\n${t("sms.footer", { link })}`;
}

/**
 * Sends today's alerts to every active subscriber who has not had one today, once it is past ALERT_HOUR_WAT in Lagos.
 * Safe to call every minute. In-app alerts always; email rides the normal alert email for users who opted in; SMS and
 * WhatsApp only to a confirmed number when the channel is switched on.
 */
export async function sendMorningPriceAlerts(now = new Date()) {
  if (watHour(now) < ALERT_HOUR_WAT) return { users: 0, texts: 0 };
  const today = watDay(now);
  const subs = await db.priceAlertSubscription.findMany({ where: { active: true, OR: [{ lastSentOn: null }, { lastSentOn: { lt: today } }] }, take: 1000 });
  if (!subs.length) return { users: 0, texts: 0 };
  const board = await priceBoard(now);
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const key = today.toISOString().slice(0, 10);
  let texts = 0;
  for (const sub of subs) {
    // Claim the day first so two workers never send twice.
    const { count } = await db.priceAlertSubscription.updateMany({ where: { id: sub.id, OR: [{ lastSentOn: null }, { lastSentOn: { lt: today } }] }, data: { lastSentOn: today } });
    if (!count) continue;
    const link = `/hub/prices${sub.states.length === 1 ? `?state=${sub.states[0]}` : ""}`;
    const body = composeAlert(board, sub, today, `${base}${link}`);
    const t = translator(isLang(sub.language) ? sub.language : "en");
    await db.alert.upsert({
      where: { userId_dedupeKey: { userId: sub.userId, dedupeKey: `price-${key}` } },
      update: {},
      create: { userId: sub.userId, kind: "PRICE_DIGEST", title: t("sms.header", { state: sub.states.map(stateName).join(", "), date: key }).replace(/:$/, ""), body, link, dedupeKey: `price-${key}` },
    });
    if (sub.phone && sub.phoneConfirmedAt) {
      for (const channel of ["SMS", "WHATSAPP"] as const) {
        if (sub.channels.includes(channel) && (await sendText(sub.userId, { channel, to: sub.phone, body }))) texts++;
      }
    }
  }
  return { users: subs.length, texts };
}
