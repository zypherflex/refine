import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { hasRole } from "@/lib/permissions";
import { buildExport } from "@/server/admin/exports";

/** Downloads one admin export as CSV. Each download is recorded in the audit log. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const user = await getCurrentUser();
  if (!user || !hasRole(user, "ADMIN")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { name } = await params;
  const out = await buildExport(user, name);
  if (!out) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(out.csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="refinerylens-${name}-${day}.csv"`, "Cache-Control": "no-store" },
  });
}
