import { db } from "@/lib/db";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { naira, PRICE_ITEMS, summarisePrices, dayOf, MIN_SELLERS, WINDOW_DAYS } from "@/lib/hub/prices";
import { isPubliclyVisible } from "@/lib/hub/catalog";

/**
 * USSD price check for basic phones, through Africa's Talking USSD. Africa's Talking posts sessionId, serviceCode,
 * phoneNumber and text (the user's answers joined by "*"); the reply starts with "CON " to ask another question or
 * "END " to finish. Docs: https://developers.africastalking.com/docs/ussd/overview
 */

const MENU = ["lpg_retail_kg", "lpg_cyl_12_5", "ago_depot_litre", "pms_retail_litre", "cng_scm"] as const;

export function ussdConfigured() {
  return Boolean(process.env.USSD_TOKEN);
}

/** Matches what someone types for a state: "lagos", "Abuja", "fct", "akwa ibom". */
export function matchState(input: string): string | null {
  const t = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  if (t === "abuja" || t === "fct") return "FCT Abuja";
  return NIGERIAN_STATES.find((s) => s.toLowerCase() === t) ?? NIGERIAN_STATES.find((s) => s.toLowerCase().startsWith(t) && t.length >= 3) ?? null;
}

export async function ussdReply(text: string, now = new Date()): Promise<string> {
  const parts = text ? text.split("*") : [];
  if (parts.length === 0) {
    return `CON RefineryLens prices (median of sellers, last ${WINDOW_DAYS} days)\n${MENU.map((id, i) => `${i + 1}. ${PRICE_ITEMS.find((p) => p.id === id)!.label}`).join("\n")}`;
  }
  const item = PRICE_ITEMS.find((p) => p.id === MENU[Number(parts[0]) - 1]);
  if (!item) return "END Choose a number from the menu. Dial again to retry.";
  if (parts.length === 1) return "CON Type your state, e.g. Lagos or Kano";
  const state = matchState(parts.slice(1).join(" "));
  if (!state) return "END State not recognised. Dial again and type the state name, e.g. Ogun.";
  const since = new Date(dayOf(now).getTime() - 14 * 86_400_000);
  const rows = await db.priceReport.findMany({
    where: { item: item.id, state, day: { gte: since }, business: { verification: { not: "SUSPENDED" } } },
    select: { businessId: true, state: true, priceNaira: true, day: true, business: { select: { name: true, verification: true, isDemo: true } } },
  });
  const visible = rows.filter((r) => isPubliclyVisible(r.business));
  const cell = summarisePrices(visible, now).find((c) => c.state === state);
  if (!cell || cell.median === null) return `END Not enough sellers have reported ${item.label} in ${state} this week (needs ${MIN_SELLERS}). Try a nearby state.`;
  const demo = visible.some((r) => r.business.isDemo) ? " Includes demo data." : "";
  return `END ${item.label} in ${state}: ${naira(cell.median)} ${item.unit}, median of ${cell.sellers} sellers (${naira(cell.low!)}-${naira(cell.high!)}).${demo} Seller-reported, not an offer. refinerylens`;
}
