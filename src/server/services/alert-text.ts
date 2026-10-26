import { db } from "@/lib/db";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { dayOf, naira, PRICE_ITEMS, summarisePrices } from "@/lib/hub/prices";
import { isPubliclyVisible } from "@/lib/hub/catalog";
import { getTextSender, normalisePhone, type TextSender } from "../connect/text";

/**
 * SMS or WhatsApp copies of trade hub alerts (messages, quotes, deliveries, verification) for users who opted in, and
 * a once-a-day price digest for their state. Research alerts stay in-app and email; texts cost money per message.
 */

const TEXTED_KINDS = ["HUB_MESSAGE", "HUB_JOB", "HUB_SUPPLY", "HUB_VERIFICATION"];

export async function sendDueAlertTexts(now = new Date(), sender: TextSender | null = getTextSender()) {
  if (!sender) return { sent: 0 };
  const due = await db.alert.findMany({
    where: { textedAt: null, visibleAt: { lte: now }, kind: { in: TEXTED_KINDS }, user: { textAlerts: true, phone: { not: null } } },
    include: { user: { select: { phone: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  let sent = 0;
  for (const a of due) {
    try {
      await sender.send(a.user.phone!, `RefineryLens: ${a.title}. ${base}${a.link}`);
    } catch (e) {
      console.error("alert text failed", a.id, e);
      continue;
    }
    await db.alert.update({ where: { id: a.id }, data: { textedAt: new Date() } });
    sent++;
  }
  return { sent };
}

export type TextSettings = { phone: string; textAlerts: boolean; priceDigest: boolean; digestState: string };

/** Saves the phone and text preferences. Turning text alerts on does not send the existing backlog. */
export async function saveTextSettings(userId: string, s: TextSettings) {
  const phone = s.phone.trim() ? normalisePhone(s.phone) : null;
  if (s.phone.trim() && !phone) return { error: "Enter a phone number such as 0803 123 4567 or +234 803 123 4567." };
  if ((s.textAlerts || s.priceDigest) && !phone) return { error: "Add a phone number to receive texts." };
  const digestState = (NIGERIAN_STATES as readonly string[]).includes(s.digestState) ? s.digestState : null;
  if (s.priceDigest && !digestState) return { error: "Choose the state for your price digest." };
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { phone, textAlerts: s.textAlerts, priceDigest: s.priceDigest, digestState } }),
    ...(s.textAlerts ? [db.alert.updateMany({ where: { userId, textedAt: null }, data: { textedAt: new Date() } })] : []),
  ]);
  return { ok: "Saved." };
}

const DIGEST_ITEMS = ["lpg_retail_kg", "lpg_cyl_12_5", "ago_depot_litre", "pms_retail_litre"] as const;

/** One line per item that has a median in the state, e.g. "LPG refill ₦1,300/kg". */
export async function digestText(state: string, now = new Date()) {
  const since = new Date(dayOf(now).getTime() - 14 * 86_400_000);
  const rows = await db.priceReport.findMany({
    where: { state, item: { in: [...DIGEST_ITEMS] }, day: { gte: since }, business: { verification: { not: "SUSPENDED" } } },
    select: { item: true, businessId: true, state: true, priceNaira: true, day: true, business: { select: { name: true, verification: true } } },
  });
  const lines: string[] = [];
  for (const id of DIGEST_ITEMS) {
    const item = PRICE_ITEMS.find((p) => p.id === id)!;
    const cell = summarisePrices(rows.filter((r) => r.item === id && isPubliclyVisible(r.business)), now).find((c) => c.state === state);
    if (cell?.median != null) lines.push(`${item.label} ${naira(cell.median)} ${item.unit}`);
  }
  return lines.length ? `RefineryLens ${state} prices (seller median, 7 days): ${lines.join("; ")}.` : null;
}

/** Sends the day's digest once per user per day, after 06:00 West Africa Time. */
export async function sendPriceDigests(now = new Date(), sender: TextSender | null = getTextSender()) {
  if (!sender) return { sent: 0 };
  const watHour = (now.getUTCHours() + 1) % 24;
  if (watHour < 6) return { sent: 0 };
  const today = dayOf(new Date(now.getTime() + 3_600_000));
  const users = await db.user.findMany({ where: { priceDigest: true, phone: { not: null }, digestState: { not: null } }, select: { id: true, phone: true, digestState: true } });
  const cache = new Map<string, string | null>();
  let sent = 0;
  for (const u of users) {
    const key = `price-digest:${today.toISOString().slice(0, 10)}`;
    const done = await db.alert.findUnique({ where: { userId_dedupeKey: { userId: u.id, dedupeKey: key } } });
    if (done) continue;
    if (!cache.has(u.digestState!)) cache.set(u.digestState!, await digestText(u.digestState!, now));
    const text = cache.get(u.digestState!);
    if (!text) continue;
    try {
      await sender.send(u.phone!, text);
    } catch (e) {
      console.error("price digest failed", u.id, e);
      continue;
    }
    // Record the send as a read, already-texted alert so it shows in the alert history and is never sent twice.
    await db.alert.create({ data: { userId: u.id, kind: "PRICE_DIGEST", title: `Price digest for ${u.digestState}`, body: text, link: "/hub/prices", dedupeKey: key, readAt: new Date(), textedAt: new Date(), emailedAt: new Date() } });
    sent++;
  }
  return { sent };
}
