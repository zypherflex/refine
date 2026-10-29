import { NextResponse, type NextRequest } from "next/server";
import { handleWebhook, paystackConfigured, validWebhookSignature } from "@/server/connect/paystack";

/** Paystack webhook. The signature is checked on the raw body before anything is parsed. */
export async function POST(req: NextRequest) {
  if (!paystackConfigured()) return new NextResponse("Not configured", { status: 404 });
  const raw = await req.text();
  if (!validWebhookSignature(raw, req.headers.get("x-paystack-signature"))) return new NextResponse("Invalid signature", { status: 401 });
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }
  try {
    await handleWebhook(event as never);
  } catch (e) {
    console.error("paystack webhook", e);
    // A non-2xx reply makes Paystack retry later.
    return new NextResponse("Retry", { status: 500 });
  }
  return NextResponse.json({ received: true });
}
