import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { AppError, NotFoundError } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit";
import { driverDelivered, recordPing, stopSharing, TripEndedError } from "@/server/tracking";

function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || new URL(origin).host === req.headers.get("host");
}

/**
 * The driver page posts positions (`ping`), stops sharing (`stop`) or marks a gas order delivered (`delivered`). The
 * link's secret is the only credential, so drivers need no account. 410 tells the page the delivery has ended.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string; action: string }> }) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { token, action } = await params;
  if (!rateLimit(`drive:${token}`, 30, 60_000)) return NextResponse.json({ error: "Too many updates" }, { status: 429 });
  try {
    if (action === "ping") return NextResponse.json(await recordPing(token, (await req.json()) as never));
    if (action === "stop") await stopSharing(token);
    else if (action === "delivered") await driverDelivered(token);
    else return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TripEndedError) return NextResponse.json({ error: e.message, ended: true }, { status: 410 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    if (e instanceof ZodError || e instanceof SyntaxError) return NextResponse.json({ error: "Invalid position" }, { status: 400 });
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
