import type { Role } from "@prisma/client";

/** Minimal identity used by every authorisation check. */
export type Actor = { id: string; role: Role };

const rank: Record<Role, number> = { USER: 0, ANALYST: 1, EDITOR: 2, ADMIN: 3 };

export function hasRole(actor: Actor | null | undefined, min: Role): boolean {
  return !!actor && rank[actor.role] >= rank[min];
}

export const can = {
  /** Draft analysis and submit it for review. */
  draftContent: (a: Actor | null) => hasRole(a, "ANALYST"),
  /** Approve sources, publish, correct, retract and supersede. */
  publish: (a: Actor | null) => hasRole(a, "EDITOR"),
  uploadPublicDocument: (a: Actor | null) => hasRole(a, "EDITOR"),
  manageUsers: (a: Actor | null) => hasRole(a, "ADMIN"),
  viewEditorial: (a: Actor | null) => hasRole(a, "ANALYST"),
  /** Verify, suspend and reinstate trade hub businesses and handle reports. Cannot read hub messages. */
  moderateHub: (a: Actor | null) => hasRole(a, "ADMIN"),
};

const PUBLIC_STATUSES = new Set(["PUBLISHED", "RETRACTED", "SUPERSEDED"]);

/** Readers see published items plus retracted/superseded ones (shown with a notice). Staff see drafts. */
export function canViewPublication(actor: Actor | null, status: string): boolean {
  if (PUBLIC_STATUSES.has(status)) return true;
  return hasRole(actor, "ANALYST");
}

type DocLike = { visibility: "PUBLIC" | "PRIVATE"; ownerId: string | null; status: string };

/**
 * Private documents belong to exactly one user. Nobody else can read them — including administrators —
 * so that personal research files never leak through support or moderation tooling.
 */
export function canAccessDocument(actor: Actor | null, doc: DocLike): boolean {
  if (!actor) return false;
  if (doc.visibility === "PRIVATE") return doc.ownerId === actor.id;
  if (doc.status === "APPROVED") return true;
  return hasRole(actor, "ANALYST");
}

export function canAccessThesis(actor: Actor | null, thesis: { ownerId: string }): boolean {
  return !!actor && thesis.ownerId === actor.id;
}
