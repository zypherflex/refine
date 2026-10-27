import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { buildVendorPack } from "@/server/hub/vendorpack";

/** The signed-in business owner's own vendor pack. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  try {
    const { bytes, fileName } = await buildVendorPack(user);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (e) {
    if (e instanceof AppError) return new NextResponse(e.message, { status: 400 });
    throw e;
  }
}
