import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/server/auth";
import { registerDevice, unregisterDevice } from "@/server/services/alert-push";

/** Same-origin requests only: the app's own pages call this with the session cookie. */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  return !origin || new URL(origin).host === req.headers.get("host");
}

/** The store apps register and remove this phone's push token for the signed-in user. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  try {
    await registerDevice(user.id, (await req.json()) as never);
  } catch (e) {
    if (e instanceof ZodError || e instanceof SyntaxError) return NextResponse.json({ error: "Invalid device" }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: true });
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (body.token) await unregisterDevice(user.id, String(body.token));
  return NextResponse.json({ ok: true });
}
