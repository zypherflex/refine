import { ForbiddenError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";

/** Every admin tool checks this itself, so a server action cannot be called around the admin pages. */
export function requireAdmin(actor: Actor) {
  if (!can.manageUsers(actor)) throw new ForbiddenError();
}

export const PAGE_SIZE = 50;

/** Page number from a query string, starting at 1. */
export const pageOf = (p?: string) => Math.max(1, Math.min(1000, Number.parseInt(p ?? "1", 10) || 1));
