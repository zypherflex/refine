import { NextResponse, type NextRequest } from "next/server";
import { clickThrough } from "@/server/sponsor";

/** Sponsored links go through here so clicks are counted; the sponsor's site opens without our session details. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.redirect(await clickThrough(id), { headers: { "Referrer-Policy": "no-referrer" } });
  } catch {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
}
