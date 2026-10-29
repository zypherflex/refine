import { NextResponse, type NextRequest } from "next/server";
import { NotFoundError } from "@/lib/errors";
import { getCurrentUser } from "@/server/auth";
import { tripView } from "@/server/tracking";

/** Live map data for a gas order or delivery job, for the people on either side of it. Polled by the map. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  const { kind, id } = await params;
  const ref = kind === "gas-order" ? ({ kind: "GAS_ORDER", id } as const) : kind === "job" ? ({ kind: "DELIVERY_JOB", id } as const) : null;
  if (!ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return NextResponse.json(await tripView(user, ref), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: "Not found" }, { status: 404 });
    throw e;
  }
}
