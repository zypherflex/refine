import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { PRODUCTS, UNITS } from "@/lib/hub/catalog";
import { startOfDay } from "@/lib/hub/rules";
import { audit } from "../audit";
import { requireBusiness } from "./business";

const productIds = PRODUCTS.map((p) => p.id) as [string, ...string[]];

export const agreementInput = z.object({
  counterpartyId: z.string().min(1, "Choose the other business"),
  myRole: z.enum(["BUYER", "SELLER"]),
  product: z.enum(productIds),
  quantity: z.coerce.number().positive("Quantity must be more than zero").max(1e9),
  unit: z.enum(UNITS),
  frequency: z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]),
  deliverTo: z.string().trim().max(160).default(""),
  startsOn: z.coerce.date(),
});

export async function proposeAgreement(actor: Actor, raw: z.input<typeof agreementInput>) {
  const input = agreementInput.parse(raw);
  const me = await requireBusiness(actor);
  const other = await db.hubBusiness.findUnique({ where: { id: input.counterpartyId } });
  if (!other || other.verification === "SUSPENDED") throw new NotFoundError("Business not found");
  if (other.id === me.id) throw new AppError("Choose another business.");
  const [buyerId, sellerId] = input.myRole === "BUYER" ? [me.id, other.id] : [other.id, me.id];
  const a = await db.supplyAgreement.create({
    data: { buyerId, sellerId, proposedById: me.id, product: input.product, quantity: input.quantity, unit: input.unit, frequency: input.frequency, deliverTo: input.deliverTo, startsOn: startOfDay(input.startsOn) },
  });
  await audit(actor.id, "hub.agreement.propose", "SupplyAgreement", a.id);
  return a;
}

/** Agreements are private to the two businesses in them. */
async function party(actor: Actor, id: string) {
  const me = await requireBusiness(actor);
  const a = await db.supplyAgreement.findUnique({ where: { id }, include: { buyer: true, seller: true } });
  if (!a || (a.buyerId !== me.id && a.sellerId !== me.id)) throw new NotFoundError("Agreement not found");
  return { me, a, side: a.buyerId === me.id ? ("buyer" as const) : ("seller" as const) };
}

export async function respondAgreement(actor: Actor, id: string, accept: boolean) {
  const { me, a } = await party(actor, id);
  if (a.proposedById === me.id) throw new ForbiddenError("The other business must accept your proposal.");
  if (a.status !== "PROPOSED") throw new AppError("This proposal has already been answered.");
  const u = await db.supplyAgreement.update({ where: { id }, data: { status: accept ? "ACTIVE" : "DECLINED" } });
  await audit(actor.id, accept ? "hub.agreement.accept" : "hub.agreement.decline", "SupplyAgreement", id);
  return u;
}

export async function endAgreement(actor: Actor, id: string) {
  const { a } = await party(actor, id);
  if (a.status !== "ACTIVE") throw new AppError("Only active agreements can be ended.");
  await db.supplyAgreement.update({ where: { id }, data: { status: "ENDED" } });
  await audit(actor.id, "hub.agreement.end", "SupplyAgreement", id);
}

export const deliveryInput = z.object({
  agreementId: z.string().min(1),
  deliveredOn: z.coerce.date(),
  quantity: z.coerce.number().positive("Quantity must be more than zero").max(1e9),
  note: z.string().trim().max(500).default(""),
});

/** Either side records a delivery; it is confirmed by the recorder and waits for the other side. */
export async function recordDelivery(actor: Actor, raw: z.input<typeof deliveryInput>, now = new Date()) {
  const input = deliveryInput.parse(raw);
  const { a, side } = await party(actor, input.agreementId);
  if (a.status !== "ACTIVE") throw new AppError("Deliveries can be recorded only on an active agreement.");
  const day = startOfDay(input.deliveredOn);
  if (day > startOfDay(now)) throw new AppError("Record deliveries once they have happened.");
  if (day < a.startsOn) throw new AppError("That date is before the agreement started.");
  const stamp = new Date();
  const d = await db.supplyDelivery.create({
    data: { agreementId: a.id, deliveredOn: day, quantity: input.quantity, note: input.note, ...(side === "buyer" ? { buyerConfirmedAt: stamp } : { sellerConfirmedAt: stamp }) },
  });
  await audit(actor.id, "hub.delivery.record", "SupplyDelivery", d.id, { side });
  return d;
}

export async function confirmSupplyDelivery(actor: Actor, deliveryId: string) {
  const d = await db.supplyDelivery.findUnique({ where: { id: deliveryId } });
  if (!d) throw new NotFoundError("Delivery not found");
  const { side } = await party(actor, d.agreementId);
  const field = side === "buyer" ? "buyerConfirmedAt" : "sellerConfirmedAt";
  if (d[field]) throw new AppError("You have already confirmed this delivery.");
  const u = await db.supplyDelivery.update({ where: { id: d.id }, data: { [field]: new Date() } });
  await audit(actor.id, "hub.delivery.confirm", "SupplyDelivery", d.id, { side });
  return u;
}

export async function myAgreements(actor: Actor) {
  const me = await db.hubBusiness.findUnique({ where: { ownerId: actor.id } });
  if (!me) return { me: null, agreements: [] };
  const agreements = await db.supplyAgreement.findMany({
    where: { OR: [{ buyerId: me.id }, { sellerId: me.id }] },
    include: { buyer: true, seller: true, deliveries: { select: { buyerConfirmedAt: true, sellerConfirmedAt: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return { me, agreements };
}

export async function getAgreement(actor: Actor, id: string) {
  const { me, a, side } = await party(actor, id);
  const deliveries = await db.supplyDelivery.findMany({ where: { agreementId: id }, orderBy: { deliveredOn: "desc" } });
  return { me, agreement: a, side, deliveries };
}
