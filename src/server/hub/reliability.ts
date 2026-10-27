import { db } from "@/lib/db";

/**
 * Reliability score, built only from trades both sides confirmed on RefineryLens. The formula is shown on every
 * business page so businesses can see what moves it. It is not a credit rating.
 */
export const RELIABILITY_MIN_RECORDS = 5;
/** After this many days past the due date, an unconfirmed delivery counts against the record. */
export const SETTLE_DAYS = 7;
const DAY = 86_400_000;

export const COMPONENTS = {
  confirmation: { label: "Deliveries confirmed by both sides", weight: 0.6, help: "Delivery jobs and supply deliveries confirmed by both sides, out of all that are due." },
  timeliness: { label: "On time (hauliers)", weight: 0.2, help: "Delivery jobs the haulier confirmed by the ready date plus the days quoted, plus one day." },
  quantity: { label: "Full quantity (suppliers)", weight: 0.2, help: "Quantity delivered against the agreed quantity under recurring supply, capped at 100% each time." },
} as const;
export type ComponentKey = keyof typeof COMPONENTS;
export type Component = { key: ComponentKey; value: number; n: number };

/** Weighted average of the components that have data, re-weighted to sum to one, as a 0–100 score. */
export function scoreFrom(components: Component[]): number | null {
  const present = components.filter((c) => c.n > 0);
  const w = present.reduce((s, c) => s + COMPONENTS[c.key].weight, 0);
  if (!w) return null;
  return Math.round((100 * present.reduce((s, c) => s + COMPONENTS[c.key].weight * c.value, 0)) / w);
}

export async function reliability(businessId: string, now = new Date()) {
  const [jobs, supply] = await Promise.all([
    db.deliveryJob.findMany({
      where: { status: { in: ["AWARDED", "DELIVERED"] }, OR: [{ posterId: businessId }, { quotes: { some: { haulierId: businessId, status: "ACCEPTED" } } }] },
      include: { quotes: { where: { status: "ACCEPTED" } } },
    }),
    db.supplyDelivery.findMany({ where: { agreement: { OR: [{ buyerId: businessId }, { sellerId: businessId }] } }, include: { agreement: true } }),
  ]);

  let due = 0;
  let confirmed = 0;
  let onTimeN = 0;
  let onTime = 0;
  for (const j of jobs) {
    const q = j.quotes[0];
    const expected = j.readyBy.getTime() + (q?.days ?? 0) * DAY;
    const done = j.status === "DELIVERED";
    if (done || expected + SETTLE_DAYS * DAY < now.getTime()) {
      due++;
      if (done) confirmed++;
    }
    if (done && q?.haulierId === businessId && j.haulierConfirmedAt) {
      onTimeN++;
      if (j.haulierConfirmedAt.getTime() <= expected + DAY) onTime++;
    }
  }
  let qtyN = 0;
  let qtySum = 0;
  for (const d of supply) {
    const both = !!d.buyerConfirmedAt && !!d.sellerConfirmedAt;
    if (both || d.createdAt.getTime() + SETTLE_DAYS * DAY < now.getTime()) {
      due++;
      if (both) confirmed++;
    }
    if (both && d.agreement.sellerId === businessId) {
      qtyN++;
      qtySum += Math.min(d.quantity / d.agreement.quantity, 1);
    }
  }
  const components: Component[] = [
    { key: "confirmation", value: due ? confirmed / due : 0, n: due },
    { key: "timeliness", value: onTimeN ? onTime / onTimeN : 0, n: onTimeN },
    { key: "quantity", value: qtyN ? qtySum / qtyN : 0, n: qtyN },
  ];
  const enough = confirmed >= RELIABILITY_MIN_RECORDS;
  return { confirmed, due, components, score: enough ? scoreFrom(components) : null };
}
