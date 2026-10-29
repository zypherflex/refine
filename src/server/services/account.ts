import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { hasRole, type Actor } from "@/lib/permissions";
import { storage } from "../storage";
import { audit } from "../audit";

/**
 * Deletes an account and everything personal to it, as the app stores require (Apple 5.1.1(v), Google Play account
 * deletion policy): profile, sessions, private files, theses, watchlists, alerts, conversations, the trade hub business
 * with its listings, sites, prices, jobs, agreements and messages, payments records and phone tokens.
 * The audit log keeps its entries without the link to the person. Staff accounts are removed by an administrator,
 * because the editorial record must keep who reviewed what.
 */
export async function deleteAccount(actor: Actor, password: string, confirm: string) {
  const user = await db.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new AppError("Account not found.");
  if (hasRole(user, "ANALYST")) throw new AppError("Staff accounts are closed by an administrator. Ask an administrator to remove your access.");
  if (confirm.trim().toUpperCase() !== "DELETE") throw new AppError('Type DELETE to confirm.');
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new AppError("That password is not right.");

  const docs = await db.document.findMany({ where: { ownerId: user.id }, select: { id: true, storageKey: true, visibility: true } });
  const privateIds = docs.filter((d) => d.visibility === "PRIVATE").map((d) => d.id);
  await db.$transaction([
    // Detach anything that points at the person's private files, then remove the files' records.
    db.excerpt.updateMany({ where: { documentId: { in: privateIds } }, data: { documentId: null } }),
    db.metric.updateMany({ where: { documentId: { in: privateIds } }, data: { documentId: null } }),
    db.editorialReview.updateMany({ where: { documentId: { in: privateIds } }, data: { documentId: null } }),
    db.citation.updateMany({ where: { documentId: { in: privateIds } }, data: { documentId: null } }),
    db.document.deleteMany({ where: { id: { in: privateIds } } }),
    // Public documents a user once uploaded stay in the library, without an owner.
    db.document.updateMany({ where: { ownerId: user.id }, data: { ownerId: null } }),
    db.auditLog.updateMany({ where: { actorId: user.id }, data: { actorId: null } }),
    db.user.delete({ where: { id: user.id } }),
  ]);
  for (const d of docs) if (d.visibility === "PRIVATE" && d.storageKey) await storage().remove(d.storageKey).catch((e) => console.error("delete file", e));
  await audit(null, "user.delete_self", "User", user.id);
}
