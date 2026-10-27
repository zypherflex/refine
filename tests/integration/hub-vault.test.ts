import { beforeEach, describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "@/lib/db";
import { saveBusiness } from "@/server/hub/business";
import { reportPrice } from "@/server/hub/prices";
import { addRecord, recordFile, removeRecord, renewRecord, sendComplianceReminders, sniffScan } from "@/server/hub/compliance";
import { buildVendorPack } from "@/server/hub/vendorpack";
import { addThreshold, checkThresholds } from "@/server/hub/thresholds";
import { setPriceDataAccess } from "@/server/hub/priceindex";
import { complianceStatus, dueStage } from "@/lib/hub/compliance";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

const DAY = 86_400_000;
const PDF = Buffer.from("%PDF-1.4\n% test\n");

async function biz(roles: string[] = ["SELLER"], name = `Biz ${Math.random().toString(36).slice(2, 7)}`) {
  const u = await user();
  const b = await saveBusiness(u, { name, roles: roles as never, products: ["LPG"], state: "LA", phone: "+234 800 000 0000", cacNumber: "RC 123" });
  return { u, b };
}

describe("compliance rules", () => {
  it("works out status and the reminder stage from the expiry date", () => {
    const now = new Date("2026-10-27T10:00:00Z");
    const d = (s: string) => new Date(`${s}T00:00:00Z`);
    expect(complianceStatus(null, now)).toBe("NO_EXPIRY");
    expect(complianceStatus(d("2027-03-01"), now)).toBe("VALID");
    expect(complianceStatus(d("2026-12-01"), now)).toBe("EXPIRING");
    expect(complianceStatus(d("2026-10-26"), now)).toBe("EXPIRED");
    expect(dueStage(d("2027-03-01"), now)).toBeNull();
    expect(dueStage(d("2026-12-20"), now)).toBe(60);
    expect(dueStage(d("2026-11-20"), now)).toBe(30);
    expect(dueStage(d("2026-11-01"), now)).toBe(7);
    expect(dueStage(d("2026-10-27"), now)).toBe(0);
  });

  it("accepts PDF, PNG and JPEG by content only", () => {
    expect(sniffScan(PDF)?.ext).toBe("pdf");
    expect(sniffScan(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2]))?.ext).toBe("jpg");
    expect(() => sniffScan(Buffer.from("MZ\x90\x00 not a scan"))).toThrow(/PDF, PNG or JPEG/);
  });
});

describe("compliance vault", () => {
  it("keeps scans private to the owner and validates dates", async () => {
    const { u } = await biz();
    const stranger = await biz();
    const admin = await user("ADMIN");
    await expect(addRecord(u, { kind: "NMDPRA", number: "X1" })).rejects.toThrow(/expiry date/);
    await expect(addRecord(u, { kind: "NMDPRA", issuedOn: new Date("2026-06-01"), expiresOn: new Date("2026-05-01") })).rejects.toThrow(/after the issue date/);
    const r = await addRecord(u, { kind: "NMDPRA", number: "NMDPRA/1", expiresOn: new Date(Date.now() + 200 * DAY) }, { name: "licence.pdf", data: PDF });
    expect(r.storageKey).toMatch(/^compliance\//);
    expect(r.title).toBe("NMDPRA licence or permit");
    expect((await recordFile(u, r.id))?.data.equals(PDF)).toBe(true);
    expect(await recordFile(stranger.u, r.id)).toBeNull();
    expect(await recordFile(admin, r.id)).toBeNull();
    await expect(removeRecord(stranger.u, r.id)).rejects.toThrow(/not found/i);
    await addRecord(u, { kind: "CAC", number: "RC 123" });
    await removeRecord(u, r.id);
    expect(await db.complianceRecord.count()).toBe(1);
  });

  it("reminds at 60, 30 and 7 days and on expiry, once each, and starts again after a renewal", async () => {
    const { u } = await biz();
    const now = new Date("2026-10-27T08:00:00Z");
    const r = await addRecord(u, { kind: "FIRE", expiresOn: new Date("2026-12-20") }, null, now);
    const at = (iso: string) => sendComplianceReminders(new Date(`${iso}T08:00:00Z`));
    expect((await at("2026-10-01")).sent).toBe(0);
    expect((await at("2026-10-27")).sent).toBe(1); // 54 days: 60-day stage
    expect((await at("2026-10-28")).sent).toBe(0);
    expect((await at("2026-11-25")).sent).toBe(1); // 25 days: 30-day stage
    expect((await at("2026-12-19")).sent).toBe(1); // 1 day: 7-day stage
    expect((await at("2026-12-21")).sent).toBe(1); // expired
    expect((await at("2026-12-30")).sent).toBe(0);
    const alerts = await db.alert.findMany({ where: { userId: u.id, kind: "COMPLIANCE" }, orderBy: { createdAt: "asc" } });
    expect(alerts.map((a) => a.title)).toEqual([
      "Fire safety certificate expires in about two months", "Fire safety certificate expires in about a month",
      "Fire safety certificate expires within a week", "Fire safety certificate has expired",
    ]);
    await expect(renewRecord(u, { id: r.id, expiresOn: new Date("2026-12-01") })).rejects.toThrow(/later than the current/);
    await renewRecord(u, { id: r.id, expiresOn: new Date("2027-01-20") });
    expect((await at("2026-12-30")).sent).toBe(1);
  });

  it("builds a vendor pack that lists papers but never their files, and labels unverified details", async () => {
    const { u } = await biz(["SELLER"], "Ikeja Test Gas");
    await addRecord(u, { kind: "NMDPRA", number: "NMDPRA/77", issuer: "NMDPRA", expiresOn: new Date(Date.now() + 30 * DAY) }, { name: "l.pdf", data: PDF });
    await addRecord(u, { kind: "INSURANCE", number: "SECRET-POLICY", expiresOn: new Date(Date.now() + 300 * DAY), inVendorPack: false });
    const { bytes, fileName } = await buildVendorPack(u);
    expect(fileName).toBe("refinerylens-vendor-pack-ikeja-test-gas.pdf");
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
    expect(text).toContain("Ikeja Test Gas");
    expect(text).toContain("NMDPRA/77");
    expect(text).toContain("Expires within 60 days");
    expect(text).toContain("copy held in the vault, available from the business on request");
    expect(text).toContain("Not verified");
    expect(text).not.toContain("SECRET-POLICY");
  });
});

describe("threshold alerts", () => {
  it("fires once on each crossing and only for price data customers", async () => {
    const now = new Date();
    const sellers = await Promise.all([biz(), biz(), biz()]);
    const report = (i: number, p: number, daysAgo: number) => reportPrice(sellers[i]!.u, { product: "LPG", state: "LA", priceNgn: p, chargedOn: new Date(now.getTime() - daysAgo * DAY), confirmCharged: true });
    await report(0, 1300, 3); await report(1, 1350, 3); await report(2, 1400, 3); // median 1350

    const u = await user();
    await expect(addThreshold(u, { product: "LPG", state: "LA", direction: "ABOVE", priceNgn: 1400 })).rejects.toThrow(/price data subscription/);
    await setPriceDataAccess(await user("ADMIN"), { email: u.email, months: 1 });
    const above = await addThreshold(u, { product: "LPG", state: "LA", direction: "ABOVE", priceNgn: 1400 });
    const below = await addThreshold(u, { product: "LPG", state: "LA", direction: "BELOW", priceNgn: 1360 });
    expect(above.met).toBe(false);
    expect(below.met).toBe(true); // already true when set: does not fire straight away

    expect((await checkThresholds()).fired).toBe(0);
    await report(0, 1500, 1); await report(1, 1450, 1); // median 1450
    expect((await checkThresholds()).fired).toBe(1);
    expect((await checkThresholds()).fired).toBe(0);
    const a = await db.alert.findFirstOrThrow({ where: { userId: u.id, kind: "PRICE_THRESHOLD" } });
    expect(a.title).toBe("LPG (cooking gas) in Lagos is above ₦1,400");
    expect(a.body).toContain("₦1,450/kg across 3 sellers");

    await report(0, 1200, 0); await report(1, 1250, 0); // median 1250: crosses back below 1400 and below 1360
    expect((await checkThresholds()).fired).toBe(1); // the BELOW alert fires again after having been false
    expect(await db.priceThreshold.findUniqueOrThrow({ where: { id: above.id } })).toMatchObject({ met: false });
  });
});
