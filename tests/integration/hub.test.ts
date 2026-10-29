import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getBusiness, listRefineries, requestVerification, saveBusiness } from "@/server/hub/business";
import { browseListings, closeListing, createListing, getListing, matchesFor, updateListing } from "@/server/hub/listings";
import { listThreads, openThread, reply, sendEnquiry, unreadThreadCount } from "@/server/hub/messages";
import { decideVerification, reinstateBusiness, reportBusiness, suspendBusiness, verificationQueue } from "@/server/hub/moderation";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

const profile = (name: string, roles: ("SELLER" | "BUYER" | "DELIVERY" | "REFINERY")[], state = "Lagos") => ({ name, roles, state, registrationNumber: "RC 123" });
const offer = { kind: "OFFER" as const, title: "LPG in 20-tonne lots", products: ["lpg"], quantity: 20, unit: "tonnes" as const, state: "Lagos", areas: ["Lagos", "Kano"] };
const request = { kind: "REQUEST" as const, title: "Weekly LPG to Kano", products: ["lpg"], state: "Kano", areas: ["Lagos"] };

async function trader(name: string, roles: Parameters<typeof profile>[1], state?: string) {
  const u = await user();
  const b = await saveBusiness(u, profile(name, roles, state));
  return { u, b };
}

describe("trade hub businesses and listings", () => {
  it("lets any business post at once, but only the kinds its roles allow", async () => {
    const { u } = await trader("Ikeja Energy", ["SELLER"]);
    const l = await createListing(u, offer);
    expect(l.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    await expect(createListing(u, request)).rejects.toThrow(/matching role/);
    const viewer = await user();
    expect((await browseListings(viewer, { product: "lpg" })).map((x) => x.id)).toEqual([l.id]);
  });

  it("requires a business profile and a unit for any quantity", async () => {
    const nobody = await user();
    await expect(createListing(nobody, offer)).rejects.toThrow(/business profile/);
    const { u } = await trader("Ikeja Energy", ["SELLER"]);
    await expect(createListing(u, { ...offer, unit: "" })).rejects.toThrow(/unit/);
  });

  it("filters by location, including the areas a listing serves, and hides closed and expired listings", async () => {
    const { u } = await trader("Ikeja Energy", ["SELLER"]);
    const viewer = await user();
    const l = await createListing(u, offer);
    expect(await browseListings(viewer, { state: "Kano" })).toHaveLength(1);
    expect(await browseListings(viewer, { state: "Rivers" })).toHaveLength(0);
    await db.hubListing.update({ where: { id: l.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await browseListings(viewer, {})).toHaveLength(0);
    await expect(getListing(viewer, l.id)).rejects.toThrow(/expired/);
    expect((await getListing(u, l.id)).own).toBe(true);
    await updateListing(u, l.id, { ...offer, days: 7 });
    expect(await browseListings(viewer, {})).toHaveLength(1);
    await closeListing(u, l.id);
    expect(await browseListings(viewer, {})).toHaveLength(0);
  });

  it("does not let anyone else change a listing", async () => {
    const { u } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: other } = await trader("Other Energy", ["SELLER"]);
    const l = await createListing(u, offer);
    await expect(updateListing(other, l.id, offer)).rejects.toThrow(/not found/i);
    await expect(closeListing(other, l.id)).rejects.toThrow(/not found/i);
  });

  it("matches offers with buy requests and hauliers for the same product in overlapping places", async () => {
    const { u: s } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: b } = await trader("Kano Gas", ["BUYER"], "Kano");
    const { u: h } = await trader("Corridor Haulage", ["DELIVERY"], "Kaduna");
    const { u: far } = await trader("Port Harcourt Gas", ["BUYER"], "Rivers");
    const o = await createListing(s, offer);
    const r = await createListing(b, request);
    const d = await createListing(h, { kind: "DELIVERY", title: "LPG bullet trucks", products: ["lpg"], state: "Kaduna", areas: ["Lagos", "Kano"] });
    await createListing(far, { ...request, title: "LPG to Rivers", state: "Rivers", areas: [] });
    await createListing(s, { ...offer, title: "My second offer" });
    const m = await matchesFor(s, o);
    expect(m.map((x) => x.id).sort()).toEqual([r.id, d.id].sort());
  });

  it("keeps unverified businesses using a refiner's name hidden from others until verified", async () => {
    const admin = await user("ADMIN");
    const { u, b } = await trader("NNPC Gas Depot", ["SELLER"]);
    const l = await createListing(u, offer);
    const viewer = await user();
    expect(await browseListings(viewer, {})).toHaveLength(0);
    await expect(getBusiness(viewer, b.id)).rejects.toThrow(/not found/i);
    await expect(getListing(viewer, l.id)).rejects.toThrow();
    expect((await getBusiness(u, b.id)).id).toBe(b.id);
    await requestVerification(u);
    await decideVerification(admin, b.id, "VERIFY", "");
    expect(await browseListings(viewer, {})).toHaveLength(1);
  });

  it("removes the Verified badge when the name, registration or licences change", async () => {
    const admin = await user("ADMIN");
    const { u, b } = await trader("Ikeja Energy", ["SELLER"]);
    await requestVerification(u);
    expect(await verificationQueue(admin)).toHaveLength(1);
    await decideVerification(admin, b.id, "VERIFY", "");
    expect((await saveBusiness(u, { ...profile("Ikeja Energy", ["SELLER"]), about: "New description" })).verification).toBe("VERIFIED");
    const changed = await saveBusiness(u, profile("Ikeja Energy Ltd", ["SELLER"]));
    expect(changed.verification).toBe("UNVERIFIED");
    expect(changed.verificationNote).toMatch(/checked again/);
  });

  it("returns a verification request with a note, and only administrators can decide", async () => {
    const admin = await user("ADMIN");
    const editor = await user("EDITOR");
    const { u, b } = await trader("Ikeja Energy", ["SELLER"]);
    await requestVerification(u);
    await expect(decideVerification(editor, b.id, "VERIFY", "")).rejects.toThrow(/permission/);
    await expect(decideVerification(admin, b.id, "RETURN", "")).rejects.toThrow(/fix/);
    await decideVerification(admin, b.id, "RETURN", "CAC number does not match the name");
    const after = await db.hubBusiness.findUniqueOrThrow({ where: { id: b.id } });
    expect(after.verification).toBe("UNVERIFIED");
    expect(await db.alert.count({ where: { userId: u.id, kind: "HUB_VERIFICATION" } })).toBe(1);
  });

  it("lists only visible refineries, verified first", async () => {
    const admin = await user("ADMIN");
    const { b: a } = await trader("Alpha Modular Refinery", ["REFINERY"]);
    const { u: zu, b: z } = await trader("Zeta Refinery", ["REFINERY"]);
    await trader("NNPC Refinery Sales", ["REFINERY"]);
    await requestVerification(zu);
    await decideVerification(admin, z.id, "VERIFY", "");
    const viewer = await user();
    expect((await listRefineries(viewer)).map((r) => r.id)).toEqual([z.id, a.id]);
    expect((await listRefineries(viewer, { verifiedOnly: true })).map((r) => r.id)).toEqual([z.id]);
  });
});

describe("trade hub messaging", () => {
  it("keeps conversations private to the two businesses, and tracks unread", async () => {
    const { u: s, b: sb } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: b } = await trader("Kano Gas", ["BUYER"], "Kano");
    const { u: outsider } = await trader("Nosy Traders", ["BUYER"]);
    const admin = await user("ADMIN");
    const l = await createListing(s, offer);
    const t = await sendEnquiry(b, { businessId: sb.id, listingId: l.id, body: "Can you quote 20 tonnes delivered to Kano?" });
    expect(await unreadThreadCount(s)).toBe(1);
    expect(await unreadThreadCount(b)).toBe(0);
    await expect(openThread(outsider, t.id)).rejects.toThrow(/not found/i);
    await expect(openThread(admin, t.id)).rejects.toThrow(/not found/i);
    await expect(reply(outsider, t.id, "hello")).rejects.toThrow(/not found/i);

    const opened = await openThread(s, t.id);
    expect(opened.messages).toHaveLength(1);
    expect(await unreadThreadCount(s)).toBe(0);
    await reply(s, t.id, "Yes: NGN 1,150 per kg delivered.");
    expect(await unreadThreadCount(b)).toBe(1);
    const [thread] = await listThreads(b);
    expect(thread.counterpart).toBe("Ikeja Energy");
    expect(thread.unread).toBe(true);
  });

  it("reuses the conversation for a second enquiry and alerts once per unread spell", async () => {
    const { u: s, b: sb } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: b } = await trader("Kano Gas", ["BUYER"], "Kano");
    const l = await createListing(s, offer);
    const t1 = await sendEnquiry(b, { businessId: sb.id, listingId: l.id, body: "First" });
    const t2 = await sendEnquiry(b, { businessId: sb.id, listingId: l.id, body: "Second" });
    expect(t2.id).toBe(t1.id);
    expect(await db.hubMessage.count({ where: { threadId: t1.id } })).toBe(2);
    expect(await db.alert.count({ where: { userId: s.id, kind: "HUB_MESSAGE" } })).toBe(1);
    await openThread(s, t1.id);
    await sendEnquiry(b, { businessId: sb.id, listingId: l.id, body: "Third" });
    expect(await db.alert.count({ where: { userId: s.id, kind: "HUB_MESSAGE" } })).toBe(2);
    const alert = await db.alert.findFirstOrThrow({ where: { userId: s.id } });
    expect(alert.body).not.toMatch(/First|Second|Third/);
  });

  it("refuses enquiries without a profile, to yourself, or about another business's listing", async () => {
    const { u: s, b: sb } = await trader("Ikeja Energy", ["SELLER"]);
    const { b: ob } = await trader("Other Energy", ["SELLER"]);
    const l = await createListing(s, offer);
    const nobody = await user();
    await expect(sendEnquiry(nobody, { businessId: sb.id, listingId: l.id, body: "Hi" })).rejects.toThrow(/business profile/);
    await expect(sendEnquiry(s, { businessId: sb.id, body: "Hi" })).rejects.toThrow(/own business/);
    const { u: b } = await trader("Kano Gas", ["BUYER"]);
    await expect(sendEnquiry(b, { businessId: ob.id, listingId: l.id, body: "Hi" })).rejects.toThrow(/closed or expired/);
  });

  it("suspension hides a business, stops it sending, and stops others writing to it", async () => {
    const admin = await user("ADMIN");
    const { u: s, b: sb } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: b } = await trader("Kano Gas", ["BUYER"]);
    const l = await createListing(s, offer);
    const t = await sendEnquiry(b, { businessId: sb.id, listingId: l.id, body: "Pay you upfront?" });
    await reportBusiness(b, { businessId: sb.id, reason: "Asked for full payment in advance to a personal account." });
    await expect(reportBusiness(b, { businessId: sb.id, reason: "Reporting the same business again." })).rejects.toThrow(/already/);
    await suspendBusiness(admin, sb.id, "Advance-fee reports");
    expect(await browseListings(b, {})).toHaveLength(0);
    await expect(reply(s, t.id, "Please pay")).rejects.toThrow(/suspended/);
    await expect(reply(b, t.id, "Hello?")).rejects.toThrow(/suspended/);
    await expect(createListing(s, offer)).rejects.toThrow(/suspended/);
    expect((await openThread(b, t.id)).messages).toHaveLength(1);
    await reinstateBusiness(admin, sb.id);
    expect((await db.hubBusiness.findUniqueOrThrow({ where: { id: sb.id } })).verification).toBe("UNVERIFIED");
  });
});
