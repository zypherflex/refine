import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth";
import { hasPriceData, historyCsv, MAX_WEEKS, priceHistory } from "@/server/hub/priceindex";

/** CSV export of the price index, for price data subscribers. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  const u = await db.user.findUnique({ where: { id: user.id } });
  if (!hasPriceData(u)) return new NextResponse("CSV export comes with a price data subscription.", { status: 403 });
  const p = new URL(req.url).searchParams;
  const product = p.get("product") ?? "";
  const state = p.get("state") ?? "NG";
  try {
    const points = await priceHistory({ product, state, weeks: MAX_WEEKS });
    return new NextResponse(historyCsv(product, state, points), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="refinerylens-${product}-${state}-weekly-medians.csv"`, "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    if (e instanceof ZodError) return new NextResponse("Unknown product or state", { status: 400 });
    throw e;
  }
}
