import { db } from "@/lib/db";
import type { Actor } from "@/lib/permissions";
import { audit } from "../audit";
import { requireAdmin } from "./guard";

const LIMIT = 50_000;

/** CSV cell: quoted when needed, and text a spreadsheet would run as a formula is prefixed with an apostrophe. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join("; ") : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

type Export = { label: string; about: string; build: () => Promise<{ header: string[]; rows: unknown[][] }> };

/** What can be exported. Delivery addresses, phone numbers and who reported what are deliberately left out. */
export const EXPORTS: Record<string, Export> = {
  users: {
    label: "Users",
    about: "Name, email, role, plan, kind of account, home state and join date. No passwords, phones or private content.",
    build: async () => ({
      header: ["id", "name", "email", "role", "plan", "audience", "home_state", "reporting_blocked", "created_at"],
      rows: (await db.user.findMany({ orderBy: { createdAt: "asc" }, take: LIMIT })).map((u) => [u.id, u.name, u.email, u.role, u.plan, u.audience, u.homeState, u.reportingBlocked, u.createdAt]),
    }),
  },
  businesses: {
    label: "Businesses",
    about: "Every trade hub business with roles, location, verification, CAC number, home delivery and plan.",
    build: async () => ({
      header: ["id", "name", "roles", "state", "city", "verification", "cac_number", "home_delivery", "delivery_states", "price_per_kg", "plan_until", "owner_email", "is_demo", "created_at"],
      rows: (await db.hubBusiness.findMany({ orderBy: { createdAt: "asc" }, take: LIMIT, include: { owner: { select: { email: true } } } })).map((b) => [b.id, b.name, b.roles, b.state, b.city, b.verification, b.registrationNumber, b.homeDelivery, b.deliveryStates, b.homePricePerKg, b.planUntil, b.owner.email, b.isDemo, b.createdAt]),
    }),
  },
  outlets: {
    label: "Stations & shops",
    about: "Places people added, with how many reports each has and whether it is hidden.",
    build: async () => ({
      header: ["id", "name", "brand", "kind", "state", "area", "address", "hidden", "reports", "is_demo", "created_at"],
      rows: (await db.outlet.findMany({ orderBy: [{ state: "asc" }, { name: "asc" }], take: LIMIT, include: { _count: { select: { reports: true } } } })).map((o) => [o.id, o.name, o.brand, o.kind, o.state, o.area, o.address, o.hidden, o._count.reports, o.isDemo, o.createdAt]),
    }),
  },
  "public-prices": {
    label: "Public price reports (90 days)",
    about: "Prices people paid at named places in the last 90 days, without who reported them. The basis of a consumer price index.",
    build: async () => ({
      header: ["id", "outlet", "kind", "state", "area", "item", "price_naira", "hidden", "reported_at"],
      rows: (await db.outletReport.findMany({ where: { kind: "PRICE", createdAt: { gte: new Date(Date.now() - 90 * 86_400_000) } }, orderBy: { createdAt: "asc" }, take: LIMIT, include: { outlet: { select: { name: true, kind: true, state: true, area: true } } } })).map((r) => [r.id, r.outlet.name, r.outlet.kind, r.outlet.state, r.outlet.area, r.item, r.priceNaira, r.hidden, r.createdAt]),
    }),
  },
  "seller-prices": {
    label: "Seller price reports (90 days)",
    about: "Prices sellers reported for the price board, by business, product, state and day.",
    build: async () => ({
      header: ["business", "item", "state", "price_naira", "day"],
      rows: (await db.priceReport.findMany({ where: { day: { gte: new Date(Date.now() - 90 * 86_400_000) } }, orderBy: { day: "asc" }, take: LIMIT, include: { business: { select: { name: true } } } })).map((r) => [r.business.name, r.item, r.state, r.priceNaira, r.day]),
    }),
  },
  "gas-orders": {
    label: "Gas orders",
    about: "Orders with seller, area, size, prices, status and rating. No customer names, addresses or phone numbers.",
    build: async () => ({
      header: ["id", "created_at", "status", "seller", "state", "area", "cylinder_kg", "cylinders", "estimate_naira", "price_naira", "delivered_at", "rating"],
      rows: (await db.gasOrder.findMany({ orderBy: { createdAt: "asc" }, take: LIMIT, include: { business: { select: { name: true } } } })).map((o) => [o.id, o.createdAt, o.status, o.business.name, o.state, o.area, o.cylinderKg, o.cylinders, o.estimateNaira, o.priceNaira, o.deliveredAt, o.rating]),
    }),
  },
  payments: {
    label: "Payments",
    about: "Payment references, provider, who paid, purpose, amount, currency (NGN or USD) and status.",
    build: async () => ({
      header: ["reference", "provider", "user_email", "purpose", "plan", "amount", "currency", "status", "created_at", "paid_at"],
      rows: (await db.payment.findMany({ orderBy: { createdAt: "asc" }, take: LIMIT, include: { user: { select: { email: true } } } })).map((p) => [p.reference, p.provider, p.user.email, p.purpose, p.planId, p.amountKobo / 100, p.currency, p.status, p.createdAt, p.paidAt]),
    }),
  },
};

export async function buildExport(actor: Actor, name: string) {
  requireAdmin(actor);
  const e = EXPORTS[name];
  if (!e) return null;
  const { header, rows } = await e.build();
  await audit(actor.id, "admin.export", "Export", name, { rows: rows.length });
  return { csv: toCsv(header, rows), rows: rows.length };
}
