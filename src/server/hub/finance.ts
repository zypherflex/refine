import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { isState, PRODUCTS } from "@/lib/hub/catalog";
import { audit } from "../audit";
import { requireBusiness } from "./business";
import { reliability } from "./reliability";

/**
 * Inventory finance pilot. A verified business with a reliability score can share its confirmed trade record with
 * one lender partner, with consent, for a limited time. The lender decides and lends outside RefineryLens:
 * RefineryLens never lends, holds money or promises an offer. The business can withdraw consent at any time.
 */
export const SHARE_DAYS = 90;
export const PURPOSES = [
  { id: "STOCK", label: "Buy stock (inventory)" },
  { id: "CYLINDERS", label: "Buy cylinders or tanks" },
  { id: "TRUCK", label: "Truck or bobtail repairs" },
  { id: "WORKING_CAPITAL", label: "Other working capital" },
] as const;
const DAY = 86_400_000;
const purposeIds = PURPOSES.map((p) => p.id as string);

export const partnerInput = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(600).default(""),
  states: z.array(z.string().refine(isState, "Unknown state")).default([]),
  products: z.array(z.string()).default([]),
});

export async function createPartner(actor: Actor, raw: z.input<typeof partnerInput>) {
  if (!can.manageUsers(actor)) throw new ForbiddenError();
  const p = await db.financePartner.create({ data: partnerInput.parse(raw) });
  await audit(actor.id, "hub.finance.partner.create", "FinancePartner", p.id);
  return p;
}

export async function setPartnerActive(actor: Actor, partnerId: string, active: boolean) {
  if (!can.manageUsers(actor)) throw new ForbiddenError();
  await db.financePartner.update({ where: { id: partnerId }, data: { active } });
  await audit(actor.id, active ? "hub.finance.partner.on" : "hub.finance.partner.off", "FinancePartner", partnerId);
}

/** Links a lender's staff account to the partner, so they see the records shared with it. */
export async function setPartnerStaff(actor: Actor, partnerId: string, email: string, add: boolean) {
  if (!can.manageUsers(actor)) throw new ForbiddenError();
  const u = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!u) throw new NotFoundError("No account with that email. Ask the lender's staff member to register first.");
  if (add && (await db.hubBusiness.findUnique({ where: { ownerId: u.id } }))) throw new AppError("This account owns a trade hub business, so it cannot also see other businesses' records as a lender.");
  await db.user.update({ where: { id: u.id }, data: { financePartnerId: add ? partnerId : null } });
  await audit(actor.id, add ? "hub.finance.staff.add" : "hub.finance.staff.remove", "User", u.id, { partnerId });
}

export async function listPartners(onlyActive = true) {
  return db.financePartner.findMany({ where: onlyActive ? { active: true } : {}, include: { staff: { select: { id: true, name: true, email: true } } }, orderBy: { name: "asc" } });
}

/** What the business can do today, and why not if it cannot. */
export async function financeEligibility(businessId: string, verification: string) {
  const r = await reliability(businessId);
  const reasons: string[] = [];
  if (verification !== "VERIFIED") reasons.push("Your business needs to be verified.");
  if (r.score == null) reasons.push(`You need at least 5 trades confirmed by both sides on RefineryLens (you have ${r.confirmed}).`);
  return { eligible: reasons.length === 0, reasons, reliability: r };
}

export const requestInput = z.object({
  partnerId: z.string().min(1),
  amountNgn: z.coerce.number().int().min(50_000, "The smallest request is ₦50,000").max(500_000_000),
  purpose: z.string().refine((p) => purposeIds.includes(p), "Choose what the money is for"),
  product: z.string().refine((p) => PRODUCTS.some((x) => x.id === p), "Choose a product"),
  notes: z.string().trim().max(1000).default(""),
  consent: z.literal(true, { errorMap: () => ({ message: "Tick the consent box to share your record with this lender" }) }),
});

export async function requestFinance(actor: Actor, raw: z.input<typeof requestInput>, now = new Date()) {
  const input = requestInput.parse(raw);
  const b = await requireBusiness(actor);
  const { eligible, reasons } = await financeEligibility(b.id, b.verification);
  if (!eligible) throw new AppError(reasons.join(" "));
  const partner = await db.financePartner.findUnique({ where: { id: input.partnerId } });
  if (!partner?.active) throw new NotFoundError("Lender not found");
  if (partner.states.length && !partner.states.includes(b.state)) throw new AppError("This lender does not lend in your state.");
  const open = await db.financeRequest.count({ where: { businessId: b.id, partnerId: partner.id, status: { in: ["SHARED", "IN_REVIEW"] } } });
  if (open) throw new AppError("You already have an open request with this lender.");
  const r = await db.financeRequest.create({ data: { partnerId: partner.id, amountNgn: input.amountNgn, purpose: input.purpose, product: input.product, notes: input.notes, businessId: b.id, consentAt: now, shareUntil: new Date(now.getTime() + SHARE_DAYS * DAY) } });
  await audit(actor.id, "hub.finance.request", "FinanceRequest", r.id, { partnerId: partner.id, amountNgn: input.amountNgn });
  return r;
}

/** Withdrawing ends the lender's access to the record at once. */
export async function withdrawFinance(actor: Actor, requestId: string, now = new Date()) {
  const b = await requireBusiness(actor);
  const { count } = await db.financeRequest.updateMany({ where: { id: requestId, businessId: b.id, status: { not: "WITHDRAWN" } }, data: { status: "WITHDRAWN", withdrawnAt: now } });
  if (!count) throw new NotFoundError("Request not found");
  await audit(actor.id, "hub.finance.withdraw", "FinanceRequest", requestId);
}

export async function myFinanceRequests(actor: Actor) {
  const b = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!b) return [];
  return db.financeRequest.findMany({ where: { businessId: b.id }, include: { partner: true }, orderBy: { createdAt: "desc" } });
}

const liveShare = (now: Date) => ({ status: { not: "WITHDRAWN" as const }, shareUntil: { gt: now } });

async function lenderPartnerId(actor: Actor) {
  const u = await db.user.findUnique({ where: { id: actor.id } });
  if (!u?.financePartnerId) throw new ForbiddenError("This page is for lender partners in the finance pilot.");
  return u.financePartnerId;
}

export async function lenderQueue(actor: Actor, now = new Date()) {
  const partnerId = await lenderPartnerId(actor);
  const [partner, requests] = await Promise.all([
    db.financePartner.findUniqueOrThrow({ where: { id: partnerId } }),
    db.financeRequest.findMany({ where: { partnerId, ...liveShare(now) }, include: { business: true }, orderBy: { createdAt: "desc" } }),
  ]);
  return { partner, requests };
}

/** The shared trade record: identity, verification, reliability and 12 months of confirmed activity. Counterparty names are not shared. */
export async function sharedRecord(actor: Actor, requestId: string, now = new Date()) {
  const partnerId = await lenderPartnerId(actor);
  const req = await db.financeRequest.findFirst({ where: { id: requestId, partnerId, ...liveShare(now) }, include: { business: true } });
  if (!req) throw new NotFoundError("This record is not shared with you, or consent was withdrawn.");
  return { request: req, record: await tradeRecord(req.businessId, now) };
}

export type MonthRow = { month: string; jobs: number; supplyDeliveries: number; supplyQuantity: Record<string, number> };

export async function tradeRecord(businessId: string, now = new Date()) {
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const both = { posterConfirmedAt: { not: null }, haulierConfirmedAt: { not: null } };
  const [jobs, supply, r] = await Promise.all([
    db.deliveryJob.findMany({ where: { status: "DELIVERED", ...both, posterConfirmedAt: { gte: since }, OR: [{ posterId: businessId }, { quotes: { some: { haulierId: businessId, status: "ACCEPTED" } } }] }, select: { posterId: true, posterConfirmedAt: true, quotes: { where: { status: "ACCEPTED" }, select: { haulierId: true } } } }),
    db.supplyDelivery.findMany({ where: { sellerConfirmedAt: { not: null }, buyerConfirmedAt: { not: null }, deliveredOn: { gte: since }, agreement: { OR: [{ buyerId: businessId }, { sellerId: businessId }] } }, select: { deliveredOn: true, quantity: true, agreement: { select: { buyerId: true, sellerId: true, unit: true, product: true } } } }),
    reliability(businessId, now),
  ]);
  const months: MonthRow[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1));
    months.push({ month: d.toISOString().slice(0, 7), jobs: 0, supplyDeliveries: 0, supplyQuantity: {} });
  }
  const at = (d: Date) => months.find((m) => m.month === d.toISOString().slice(0, 7));
  const counterparties = new Set<string>();
  for (const j of jobs) {
    const m = at(j.posterConfirmedAt!);
    if (m) m.jobs++;
    counterparties.add(j.posterId === businessId ? j.quotes[0]?.haulierId ?? "" : j.posterId);
  }
  for (const s of supply) {
    const m = at(s.deliveredOn);
    if (!m) continue;
    m.supplyDeliveries++;
    const k = `${s.agreement.product} ${s.agreement.unit}`;
    m.supplyQuantity[k] = (m.supplyQuantity[k] ?? 0) + s.quantity;
    counterparties.add(s.agreement.buyerId === businessId ? s.agreement.sellerId : s.agreement.buyerId);
  }
  counterparties.delete("");
  return { months, counterparties: counterparties.size, reliability: r };
}

export const decisionInput = z.object({ requestId: z.string().min(1), status: z.enum(["IN_REVIEW", "OFFERED", "DECLINED"]), note: z.string().trim().max(1000).default("") });

/** The lender records where the request stands. The business is told in the app. Terms are agreed directly. */
export async function lenderDecide(actor: Actor, raw: z.input<typeof decisionInput>, now = new Date()) {
  const input = decisionInput.parse(raw);
  const partnerId = await lenderPartnerId(actor);
  const req = await db.financeRequest.findFirst({ where: { id: input.requestId, partnerId, ...liveShare(now) }, include: { business: true, partner: true } });
  if (!req) throw new NotFoundError("Request not found");
  if (input.status === "DECLINED" && !input.note) throw new AppError("Say why, so the business knows what to improve.");
  await db.financeRequest.update({ where: { id: req.id }, data: { status: input.status, partnerNote: input.note, decidedAt: input.status === "IN_REVIEW" ? null : now } });
  const label = { IN_REVIEW: "is reviewing", OFFERED: "would like to make an offer on", DECLINED: "declined" }[input.status];
  await db.alert.create({
    data: {
      userId: req.business.ownerId, kind: "FINANCE", title: `${req.partner.name} ${label} your finance request`,
      body: `${input.note ? `${input.note}\n\n` : ""}Any offer and its terms come from the lender directly. RefineryLens does not lend or hold money.`,
      link: "/hub/finance", dedupeKey: `finance-${req.id}-${input.status}-${now.getTime()}`,
    },
  });
  await audit(actor.id, "hub.finance.decide", "FinanceRequest", req.id, { status: input.status });
}
