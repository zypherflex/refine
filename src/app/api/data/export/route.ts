import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { AppError } from "@/lib/errors";
import { exportIndexCsv } from "@/server/data/accounts";

/** CSV download of the price index for a signed-in data customer. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    const csv = await exportIndexCsv(user);
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="refinerylens-price-index-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status === 404 ? 404 : 402 });
    throw e;
  }
}
