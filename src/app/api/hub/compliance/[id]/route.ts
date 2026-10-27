import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { recordFile } from "@/server/hub/compliance";

/** A scanned licence or certificate, for the business owner only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const f = user ? await recordFile(user, (await params).id) : null;
  if (!f) return new NextResponse("Not found", { status: 404 });
  const name = f.fileName.replace(/[^A-Za-z0-9._-]/g, "_") || "document";
  return new NextResponse(new Uint8Array(f.data), { headers: { "Content-Type": f.mimeType, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
