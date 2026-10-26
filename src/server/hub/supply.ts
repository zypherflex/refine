import { z } from "zod";
import type { SupplyAgreement } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { LOCATIONS, PRODUCTS, UNITS } from "@/lib/hub/catalog";
import { dayOf } from "@/lib/hub/prices";
import { audit } from "../audit";
import { createAlert } from "../services/alerts";
import { canSeeBusiness, requireMyBusiness } from "./business";

/**
 * Recurring supply agreements. Either side proposes; the other accepts or declines. While active, the seller logs each
 * delivery and the buyer confirms or disputes it. Confirmed deliveries form the seller's public reliability record.
 */

const productIds = PRODUCTS.map((p) => p.id) as [string, ...string[]];

export const agreementInput = z.object({
  counterpartyId: z.string().min(1),
  side: z.enum(["BUYER", "SELLER"]),
  product: z.enum(productIds),
  quantity: z.number().positive().finite().max(1e9),
  unit: z.enum(UNITS),
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]),
  deliverTo: z.string().refine((s) => LOCATIONS.includes(s), "Choose a location from the list"),
  priceNote: z.string().trim().max(200).default(""),
  notes: z.string().trim().max(1000).default(""),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().default(null),
});

const FREQ_DAYS = { WEEKLY: 7, FORTNIGHTLY: 14, MONTHLY: 30 } as const;

/** The next scheduled delivery on or after `from`, counted from the start date. Monthly uses calendar months. */
export function nextDue(a: Pick<SupplyAgreement, "frequency" | "startDate" | "endDate">, from = new Date()): Date | null {
  let d = dayOf(a.startDate);
  const target = dayOf(from);
  let i = 0;
  while (d < target && i < 2000) {
    i++;
    d = a.frequency === "MONTHLY" ? new Date(Date.UTC(a.startDate.getUTCFullYear(), a.startDate.getUTCMonth() + i, a.startDate.getUTCDate())) : new Date(dayOf(a.startDate).getTime() + i * FREQ_DAYS[a.frequency] * 86_400_000);
  }
  if (a.endDate && d > a.endDate) return null;
  return d;
}

async function activeBusiness(actor: Actor) {
  const b = await requireMyBusiness(actor);
  if (b.verification === "SUSPENDED") throw new ForbiddenError("This business is suspended.");
  return b;
}

export async function proposeAgreement(actor: Actor, raw: z.input<typeof agreementInput>) {
  const mine = await activeBusiness(actor);
  const input = agreementInput.parse(raw);
  const other = await db.hubBusiness.findUnique({ where: { id: input.counterpartyId } });
  if (!other || !canSeeBusiness(actor, other) || other.verification === "SUSPENDED") throw new NotFoundError("Business not found");
  if (other.id === mine.id) throw new AppError("Choose another business.");
  const [buyer, seller] = input.side === "BUYER" ? [mine, other] : [other, mine];
  if (!seller.roles.some((r) => r === "SELLER" || r === "REFINERY")) throw new AppError(`${seller.name} is not listed as a seller.`);
  if (input.endDate && input.endDate <= input.startDate) throw new AppError("The end date must be after the start date.");
  const a = await db.supplyAgreement.create({
    data: {
      buyerId: buyer.id, sellerId: seller.id, proposedById: mine.id, product: input.product, quantity: input.quantity, unit: input.unit, frequency: input.frequency,
      deliverTo: input.deliverTo, priceNote: input.priceNote, notes: input.notes, startDate: dayOf(input.startDate), endDate: input.endDate ? dayOf(input.endDate) : null,
    },
  });
  await createAlert({ userId: other.ownerId, kind: "HUB_SUPPLY", title: `${mine.name} proposed a supply agreement`, body: `${input.quantity.toLocaleString("en-GB")} ${input.unit} ${input.frequency.toLowerCase()}. Accept or decline it.`, link: `/hub/supply/${a.id}`, dedupeKey: `supply-propose:${a.id}` });
  await audit(actor.id, "supply.propose", "SupplyAgreement", a.id);
  return a;
}

async function load(actor: Actor, id: string) {
  const a = await db.supplyAgreement.findUnique({ where: { id }, include: { buyer: true, seller: true } });
  if (!a) throw new NotFoundError("Agreement not found");
  const side = a.buyer.ownerId === actor.id ? "BUYER" : a.seller.ownerId === actor.id ? "SELLER" : null;
  if (!side) throw new NotFoundError("Agreement not found");
  return { a, side, mineId: side === "BUYER" ? a.buyerId : a.sellerId, otherOwner: side === "BUYER" ? a.seller.ownerId : a.buyer.ownerId, myName: side === "BUYER" ? a.buyer.name : a.seller.name };
}

/** An agreement and its deliveries, for one of its two parties only. */
export async function getAgreement(actor: Actor, id: string) {
  const { a, side, mineId } = await load(actor, id);
  const deliveries = await db.supplyDelivery.findMany({ where: { agreementId: id }, orderBy: { deliveredOn: "desc" } });
  return { agreement: a, side, awaitingMe: a.status === "PROPOSED" && a.proposedById !== mineId, deliveries, next: a.status === "ACTIVE" ? nextDue(a) : null };
}

export async function respond(actor: Actor, id: string, accept: boolean) {
  const { a, mineId, otherOwner, myName } = await load(actor, id);
  if (a.status !== "PROPOSED" || a.proposedById === mineId) throw new AppError("There is nothing to respond to.");
  await db.supplyAgreement.update({ where: { id }, data: { status: accept ? "ACTIVE" : "DECLINED" } });
  await createAlert({ userId: otherOwner, kind: "HUB_SUPPLY", title: accept ? `${myName} accepted the supply agreement` : `${myName} declined the supply agreement`, body: accept ? "Deliveries can now be logged and confirmed." : "You can propose different terms.", link: `/hub/supply/${id}`, dedupeKey: `supply-respond:${id}` });
}

export async function setStatus(actor: Actor, id: string, status: "ACTIVE" | "PAUSED" | "ENDED") {
  const { a } = await load(actor, id);
  if (a.status === "PROPOSED" || a.status === "DECLINED" || a.status === "ENDED") throw new AppError("This agreement cannot be changed.");
  if (status === "ACTIVE" && a.status !== "PAUSED") throw new AppError("Only a paused agreement can be resumed.");
  await db.supplyAgreement.update({ where: { id }, data: { status } });
}

export const deliveryInput = z.object({ deliveredOn: z.coerce.date(), quantity: z.number().positive().finite().max(1e9) });

/** The seller records a delivery. One per day; not in the future. */
export async function logDelivery(actor: Actor, id: string, raw: z.input<typeof deliveryInput>) {
  const { a, side, otherOwner } = await load(actor, id);
  if (side !== "SELLER") throw new AppError("Only the seller logs deliveries.");
  if (a.status !== "ACTIVE") throw new AppError("Deliveries can only be logged on an active agreement.");
  const input = deliveryInput.parse(raw);
  const day = dayOf(input.deliveredOn);
  if (day > dayOf(new Date())) throw new AppError("A delivery cannot be logged in the future.");
  if (day < dayOf(a.startDate)) throw new AppError("That date is before the agreement started.");
  const existing = await db.supplyDelivery.findUnique({ where: { agreementId_deliveredOn: { agreementId: id, deliveredOn: day } } });
  if (existing) throw new AppError("A delivery is already logged for that day.");
  const d = await db.supplyDelivery.create({ data: { agreementId: id, deliveredOn: day, quantity: input.quantity } });
  await createAlert({ userId: otherOwner, kind: "HUB_SUPPLY", title: "Confirm a delivery", body: `${a.seller.name} logged ${input.quantity.toLocaleString("en-GB")} ${a.unit}. Confirm it arrived, or dispute it.`, link: `/hub/supply/${id}`, dedupeKey: `supply-log:${d.id}` });
  return d;
}

/** The buyer confirms or disputes a logged delivery, once. */
export async function reviewDelivery(actor: Actor, deliveryId: string, ok: boolean, note: string) {
  const d = await db.supplyDelivery.findUnique({ where: { id: deliveryId } });
  if (!d) throw new NotFoundError("Delivery not found");
  const { a, side, otherOwner } = await load(actor, d.agreementId);
  if (side !== "BUYER") throw new AppError("Only the buyer confirms deliveries.");
  if (d.status !== "LOGGED") throw new AppError("This delivery has already been reviewed.");
  const buyerNote = note.trim().slice(0, 500);
  if (!ok && !buyerNote) throw new AppError("Say what was wrong with the delivery.");
  await db.supplyDelivery.update({ where: { id: deliveryId }, data: { status: ok ? "CONFIRMED" : "DISPUTED", buyerNote, confirmedAt: new Date() } });
  if (!ok) await createAlert({ userId: otherOwner, kind: "HUB_SUPPLY", title: `${a.buyer.name} disputed a delivery`, body: buyerNote, link: `/hub/supply/${a.id}`, dedupeKey: `supply-dispute:${deliveryId}` });
}

export async function myAgreements(actor: Actor) {
  return db.supplyAgreement.findMany({
    where: { OR: [{ buyer: { ownerId: actor.id } }, { seller: { ownerId: actor.id } }] },
    include: { buyer: true, seller: true, _count: { select: { deliveries: true } } },
    orderBy: { updatedAt: "desc" },
  });
}

/** A seller's public record: deliveries buyers confirmed and disputed across all agreements, and active buyers. */
export async function reliability(sellerId: string) {
  const [confirmed, disputed, activeBuyers] = await Promise.all([
    db.supplyDelivery.count({ where: { status: "CONFIRMED", agreement: { sellerId } } }),
    db.supplyDelivery.count({ where: { status: "DISPUTED", agreement: { sellerId } } }),
    db.supplyAgreement.count({ where: { sellerId, status: "ACTIVE" } }),
  ]);
  const reviewed = confirmed + disputed;
  return { confirmed, disputed, activeBuyers, rate: reviewed ? Math.round((confirmed / reviewed) * 100) : null };
}
