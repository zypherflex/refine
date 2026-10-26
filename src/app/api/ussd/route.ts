import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { ussdConfigured, ussdReply } from "@/server/connect/ussd";
import { rateLimit } from "@/server/rate-limit";

/**
 * Africa's Talking USSD callback: a price check for basic phones. Configure the callback URL as
 * {APP_URL}/api/ussd?token={USSD_TOKEN}; requests without the token are refused.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const expected = process.env.USSD_TOKEN ?? "";
  if (!ussdConfigured() || token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const form = await req.formData();
  const phone = String(form.get("phoneNumber") ?? "");
  if (!rateLimit(`ussd:${phone}`, 30, 60 * 60_000)) return new NextResponse("END Too many requests. Try again later.", { headers: { "Content-Type": "text/plain" } });
  const reply = await ussdReply(String(form.get("text") ?? ""));
  return new NextResponse(reply, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
