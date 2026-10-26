import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { saveBusiness } from "@/server/hub/business";
import { acceptQuote, cancelJob, carrierRecord, confirmDelivered, getJob, openJobs, postJob, submitQuote, withdrawQuote } from "@/server/hub/jobs";
import { suspendBusiness } from "@/server/hub/moderation";
import { priceBoard, reportPrices } from "@/server/hub/prices";
import { getAgreement, logDelivery, proposeAgreement, reliability, respond, reviewDelivery, setStatus } from "@/server/hub/supply";
import { resetDb, user } from "../helpers";

beforeEach(resetDb);

async function trader(name: string, roles: ("SELLER" | "BUYER" | "DELIVERY" | "REFINERY")[], state = "Lagos") {
  const u = await user();
  const b = await saveBusiness(u, { name, roles, state });
  return { u, b };
}
const tomorrow = () => new Date(Date.now() + 86_400_000);

describe("price board", () => {
  it("accepts prices only from sellers, within sane bounds, one per seller per day", async () => {
    const { u: seller } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: buyer } = await trader("Kano Gas", ["BUYER"]);
    await expect(reportPrices(buyer, { state: "Lagos", prices: { lpg_retail_kg: 1300 } })).rejects.toThrow(/Only sellers/);
    await expect(reportPrices(seller, { state: "Lagos", prices: { lpg_retail_kg: 13 } })).rejects.toThrow(/expected range/);
    await expect(reportPrices(seller, { state: "Lagos", prices: { nope: 1000 } })).rejects.toThrow(/Unknown/);
    await expect(reportPrices(seller, { state: "Ghana", prices: { lpg_retail_kg: 1300 } })).rejects.toThrow();
    await reportPrices(seller, { state: "Lagos", prices: { lpg_retail_kg: 1300, ago_depot_litre: null } });
    await reportPrices(seller, { state: "Lagos", prices: { lpg_retail_kg: 1350 } });
    const rows = await db.priceReport.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].priceNaira).toBe(1350);
  });

  it("publishes a median only once three visible sellers report, leaving out suspended ones", async () => {
    const admin = await user("ADMIN");
    const sellers = await Promise.all(["A Gas", "B Gas", "C Gas"].map((n) => trader(n, ["SELLER"])));
    const viewer = await user();
    await reportPrices(sellers[0].u, { state: "Lagos", prices: { lpg_retail_kg: 1200 } });
    await reportPrices(sellers[1].u, { state: "Lagos", prices: { lpg_retail_kg: 1300 } });
    let board = await priceBoard(viewer, "lpg_retail_kg");
    expect(board.cells[0].median).toBeNull();
    await reportPrices(sellers[2].u, { state: "Lagos", prices: { lpg_retail_kg: 1500 } });
    board = await priceBoard(viewer, "lpg_retail_kg");
    expect(board.cells[0].median).toBe(1300);
    await suspendBusiness(admin, sellers[2].b.id, "Fake prices");
    board = await priceBoard(viewer, "lpg_retail_kg");
    expect(board.cells[0].median).toBeNull();
  });
});

describe("delivery jobs", () => {
  it("runs from posting to quotes, acceptance and confirmation by both sides", async () => {
    const { u: poster } = await trader("Kano Gas", ["BUYER"], "Kano");
    const { u: c1, b: b1 } = await trader("Corridor Haulage", ["DELIVERY"], "Kaduna");
    const { u: c2 } = await trader("Delta Trucks", ["DELIVERY"], "Delta");
    const { u: notCarrier } = await trader("Ikeja Energy", ["SELLER"]);
    const job = await postJob(poster, { title: "20 tonnes LPG to Kano", products: ["lpg"], quantity: 20, unit: "tonnes", fromState: "Lagos", toState: "Kano", pickupDate: tomorrow() });
    expect((await openJobs(c1, { toState: "Kano" })).map((j) => j.id)).toEqual([job.id]);
    expect(await openJobs(c1, { toState: "Rivers" })).toHaveLength(0);

    await expect(submitQuote(notCarrier, job.id, { priceNaira: 1_000_000 })).rejects.toThrow(/delivery partner/);
    const q1 = await submitQuote(c1, job.id, { priceNaira: 2_100_000, note: "Bullet truck Tuesday" });
    await submitQuote(c2, job.id, { priceNaira: 2_400_000 });
    expect(await db.alert.count({ where: { kind: "HUB_JOB" } })).toBe(2);
    expect((await getJob(c1, job.id)).quotes).toHaveLength(1); // a carrier sees only its own quote
    expect((await getJob(poster, job.id)).quotes.map((q) => q.priceNaira)).toEqual([2_100_000, 2_400_000]);

    await expect(acceptQuote(c1, job.id, q1.id)).rejects.toThrow(/not found/i);
    await acceptQuote(poster, job.id, q1.id);
    const after = await db.deliveryQuote.findMany({ orderBy: { priceNaira: "asc" } });
    expect(after.map((q) => q.status)).toEqual(["ACCEPTED", "DECLINED"]);
    await expect(submitQuote(c2, job.id, { priceNaira: 1 })).rejects.toThrow(/no longer/);
    await expect(getJob(notCarrier, job.id)).rejects.toThrow(/not found/i); // awarded jobs leave the public board

    expect(await confirmDelivered(c1, job.id)).toBe(false);
    await expect(confirmDelivered(c2, job.id)).rejects.toThrow(/not found/i);
    expect(await confirmDelivered(poster, job.id)).toBe(true);
    expect((await db.deliveryJob.findUniqueOrThrow({ where: { id: job.id } })).status).toBe("DELIVERED");
    expect(await carrierRecord(b1.id)).toBe(1);
  });

  it("lets carriers withdraw and posters cancel, and refuses past pickup dates", async () => {
    const { u: poster } = await trader("Kano Gas", ["BUYER"], "Kano");
    const { u: c1 } = await trader("Corridor Haulage", ["DELIVERY"], "Kaduna");
    await expect(postJob(poster, { title: "Old load", products: ["lpg"], quantity: 1, unit: "tonnes", fromState: "Lagos", toState: "Kano", pickupDate: new Date("2020-01-01") })).rejects.toThrow(/passed/);
    const job = await postJob(poster, { title: "LPG load", products: ["lpg"], quantity: 5, unit: "tonnes", fromState: "Lagos", toState: "Kano", pickupDate: tomorrow() });
    await submitQuote(c1, job.id, { priceNaira: 900_000 });
    await withdrawQuote(c1, job.id);
    expect((await db.deliveryQuote.findFirstOrThrow()).status).toBe("WITHDRAWN");
    await cancelJob(poster, job.id);
    expect(await openJobs(c1)).toHaveLength(0);
  });
});

describe("supply agreements", () => {
  it("is proposed, accepted, logged by the seller and confirmed or disputed by the buyer", async () => {
    const { u: buyer } = await trader("Kano Gas", ["BUYER"], "Kano");
    const { u: seller, b: sb } = await trader("Ikeja Energy", ["SELLER"]);
    const { u: outsider } = await trader("Nosy Traders", ["BUYER"]);
    const start = new Date(Date.now() - 20 * 86_400_000);
    const a = await proposeAgreement(buyer, { counterpartyId: sb.id, side: "BUYER", product: "lpg", quantity: 20, unit: "tonnes", frequency: "WEEKLY", deliverTo: "Kano", startDate: start });
    await expect(getAgreement(outsider, a.id)).rejects.toThrow(/not found/i);
    await expect(respond(buyer, a.id, true)).rejects.toThrow(/nothing to respond/);
    await expect(logDelivery(seller, a.id, { deliveredOn: new Date(), quantity: 20 })).rejects.toThrow(/active/);
    await respond(seller, a.id, true);
    expect((await getAgreement(buyer, a.id)).next).not.toBeNull();

    await expect(logDelivery(buyer, a.id, { deliveredOn: new Date(), quantity: 20 })).rejects.toThrow(/Only the seller/);
    await expect(logDelivery(seller, a.id, { deliveredOn: tomorrow(), quantity: 20 })).rejects.toThrow(/future/);
    const d1 = await logDelivery(seller, a.id, { deliveredOn: new Date(Date.now() - 7 * 86_400_000), quantity: 20 });
    const d2 = await logDelivery(seller, a.id, { deliveredOn: new Date(), quantity: 18 });
    await expect(logDelivery(seller, a.id, { deliveredOn: new Date(), quantity: 18 })).rejects.toThrow(/already logged/);

    await expect(reviewDelivery(seller, d1.id, true, "")).rejects.toThrow(/Only the buyer/);
    await reviewDelivery(buyer, d1.id, true, "");
    await expect(reviewDelivery(buyer, d2.id, false, "")).rejects.toThrow(/what was wrong/);
    await reviewDelivery(buyer, d2.id, false, "Two tonnes short");
    await expect(reviewDelivery(buyer, d2.id, true, "")).rejects.toThrow(/already been reviewed/);
    expect(await reliability(sb.id)).toEqual({ confirmed: 1, disputed: 1, activeBuyers: 1, rate: 50 });

    await setStatus(buyer, a.id, "PAUSED");
    await expect(logDelivery(seller, a.id, { deliveredOn: new Date(Date.now() - 86_400_000), quantity: 20 })).rejects.toThrow(/active/);
    await setStatus(seller, a.id, "ENDED");
    await expect(setStatus(seller, a.id, "ACTIVE")).rejects.toThrow(/cannot be changed/);
  });

  it("refuses agreements where the seller side does not sell", async () => {
    const { u: buyer } = await trader("Kano Gas", ["BUYER"], "Kano");
    const { b: otherBuyer } = await trader("Abuja Gas", ["BUYER"], "FCT Abuja");
    await expect(proposeAgreement(buyer, { counterpartyId: otherBuyer.id, side: "BUYER", product: "lpg", quantity: 5, unit: "tonnes", frequency: "WEEKLY", deliverTo: "Kano", startDate: new Date() })).rejects.toThrow(/not listed as a seller/);
  });
});
