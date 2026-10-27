import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { attentionCounts } from "@/server/admin/attention";
import { overviewStats, dailySeries } from "@/server/admin/overview";
import { revokeSessions, searchUsers, setUserPlan, userDetail } from "@/server/admin/users";
import { adminCloseListing, adminCancelJob, listBusinesses, listJobs, listListings } from "@/server/admin/hub";
import { listPayments } from "@/server/admin/money";
import { jobHealth } from "@/server/admin/system";
import { recentBroadcasts } from "@/server/admin/broadcast";
import { adminCancelOrder, listOrdersAdmin, listOutletsAdmin, listTrips, mergeOutlets, priceWatch, updateOutlet } from "@/server/admin/everyday";
import { countRecipients, sendBroadcast } from "@/server/admin/broadcast";
import { buildExport, csvCell } from "@/server/admin/exports";
import { retryFailedJobs, searchAudit } from "@/server/admin/system";
import { saveBusiness } from "@/server/hub/business";
import { createListing } from "@/server/hub/listings";
import { addOutlet, reportOutlet } from "@/server/everyday/outlets";
import { placeOrder, saveHomeDelivery } from "@/server/everyday/orders";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

describe("admin console guard", () => {
  it("refuses every tool to non-administrators", async () => {
    const editor = await user("EDITOR");
    for (const call of [
      () => attentionCounts(editor), () => overviewStats(editor), () => searchUsers(editor, { page: 1 }), () => listBusinesses(editor, { page: 1 }),
      () => priceWatch(editor, {}), () => countRecipients(editor, "all"), () => buildExport(editor, "users"), () => searchAudit(editor, { page: 1 }),
    ]) await expect(call()).rejects.toThrow(/permission/);
  });
});

describe("people tools", () => {
  it("searches users, shows a person without their password, changes plan and signs them out everywhere", async () => {
    const admin = await user("ADMIN");
    const u = await db.user.create({ data: { email: "kemi@example.com", name: "Kemi Adebayo", passwordHash: "secret-hash", audience: "PERSONAL", homeState: "Lagos" } });
    await db.session.create({ data: { userId: u.id, tokenHash: "t1", expiresAt: new Date(Date.now() + 86_400_000) } });
    expect((await searchUsers(admin, { q: "kemi", page: 1 })).rows.map((r) => r.id)).toEqual([u.id]);
    expect((await searchUsers(admin, { audience: "PERSONAL", state: "Lagos", page: 1 })).total).toBe(1);
    const d = await userDetail(admin, u.id);
    expect(d.user).not.toHaveProperty("passwordHash");
    expect(d.sessions).toHaveLength(1);
    await setUserPlan(admin, u.id, "PRO");
    expect(await revokeSessions(admin, u.id)).toBe(1);
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    const logs = await searchAudit(admin, { action: "user.", entityId: u.id, page: 1 });
    expect(logs.rows.map((l) => l.action).sort()).toEqual(["user.change_plan", "user.sign_out_everywhere"]);
  });
});

describe("hub and everyday tools", () => {
  it("takes down a listing and cancels a job with a reason the business is told", async () => {
    const admin = await user("ADMIN");
    const owner = await user();
    await saveBusiness(owner, { name: "Ikeja Energy", roles: ["SELLER", "BUYER"], state: "Lagos" });
    const l = await createListing(owner, { kind: "OFFER", title: "Diesel, 33,000 litres", products: ["ago"], state: "Lagos" });
    await expect(adminCloseListing(admin, l.id, "no")).rejects.toThrow(/reason/);
    await adminCloseListing(admin, l.id, "Price not allowed in the title");
    expect((await db.hubListing.findUnique({ where: { id: l.id } }))!.status).toBe("CLOSED");
    expect(await db.alert.count({ where: { userId: owner.id, title: "Your listing was taken down" } })).toBe(1);
    const b = await db.hubBusiness.findFirstOrThrow({ where: { ownerId: owner.id } });
    const job = await db.deliveryJob.create({ data: { posterId: b.id, title: "Load", products: ["ago"], quantity: 1, unit: "litres", fromState: "Lagos", toState: "Ogun", pickupDate: new Date() } });
    await adminCancelJob(admin, job.id, "Poster asked us to close it");
    await expect(adminCancelJob(admin, job.id, "Again please")).rejects.toThrow(/already closed/);
  });

  it("edits and merges stations, and flags prices far from the median", async () => {
    const admin = await user("ADMIN");
    const people = [await user(), await user(), await user(), await user()];
    const a = await addOutlet(people[0], { name: "MRS Ojuelegba", kind: "FILLING_STATION", state: "Lagos", area: "Surulere" });
    const dup = await addOutlet(people[1], { name: "M.R.S Ojuelegba", kind: "FILLING_STATION", state: "Lagos", area: "Surulere" });
    for (const [i, p] of [940, 950, 960].entries()) await reportOutlet(people[i], a.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: p });
    await reportOutlet(people[3], dup.id, { kind: "PRICE", item: "pms_retail_litre", priceNaira: 1400 });
    const watch = await priceWatch(admin, { state: "Lagos" });
    expect(watch.suspicious.map((x) => x.r.priceNaira)).toEqual([1400]);
    const before = await listOutletsAdmin(admin, { state: "Lagos", page: 1 });
    expect(before.total).toBe(2);
    expect(before.rows[0]._count).toEqual({ reports: expect.any(Number), contentFlags: 0 });
    expect(await mergeOutlets(admin, dup.id, a.id)).toBe(1);
    expect((await db.outlet.findUnique({ where: { id: dup.id } }))!.hidden).toBe(true);
    expect(await db.outletReport.count({ where: { outletId: a.id } })).toBe(4);
    await expect(mergeOutlets(admin, a.id, a.id)).rejects.toThrow(/different place/);
    await updateOutlet(admin, a.id, { name: "MRS Ojuelegba Road", kind: "FILLING_STATION", area: "Surulere" });
    expect((await db.outlet.findUnique({ where: { id: a.id } }))!.name).toBe("MRS Ojuelegba Road");
  });

  it("cancels a stuck gas order and tells both sides; stuck orders show in the attention counts", async () => {
    const admin = await user("ADMIN");
    const seller = await user();
    const b = await saveBusiness(seller, { name: "Surulere Gas", roles: ["SELLER"], state: "Lagos" });
    await saveHomeDelivery(seller, { homeDelivery: true, deliveryStates: ["Lagos"], homePricePerKg: 1300 });
    await db.hubBusiness.update({ where: { id: b.id }, data: { verification: "VERIFIED" } });
    const buyer = await user();
    const o = await placeOrder(buyer, { businessId: b.id, cylinderKg: 12.5, cylinders: 1, state: "Lagos", area: "Yaba", address: "3 Herbert Macaulay Way", phone: "08031234567" });
    expect((await attentionCounts(admin)).stuckOrders).toBe(0);
    await db.gasOrder.update({ where: { id: o.id }, data: { createdAt: new Date(Date.now() - 3 * 3_600_000) } });
    expect((await attentionCounts(admin)).stuckOrders).toBe(1);
    await adminCancelOrder(admin, o.id, "Seller did not answer for 3 hours");
    expect((await db.gasOrder.findUnique({ where: { id: o.id } }))!.status).toBe("CANCELLED");
    expect(await db.alert.count({ where: { dedupeKey: { startsWith: "order:admin-cancel" } } })).toBe(2);
    expect((await dailySeries(admin, 3)).orders.reduce((a, d) => a + d.n, 0)).toBe(1); // moved back 3 h, still within the 3 days
  });
});

describe("broadcast, exports and jobs", () => {
  it("sends to the counted segment only, refusing a stale count or a repeat", async () => {
    const admin = await user("ADMIN");
    for (const s of ["Lagos", "Lagos", "Kano"]) await db.user.create({ data: { email: `${Math.random()}@x.ng`, name: "H", passwordHash: "x", audience: "PERSONAL", homeState: s } });
    expect(await countRecipients(admin, "households", "Lagos")).toBe(2);
    const input = { segment: "households" as const, state: "Lagos", title: "Gas prices fell", body: "Cooking gas is cheaper in Lagos this week.", link: "/today?state=Lagos" };
    await expect(sendBroadcast(admin, { ...input, confirmCount: 3 })).rejects.toThrow(/now has 2/);
    await expect(sendBroadcast(admin, { ...input, link: "https://evil.example", confirmCount: 2 })).rejects.toThrow(/inside RefineryLens/);
    const b = await sendBroadcast(admin, { ...input, confirmCount: 2 });
    expect(b.recipients).toBe(2);
    expect(await db.alert.count({ where: { kind: "BROADCAST" } })).toBe(2);
    await expect(sendBroadcast(admin, { ...input, confirmCount: 2 })).rejects.toThrow(/last hour/);
  });

  it("exports CSV safely and logs each export", async () => {
    const admin = await user("ADMIN");
    await db.user.create({ data: { email: "a@x.ng", name: '=HYPERLINK("http://x")', passwordHash: "never-exported" } });
    const out = (await buildExport(admin, "users"))!;
    expect(out.csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(out.csv).not.toContain("never-exported");
    expect(await buildExport(admin, "nope")).toBeNull();
    expect(await db.auditLog.count({ where: { action: "admin.export" } })).toBe(1);
    expect(csvCell(-12.5)).toBe("-12.5");
    expect(csvCell("a,b")).toBe('"a,b"');
  });

  it("retries failed background jobs", async () => {
    const admin = await user("ADMIN");
    await db.job.create({ data: { type: "extract", payload: {}, status: "FAILED", attempts: 3, error: "boom" } });
    expect(await retryFailedJobs(admin)).toBe(1);
    expect((await db.job.findFirstOrThrow()).status).toBe("QUEUED");
  });
});

describe("every admin list query runs", () => {
  it("returns results for each directory with default filters", async () => {
    const admin = await user("ADMIN");
    const lists = await Promise.all([
      searchUsers(admin, { page: 1 }), listBusinesses(admin, { page: 1, plan: "expiring" }), listListings(admin, { page: 1, status: "LIVE" }), listJobs(admin, { page: 1, stale: "yes" }),
      listOutletsAdmin(admin, { page: 1, hidden: "yes" }), listOrdersAdmin(admin, { page: 1, view: "stuck" }), listPayments(admin, { page: 1 }),
    ]);
    for (const l of lists) expect(l.total).toBeGreaterThanOrEqual(0);
    expect(await listTrips(admin, { stale: "yes" })).toEqual([]);
    expect((await jobHealth(admin)).failed).toEqual([]);
    expect(await recentBroadcasts(admin)).toEqual([]);
    expect((await searchAudit(admin, { from: "2026-01-01", to: "2026-12-31", page: 1 })).total).toBeGreaterThanOrEqual(0);
  });
});
