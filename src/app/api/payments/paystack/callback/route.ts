import { NextResponse, type NextRequest } from "next/server";
import { verifyAndSettle } from "@/server/connect/paystack";

/** Paystack sends the customer back here with ?reference=; the plan changes only after verifying with Paystack. */
export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference") ?? req.nextUrl.searchParams.get("trxref") ?? "";
  const base = (process.env.APP_URL ?? req.nextUrl.origin).replace(/\/$/, "");
  try {
    const r = await verifyAndSettle(reference);
    return NextResponse.redirect(`${base}/settings?payment=${r.ok ? "success" : "failed"}`);
  } catch {
    return NextResponse.redirect(`${base}/settings?payment=failed`);
  }
}
