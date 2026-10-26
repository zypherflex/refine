import { callJson, ConnectorError } from "./http";

/**
 * SMS and WhatsApp delivery for alert copies and the morning price digest. One provider at a time, set by
 * TEXT_PROVIDER:
 * - termii: POST {TERMII_BASE_URL}/api/sms/send with the key in the body. Docs: https://developers.termii.com
 * - africastalking: POST https://api.africastalking.com/version1/messaging, form-encoded, apiKey header.
 *   Docs: https://developers.africastalking.com/docs/sms/sending
 * - whatsapp: Meta WhatsApp Cloud API with an approved template that takes the message as its one body parameter;
 *   free-form messages are only allowed inside a 24-hour customer window, so alerts use a template.
 *   Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

export type TextProvider = "termii" | "africastalking" | "whatsapp";
export type TextSender = { provider: TextProvider; send(to: string, message: string): Promise<void> };

let override: TextSender | null = null;
export function setTextSenderForTests(s: TextSender | null) {
  override = s;
}

export function textProvider(): TextProvider | null {
  const p = (process.env.TEXT_PROVIDER ?? "").toLowerCase();
  if (p === "termii" && process.env.TERMII_API_KEY && process.env.TERMII_SENDER_ID) return "termii";
  if (p === "africastalking" && process.env.AT_USERNAME && process.env.AT_API_KEY) return "africastalking";
  if (p === "whatsapp" && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE) return "whatsapp";
  return null;
}

/** Nigerian numbers in international form: 08012345678 or 2348012345678 become +2348012345678. */
export function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  let d = digits.startsWith("+") ? digits.slice(1) : digits;
  if (/^0[789][01]\d{8}$/.test(d)) d = `234${d.slice(1)}`;
  if (/^234[789][01]\d{8}$/.test(d)) return `+${d}`;
  // Other countries: accept a full international number of 8 to 15 digits.
  if (digits.startsWith("+") && /^\d{8,15}$/.test(d)) return `+${d}`;
  return null;
}

/** SMS segments get expensive; keep each message to two segments. */
export function clip(message: string, max = 300) {
  return message.length <= max ? message : `${message.slice(0, max - 1)}…`;
}

const senders: Record<TextProvider, (to: string, message: string) => Promise<void>> = {
  async termii(to, message) {
    const base = (process.env.TERMII_BASE_URL ?? "https://api.ng.termii.com").replace(/\/$/, "");
    const res = await callJson<{ code?: string; message?: string }>("Termii", `${base}/api/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: to.replace(/^\+/, ""), from: process.env.TERMII_SENDER_ID, sms: message, type: "plain", channel: process.env.TERMII_CHANNEL ?? "generic", api_key: process.env.TERMII_API_KEY }),
    });
    if (res.code && res.code !== "ok") throw new ConnectorError("Termii", res.message ?? res.code);
  },
  async africastalking(to, message) {
    const host = process.env.AT_USERNAME === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
    const body = new URLSearchParams({ username: process.env.AT_USERNAME!, to, message });
    if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);
    const res = await callJson<{ SMSMessageData?: { Recipients?: { status: string }[] } }>("Africa's Talking", `${host}/version1/messaging`, {
      method: "POST",
      headers: { apiKey: process.env.AT_API_KEY!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const status = res.SMSMessageData?.Recipients?.[0]?.status;
    if (status && status !== "Success") throw new ConnectorError("Africa's Talking", status);
  },
  async whatsapp(to, message) {
    const version = process.env.WHATSAPP_API_VERSION ?? "v23.0";
    await callJson("WhatsApp", `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: { name: process.env.WHATSAPP_TEMPLATE, language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "en" }, components: [{ type: "body", parameters: [{ type: "text", text: message }] }] },
      }),
    });
  },
};

export function getTextSender(): TextSender | null {
  if (override) return override;
  const p = textProvider();
  return p ? { provider: p, send: (to, message) => senders[p](to, clip(message)) } : null;
}
