import { z } from "zod";
import type { GasOrder, GasOrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Actor } from "@/lib/permissions";
import { isPubliclyVisible, NIGERIAN_STATES } from "@/lib/hub/catalog";
import { naira } from "@/lib/hub/prices";
import { HOME_CYLINDER_SIZES } from "@/lib/everyday";
import { audit } from "../audit";
import { createAlert } from "../services/alerts";
import { requireMyBusiness } from "../hub/business";

const state = z.string().refine((s) => (NIGERIAN_STATES as readonly string[]).includes(s), "Choose a Nigerian state");

export const homeDeliveryInput = z.object({
  homeDelivery: z.boolean(),
  deliveryStates: z.array(state).max(37).default([]),
  homePricePerKg: z.number().min(300).max(10_000).nullable(),
  deliveryFeeNaira: z.number().min(0).max(50_000).nullable().default(null),
});

/** A seller turns on home delivery of LPG refills and sets its household prices. */
export async function saveHomeDelivery(actor: Actor, raw: z.input<typeof homeDeliveryInput>) {
  const b = await requireMyBusiness(actor);
  if (!b.roles.includes("SELLER")) throw new AppError("Only sellers deliver gas to homes. Add the seller role to your business profile.");
  const input = homeDeliveryInput.parse(raw);
  if (input.homeDelivery && (!input.deliveryStates.length || input.homePricePerKg === null)) throw new AppError("Choose the states you deliver to and your price per kg.");
  await db.hubBusiness.update({ where: { id: b.id }, data: { ...input, deliveryStates: [...new Set(input.deliveryStates)] } });
  await audit(actor.id, "hub.home_delivery", "HubBusiness", b.id, { on: input.homeDelivery });
}

/** Verified sellers delivering to homes in a state, with their delivered orders and average rating. */
export async function deliverySellers(s: string) {
  const sellers = await db.hubBusiness.findMany({
    where: { homeDelivery: true, deliveryStates: { has: s }, verification: "VERIFIED", homePricePerKg: { not: null } },
    select: { id: true, name: true, city: true, state: true, homePricePerKg: true, deliveryFeeNaira: true, verification: true, isDemo: true, planUntil: true },
  });
  const stats = await db.gasOrder.groupBy({ by: ["businessId"], where: { businessId: { in: sellers.map((x) => x.id) }, status: "DELIVERED" }, _count: true, _avg: { rating: true } });
  return sellers
    .filter((x) => isPubliclyVisible(x))
    .map((x) => {
      const st = stats.find((t) => t.businessId === x.id);
      return { ...x, delivered: st?._count ?? 0, rating: st?._avg.rating ?? null };
    })
    .sort((a, b) => b.delivered - a.delivered || a.homePricePerKg! - b.homePricePerKg!);
}

export function estimate(pricePerKg: number | null, fee: number | null, kg: number, cylinders: number) {
  if (pricePerKg === null) return null;
  return Math.round(pricePerKg * kg * cylinders + (fee ?? 0));
}

export const orderInput = z.object({
  businessId: z.string().min(1),
  cylinderKg: z.number().refine((n) => (HOME_CYLINDER_SIZES as readonly number[]).includes(n), "Choose a cylinder size"),
  cylinders: z.number().int().min(1).max(4),
  state,
  area: z.string().trim().min(2, "Give your area").max(80),
  address: z.string().trim().min(8, "Give the full delivery address with a landmark").max(300),
  phone: z.string().trim().regex(/^(\+?234|0)[789][01]\d{8}$/, "Use a Nigerian mobile number, e.g. 0803 123 4567").transform((p) => p.replace(/^0/, "+234").replace(/^234/, "+234")),
  note: z.string().trim().max(300).default(""),
});

const OPEN: GasOrderStatus[] = ["PLACED", "ACCEPTED", "OUT_FOR_DELIVERY"];

/** A household orders a refill. Pay on delivery, so the only check is that the seller is verified and delivers there. */
export async function placeOrder(actor: Actor, raw: z.input<typeof orderInput>) {
  const input = orderInput.parse({ ...raw, phone: String(raw.phone ?? "").replace(/[\s-]/g, "") });
  const seller = await db.hubBusiness.findUnique({ where: { id: input.businessId } });
  if (!seller || seller.verification !== "VERIFIED" || !seller.homeDelivery || !seller.deliveryStates.includes(input.state)) {
    throw new AppError("That seller does not deliver to your state at the moment. Choose another.");
  }
  if (seller.ownerId === actor.id) throw new AppError("You cannot order from your own business.");
  if ((await db.gasOrder.count({ where: { userId: actor.id, status: { in: OPEN } } })) >= 3) throw new AppError("You have 3 orders in progress. Wait for one to arrive or cancel it first.");
  const order = await db.gasOrder.create({
    data: { ...input, userId: actor.id, estimateNaira: estimate(seller.homePricePerKg, seller.deliveryFeeNaira, input.cylinderKg, input.cylinders) },
  });
  await createAlert({
    userId: seller.ownerId, kind: "GAS_ORDER", title: `New gas order: ${input.cylinders} × ${input.cylinderKg} kg`,
    body: `${input.area}, ${input.state}. Accept or decline it in Gas orders.`, link: `/hub/orders`, dedupeKey: `order:new:${order.id}`,
  });
  await audit(actor.id, "gas_order.place", "GasOrder", order.id);
  return order;
}

async function loadOrder(id: string) {
  const o = await db.gasOrder.findUnique({ where: { id }, include: { business: { select: { id: true, name: true, ownerId: true, city: true, state: true } } } });
  if (!o) throw new NotFoundError("Order not found");
  return o;
}

/** The customer and the seller's owner can see an order; nobody else. */
export async function getOrder(actor: Actor, id: string) {
  const o = await loadOrder(id);
  if (o.userId !== actor.id && o.business.ownerId !== actor.id) throw new NotFoundError("Order not found");
  return o;
}

export async function myOrders(actor: Actor) {
  return db.gasOrder.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 50, include: { business: { select: { name: true } } } });
}

export async function sellerOrders(actor: Actor) {
  const b = await requireMyBusiness(actor);
  return db.gasOrder.findMany({ where: { businessId: b.id }, orderBy: [{ createdAt: "desc" }], take: 100, include: { user: { select: { name: true } } } });
}

const STEP: Record<string, { from: GasOrderStatus[]; to: GasOrderStatus; title: string }> = {
  accept: { from: ["PLACED"], to: "ACCEPTED", title: "Your gas order was accepted" },
  decline: { from: ["PLACED"], to: "DECLINED", title: "Your gas order was declined" },
  dispatch: { from: ["ACCEPTED"], to: "OUT_FOR_DELIVERY", title: "Your gas is on the way" },
  deliver: { from: ["ACCEPTED", "OUT_FOR_DELIVERY"], to: "DELIVERED", title: "Your gas was delivered" },
};

/** The seller moves an order along. Accepting confirms the price the customer will pay on delivery. */
export async function advanceOrder(actor: Actor, id: string, step: keyof typeof STEP, opts: { priceNaira?: number | null; note?: string } = {}) {
  const o = await loadOrder(id);
  if (o.business.ownerId !== actor.id) throw new ForbiddenError();
  const s = STEP[step];
  if (!s) throw new AppError("Unknown step.");
  if (!s.from.includes(o.status)) throw new AppError("This order has already moved on.");
  const data: Partial<GasOrder> = { status: s.to, sellerNote: opts.note?.trim().slice(0, 300) ?? o.sellerNote };
  if (step === "accept") {
    const price = opts.priceNaira ?? o.estimateNaira;
    if (!price || price <= 0 || price > 1_000_000) throw new AppError("Enter the total the customer will pay on delivery.");
    data.priceNaira = Math.round(price);
  }
  if (step === "deliver") data.deliveredAt = new Date();
  const updated = await db.gasOrder.update({ where: { id }, data });
  const body =
    step === "accept" ? `${o.business.name} will deliver. Pay ${naira(data.priceNaira!)} on delivery.`
    : step === "decline" ? `${o.business.name} cannot deliver this order${data.sellerNote ? `: ${data.sellerNote}` : "."} Try another seller.`
    : step === "dispatch" ? `${o.business.name} is bringing your gas now.`
    : `Rate ${o.business.name} to help your neighbours choose.`;
  await createAlert({ userId: o.userId, kind: "GAS_ORDER", title: s.title, body, link: `/orders/${o.id}`, dedupeKey: `order:${step}:${o.id}` });
  await audit(actor.id, `gas_order.${step}`, "GasOrder", id);
  return updated;
}

/** The customer cancels before the gas leaves, and rates the seller once delivered. */
export async function cancelOrder(actor: Actor, id: string) {
  const o = await loadOrder(id);
  if (o.userId !== actor.id) throw new ForbiddenError();
  if (!["PLACED", "ACCEPTED"].includes(o.status)) throw new AppError("This order can no longer be cancelled here. Call the seller.");
  await db.gasOrder.update({ where: { id }, data: { status: "CANCELLED" } });
  await createAlert({ userId: o.business.ownerId, kind: "GAS_ORDER", title: "A gas order was cancelled", body: `${o.cylinders} × ${o.cylinderKg} kg to ${o.area}.`, link: "/hub/orders", dedupeKey: `order:cancel:${o.id}` });
  await audit(actor.id, "gas_order.cancel", "GasOrder", id);
}

export async function rateOrder(actor: Actor, id: string, rating: number) {
  const o = await loadOrder(id);
  if (o.userId !== actor.id) throw new ForbiddenError();
  if (o.status !== "DELIVERED") throw new AppError("You can rate an order once it is delivered.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError("Choose 1 to 5 stars.");
  await db.gasOrder.update({ where: { id }, data: { rating } });
}
