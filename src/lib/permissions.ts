import type { Role } from "@prisma/client";

/** Minimal identity used by every authorisation check. */
export type Actor = { id: string; role: Role };

const rank: Record<Role, number> = { USER: 0, ANALYST: 1, EDITOR: 2, ADMIN: 3 };

export function hasRole(actor: Actor | null | undefined, min: Role): boolean {
  return !!actor && rank[actor.role] >= rank[min];
}

export const can = {
  manageUsers: (a: Actor | null) => hasRole(a, "ADMIN"),
  /** See market data from sources still awaiting approval, to check it first. */
  viewEditorial: (a: Actor | null) => hasRole(a, "ANALYST"),
  /** Verify, suspend and reinstate trade hub businesses and handle reports. Cannot read hub messages. */
  moderateHub: (a: Actor | null) => hasRole(a, "ADMIN"),
};
