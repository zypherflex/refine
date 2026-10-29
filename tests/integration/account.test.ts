import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { deleteAccount } from "@/server/services/account";
import { saveBusiness } from "@/server/hub/business";
import { createListing } from "@/server/hub/listings";
import { sendEnquiry } from "@/server/hub/messages";
import { registerDevice } from "@/server/services/alert-push";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

async function withPassword(role: "USER" | "EDITOR" = "USER") {
  const u = await user(role);
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash("correct horse", 4) } });
  return u;
}

describe("account deletion", () => {
  it("deletes the account with its business, posts, messages, files and devices, keeping logs without the link", async () => {
    const u = await withPassword();
    const other = await user();
    const b = await saveBusiness(u, { name: "Ikeja Energy", roles: ["SELLER"], state: "Lagos" });
    const ob = await saveBusiness(other, { name: "Kano Gas", roles: ["BUYER"], state: "Kano" });
    const l = await createListing(u, { kind: "OFFER", title: "LPG in 20-tonne lots", products: ["lpg"], state: "Lagos" });
    await sendEnquiry(other, { businessId: b.id, listingId: l.id, body: "Price?" });
    await sendEnquiry(u, { businessId: ob.id, body: "Do you need supply?" });
    await registerDevice(u.id, { token: "t".repeat(40), platform: "android" });
    await db.document.create({ data: { title: "My notes", visibility: "PRIVATE", ownerId: u.id, status: "APPROVED" } });
    await db.auditLog.create({ data: { actorId: u.id, action: "test", entityType: "User", entityId: u.id } });

    await expect(deleteAccount(u, "wrong", "DELETE")).rejects.toThrow(/password/);
    await expect(deleteAccount(u, "correct horse", "delete it")).rejects.toThrow(/DELETE/);
    await deleteAccount(u, "correct horse", "delete");

    expect(await db.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await db.hubBusiness.count({ where: { id: b.id } })).toBe(0);
    expect(await db.hubListing.count()).toBe(0);
    expect(await db.hubThread.count()).toBe(0);
    expect(await db.deviceToken.count()).toBe(0);
    expect(await db.document.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "test", actorId: null } })).toBe(1);
    expect(await db.hubBusiness.count({ where: { id: ob.id } })).toBe(1); // the other business is untouched
  });

  it("refuses staff accounts, which an administrator closes", async () => {
    const editor = await withPassword("EDITOR");
    await expect(deleteAccount(editor, "correct horse", "DELETE")).rejects.toThrow(/administrator/);
  });
});
