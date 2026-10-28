import { NextResponse, type NextRequest } from "next/server";
import { verifyStripeReturn } from "@/server/connect/stripe";
import { returnPage } from "@/server/connect/return-page";

/** Stripe sends the customer back here; access changes only after the session is fetched from Stripe. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const base = (process.env.APP_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  try {
    const ref = q.get("ref") ?? "";
    const r = await verifyStripeReturn(ref, q.get("session_id") ?? "");
    return NextResponse.redirect(`${base}${await returnPage(ref, "purpose" in r ? r.purpose : undefined)}?payment=${r.ok ? "success" : "failed"}`);
  } catch {
    return NextResponse.redirect(`${base}/account/data?payment=failed`);
  }
}
