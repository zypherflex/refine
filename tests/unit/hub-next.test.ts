import { afterEach, describe, expect, it } from "vitest";
import { scoreFrom } from "@/server/hub/reliability";
import { toE164 } from "@/server/messaging";
import { composeAlert, watDay } from "@/server/hub/alerts";
import { activePlan, trustRank } from "@/lib/hub/rules";
import { integrationStatus } from "@/server/integrations";
import { LANGS, missingKeys, translate } from "@/lib/i18n/hub";
import type { BoardCell } from "@/server/hub/prices";

const cell = (product: string, state: string, median: number | null, sellers = 3): BoardCell => ({ product, state, sellers, verifiedSellers: sellers, median, latest: null, oldest: null, includesSample: false });

describe("reliability score", () => {
  it("re-weights to the parts that have data", () => {
    expect(scoreFrom([{ key: "confirmation", value: 1, n: 5 }, { key: "timeliness", value: 0, n: 0 }, { key: "quantity", value: 0, n: 0 }])).toBe(100);
    expect(scoreFrom([{ key: "confirmation", value: 1, n: 5 }, { key: "timeliness", value: 0.5, n: 4 }, { key: "quantity", value: 0, n: 0 }])).toBe(Math.round((100 * (0.6 + 0.1)) / 0.8));
    expect(scoreFrom([{ key: "confirmation", value: 0, n: 0 }])).toBeNull();
  });
});

describe("phone numbers", () => {
  it("normalises Nigerian numbers and rejects junk", () => {
    expect(toE164("0803 123 4567")).toBe("+2348031234567");
    expect(toE164("234-803-123-4567")).toBe("+2348031234567");
    expect(toE164("+234 803 123 4567")).toBe("+2348031234567");
    expect(toE164("hello")).toBeNull();
    expect(toE164("12")).toBeNull();
  });
});

describe("morning alert text", () => {
  const board = [cell("LPG", "LA", 1340, 4), cell("DIESEL", "LA", null, 2), cell("PETROL", "OG", 1000)];
  it("uses medians only and says when a state has too few sellers", () => {
    const msg = composeAlert(board, { states: ["LA", "KN"], products: ["LPG", "DIESEL"], language: "en" }, new Date("2026-10-27T00:00:00Z"), "https://x/hub/prices");
    expect(msg).toContain("₦1,340");
    expect(msg).toContain("(4 sellers)");
    expect(msg).not.toMatch(/Diesel/);
    expect(msg).toMatch(/Not enough seller reports in Kano/);
    expect(msg).toContain("https://x/hub/prices");
  });
  it("speaks the subscriber's language", () => {
    const msg = composeAlert(board, { states: ["LA"], products: [], language: "pcm" }, new Date("2026-10-27T00:00:00Z"), "l");
    expect(msg).toContain(translate("pcm", "sms.header", { state: "Lagos", date: "27 Oct" }));
  });
  it("works out the Lagos day from UTC", () => {
    expect(watDay(new Date("2026-10-27T23:30:00Z")).toISOString().slice(0, 10)).toBe("2026-10-28");
    expect(watDay(new Date("2026-10-27T22:59:00Z")).toISOString().slice(0, 10)).toBe("2026-10-27");
  });
});

describe("Verified Business plan", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  it("is active only for verified businesses within the paid period", () => {
    expect(activePlan({ plan: "VERIFIED_BUSINESS", planUntil: new Date("2027-01-01"), verification: "VERIFIED" }, now)).toBe("VERIFIED_BUSINESS");
    expect(activePlan({ plan: "VERIFIED_BUSINESS", planUntil: new Date("2026-10-01"), verification: "VERIFIED" }, now)).toBe("FREE");
    expect(activePlan({ plan: "VERIFIED_BUSINESS", planUntil: new Date("2027-01-01"), verification: "SUSPENDED" }, now)).toBe("FREE");
  });
  it("ranks members, then verified, then the rest", () => {
    expect(trustRank({ plan: "VERIFIED_BUSINESS", planUntil: null, verification: "VERIFIED" })).toBe(0);
    expect(trustRank({ plan: "FREE", planUntil: null, verification: "VERIFIED" })).toBe(1);
    expect(trustRank({ plan: "FREE", planUntil: null, verification: "UNVERIFIED" })).toBe(2);
  });
});

describe("text messaging status", () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  it("needs the provider, credentials and a sender for each channel", () => {
    process.env.MESSAGING_PROVIDER = "twilio";
    delete process.env.TWILIO_ACCOUNT_SID;
    expect(integrationStatus().messaging).toEqual({ configured: true, sms: false, whatsapp: false });
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_SMS_FROM: "+15550000000" });
    delete process.env.TWILIO_WHATSAPP_FROM;
    expect(integrationStatus().messaging).toEqual({ configured: true, sms: true, whatsapp: false });
    process.env.MESSAGING_PROVIDER = "termii";
    expect(integrationStatus().messaging.sms).toBe(false);
  });
});

describe("translations", () => {
  it("covers every English key in Pidgin and Hausa", () => {
    for (const { id } of LANGS) expect(missingKeys(id)).toEqual([]);
  });
});
