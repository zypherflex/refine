import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addOutlet, getOutlet, reportOutlet } from "@/server/everyday/outlets";
import { flagContent, flagQueue, openFlagCount, resolveFlags, setReportingBlocked } from "@/server/everyday/moderation";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

async function setup() {
  const author = await user();
  const o = await addOutlet(author, { name: "MRS Ojuelegba", kind: "FILLING_STATION", state: "Lagos", area: "Surulere" });
  const r = await reportOutlet(author, o.id, { kind: "PROBLEM", problem: "OTHER", note: "The attendant Chidi is a thief" });
  return { author, o, r };
}

describe("flagging station reports and places", () => {
  it("hides a report once three different people flag it, and refuses own or repeated flags", async () => {
    const { author, o, r } = await setup();
    await expect(flagContent(author, { target: "REPORT", id: r.id, reason: "ABUSIVE" })).rejects.toThrow(/your own/);
    const [a, b, c] = [await user(), await user(), await user()];
    await flagContent(a, { target: "REPORT", id: r.id, reason: "ABUSIVE", note: "Names a person" });
    await expect(flagContent(a, { target: "REPORT", id: r.id, reason: "WRONG" })).rejects.toThrow(/already flagged/);
    await flagContent(b, { target: "REPORT", id: r.id, reason: "ABUSIVE" });
    expect((await getOutlet(o.id)).recent).toHaveLength(1);
    await flagContent(c, { target: "REPORT", id: r.id, reason: "WRONG" });
    expect((await getOutlet(o.id)).recent).toHaveLength(0);
    expect(await openFlagCount()).toBe(1);
    await expect(flagContent(await user(), { target: "OUTLET", id: o.id, reason: "NOT_A_REASON" as never })).rejects.toThrow();
  });

  it("never hides a place automatically; an administrator decides", async () => {
    const { o } = await setup();
    for (let i = 0; i < 4; i++) await flagContent(await user(), { target: "OUTLET", id: o.id, reason: "CLOSED" });
    expect((await db.outlet.findUnique({ where: { id: o.id } }))!.hidden).toBe(false);
    const admin = await user("ADMIN");
    const [g] = await flagQueue(admin);
    expect(g).toMatchObject({ target: "OUTLET", id: o.id });
    expect(g.flags).toHaveLength(4);
    await resolveFlags(admin, "OUTLET", o.id, "HIDE");
    expect((await db.outlet.findUnique({ where: { id: o.id } }))!.hidden).toBe(true);
    expect(await openFlagCount()).toBe(0);
  });

  it("an administrator restores a wrongly hidden report; only administrators moderate", async () => {
    const { r } = await setup();
    for (let i = 0; i < 3; i++) await flagContent(await user(), { target: "REPORT", id: r.id, reason: "WRONG" });
    const someone = await user();
    await expect(resolveFlags(someone, "REPORT", r.id, "RESTORE")).rejects.toThrow();
    await expect(flagQueue(someone)).rejects.toThrow();
    const admin = await user("ADMIN");
    await resolveFlags(admin, "REPORT", r.id, "RESTORE");
    expect((await db.outletReport.findUnique({ where: { id: r.id } }))!.hidden).toBe(false);
    expect(await db.contentFlag.count({ where: { status: "DISMISSED" } })).toBe(3);
  });

  it("a blocked person can no longer add places or report, until unblocked", async () => {
    const { author, o } = await setup();
    const admin = await user("ADMIN");
    await setReportingBlocked(admin, author.id, true);
    await expect(reportOutlet(author, o.id, { kind: "PROBLEM", problem: "OTHER" })).rejects.toThrow(/can no longer/);
    await expect(addOutlet(author, { name: "Another", kind: "GAS_RETAILER", state: "Lagos", area: "Yaba" })).rejects.toThrow(/can no longer/);
    await setReportingBlocked(admin, author.id, false);
    await reportOutlet(author, o.id, { kind: "AVAILABILITY", item: "pms_retail_litre", available: true, queue: "NONE" });
    await expect(setReportingBlocked(admin, admin.id, true)).rejects.toThrow(/yourself/);
  });
});
