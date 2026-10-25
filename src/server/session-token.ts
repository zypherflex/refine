import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "rl_session";
export const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only a hash of the token is stored, so a database leak does not expose live sessions. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token + (process.env.SESSION_SECRET ?? "")).digest("hex");
}
