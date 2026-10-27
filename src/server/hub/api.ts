import { NextResponse } from "next/server";
import { rateLimit } from "../rate-limit";
import { userForApiKey } from "./priceindex";

/** JSON helpers for the price intelligence API. Responses are private and never cached by shared caches. */
export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

/** Authenticates `Authorization: Bearer rl_live_…` and applies 600 requests per hour per key. */
export async function apiUser(req: Request) {
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!key) return { error: json({ error: "Send your API key as: Authorization: Bearer rl_live_…" }, 401) };
  const user = await userForApiKey(key);
  if (!user) return { error: json({ error: "Key not recognised, revoked, or the subscription has ended." }, 401) };
  if (!rateLimit(`api:${key.slice(0, 20)}`, 600, 3_600_000)) return { error: json({ error: "Rate limit: 600 requests an hour." }, 429) };
  return { user };
}
