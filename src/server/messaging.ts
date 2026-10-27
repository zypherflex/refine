import { db } from "@/lib/db";
import { integrationStatus } from "./integrations";

export type TextChannel = "SMS" | "WHATSAPP";
export type TextMessage = { channel: TextChannel; to: string; body: string };
export type Messenger = { send(msg: TextMessage): Promise<{ id: string }> };

let override: Messenger | null = null;

/** Tests replace the transport so no network is needed. */
export function setMessengerForTests(m: Messenger | null) {
  override = m;
}

export function channelAvailable(channel: TextChannel): boolean {
  if (override) return true;
  const m = integrationStatus().messaging;
  return channel === "SMS" ? m.sms : m.whatsapp;
}

/** Normalises Nigerian numbers to E.164: 0803… and 234803… become +234803…. Returns null when it is not a phone number. */
export function toE164(raw: string): string | null {
  const d = raw.replace(/[^0-9+]/g, "");
  let n = d;
  if (/^0[789]\d{9}$/.test(d)) n = `+234${d.slice(1)}`;
  else if (/^234\d{10}$/.test(d)) n = `+${d}`;
  return /^\+[1-9]\d{7,14}$/.test(n) ? n : null;
}

/** Twilio's Messages API, called with fetch so no SDK is needed. TWILIO_API_BASE exists only for tests. */
function twilio(): Messenger {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const base = (process.env.TWILIO_API_BASE ?? "https://api.twilio.com").replace(/\/$/, "");
  return {
    async send(msg) {
      const from = msg.channel === "SMS" ? process.env.TWILIO_SMS_FROM! : `whatsapp:${process.env.TWILIO_WHATSAPP_FROM!.replace(/^whatsapp:/, "")}`;
      const to = msg.channel === "SMS" ? msg.to : `whatsapp:${msg.to}`;
      const res = await fetch(`${base}/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ From: from, To: to, Body: msg.body }),
      });
      const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (!res.ok) throw new Error(`Twilio ${res.status}: ${json.message ?? "request failed"}`);
      return { id: json.sid ?? "" };
    },
  };
}

function messenger(): Messenger | null {
  if (override) return override;
  const p = (process.env.MESSAGING_PROVIDER ?? "").toLowerCase();
  return p === "twilio" ? twilio() : null;
}

/** Sends one text and records the attempt. Never throws: returns false when the channel is off or the send failed. */
export async function sendText(userId: string | null, msg: TextMessage): Promise<boolean> {
  const m = messenger();
  if (!m || !channelAvailable(msg.channel)) return false;
  const row = await db.outboundMessage.create({ data: { userId, channel: msg.channel, to: msg.to, body: msg.body } });
  try {
    const { id } = await m.send(msg);
    await db.outboundMessage.update({ where: { id: row.id }, data: { status: "SENT", providerId: id, sentAt: new Date() } });
    return true;
  } catch (e) {
    await db.outboundMessage.update({ where: { id: row.id }, data: { status: "FAILED", error: (e as Error).message.slice(0, 500) } });
    return false;
  }
}
