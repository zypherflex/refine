import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { audit } from "../audit";
import type { MetricInput } from "@/lib/calculations";

export const FINANCIAL_KEYS = [
  ["revenue", "Revenue"],
  ["operating_profit", "Operating profit"],
  ["net_profit", "Net profit"],
  ["operating_cash_flow", "Operating cash flow"],
  ["capex", "Capital expenditure"],
  ["total_debt", "Total borrowings"],
  ["cash", "Cash and cash equivalents"],
  ["finance_costs", "Finance costs"],
  ["fx_gain_loss", "Foreign-exchange gain/(loss)"],
  ["dividends", "Dividends"],
] as const;

export const OPERATIONAL_KEYS = [
  ["nameplate_capacity", "Nameplate processing capacity"],
  ["throughput", "Actual crude throughput"],
  ["utilization", "Capacity utilization"],
  ["production_volume", "Refined product output"],
  ["product_yield", "Product yields"],
  ["domestic_sales", "Domestic sales volumes"],
  ["exports", "Export volumes"],
  ["crude_mix", "Crude procurement mix"],
  ["maintenance", "Disclosed maintenance and outages"],
  ["expansion", "Expansion milestones"],
  ["refining_margin", "Refining margin"],
] as const;

export async function listMetrics(actor: Actor | null, companyId: string, category: "FINANCIAL" | "OPERATIONAL") {
  const staff = can.viewEditorial(actor);
  return db.metric.findMany({
    where: { companyId, category, status: staff ? { in: ["PUBLISHED", "DRAFT"] } : "PUBLISHED" },
    orderBy: [{ key: "asc" }, { periodEnd: "asc" }],
    include: { document: { select: { id: true, title: true, status: true, visibility: true } }, legalEntity: true, conflictClaims: { include: { conflict: true } } },
  });
}

export function toCalcInput(m: { id: string; key: string; label: string; value: Prisma.Decimal | null; unit: string; currency: string | null; scale: string; scope: string; periodType: string; periodLabel: string; periodStart: Date | null; periodEnd: Date | null; auditStatus: string }): MetricInput {
  return { ...m, value: m.value === null ? null : Number(m.value) };
}

/** Correcting a published figure keeps the earlier value in the public corrections log. */
export async function correctMetric(actor: Actor, id: string, changes: { value?: number | null; periodLabel?: string; scope?: any; auditStatus?: any; page?: number | null; excerpt?: string; currency?: string | null; scale?: string; periodType?: string; periodStart?: Date | null; periodEnd?: Date | null }, summary: string) {
  if (!can.publish(actor)) throw new ForbiddenError();
  const m = await db.metric.findUnique({ where: { id } });
  if (!m) throw new NotFoundError();
  if (!summary || summary.trim().length < 10) throw new AppError("Describe the correction in at least 10 characters.");
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(changes)) {
    if (v === undefined) continue;
    const prev = (m as any)[k];
    const prevNorm = prev && typeof prev === "object" && "toNumber" in prev ? Number(prev) : prev instanceof Date ? prev.toISOString() : prev;
    const nextNorm = v instanceof Date ? v.toISOString() : v;
    if (JSON.stringify(prevNorm) !== JSON.stringify(nextNorm)) {
      before[k] = prevNorm;
      after[k] = nextNorm;
    }
  }
  if (Object.keys(after).length === 0) throw new AppError("No fields were changed.");
  await db.$transaction(async (tx) => {
    await tx.metric.update({ where: { id }, data: changes as any });
    await tx.correction.create({
      data: { entityType: "Metric", entityId: id, metricId: id, kind: m.status === "DRAFT" ? "EXTRACTION_FIX" : "CORRECTION", summary: summary.trim(), before: before as any, after: after as any, createdById: actor.id },
    });
    await audit(actor.id, "metric.correct", "Metric", id, { fields: Object.keys(after) }, tx);
  });
}

export async function publishMetric(actor: Actor, id: string) {
  if (!can.publish(actor)) throw new ForbiddenError();
  const m = await db.metric.findUnique({ where: { id }, include: { document: true } });
  if (!m) throw new NotFoundError();
  if (m.status !== "DRAFT") throw new AppError("Only draft figures can be published.");
  if (m.disclosureStatus === "DISCLOSED") {
    if (!m.documentId && !m.excerpt) throw new AppError("A disclosed figure needs a supporting document location or excerpt.");
    if (m.periodType === "UNKNOWN" || m.periodLabel === "Needs editor input") throw new AppError("Set the reporting period before publishing.");
    if (m.valueType === "ESTIMATED" && !m.methodology) throw new AppError("Estimated figures need a methodology note.");
    if (m.valueType === "CALCULATED" && !m.formula) throw new AppError("Calculated figures need a formula.");
  }
  await db.metric.update({ where: { id }, data: { status: "PUBLISHED" } });
  await audit(actor.id, "metric.publish", "Metric", id);
}

export async function rejectMetric(actor: Actor, id: string) {
  if (!can.publish(actor)) throw new ForbiddenError();
  const m = await db.metric.findUnique({ where: { id } });
  if (!m || m.status !== "DRAFT") throw new AppError("Only draft figures can be discarded.");
  await db.metric.update({ where: { id }, data: { status: "RETRACTED", notes: m.notes + " Discarded in review." } });
  await audit(actor.id, "metric.reject", "Metric", id);
}
