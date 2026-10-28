import { NextResponse, type NextRequest } from "next/server";
import { handleStripeEvent, validStripeSignature } from "@/server/connect/stripe";

/** Stripe webhooks (checkout.session.*). The raw body is checked against Stripe-Signature before anything is read. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!validStripeSignature(raw, req.headers.get("stripe-signature"))) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  try {
    await handleStripeEvent(JSON.parse(raw));
  } catch (e) {
    console.error("stripe webhook", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
