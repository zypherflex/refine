import { db } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { can, type Actor } from "@/lib/permissions";
import { audit } from "../audit";

/**
 * Market and macro context series. Readers only see series whose source an editor has approved; staff also see the
 * rest so they can check the data before approving.
 */
export async function listMarketSeries(actor: Actor | null, opts: { days?: number } = {}) {
  const staff = can.viewEditorial(actor);
  const since = new Date(Date.now() - (opts.days ?? 400) * 86_400_000);
  const series = await db.marketSeries.findMany({
    where: staff ? {} : { source: { approved: true } },
    include: { source: true, observations: { orderBy: { periodStart: "desc" }, take: 400 } },
    orderBy: { key: "asc" },
  });
  return series.map((s) => ({
    ...s,
    // Annual and monthly series keep their full history; daily ones are trimmed to the window.
    observations: s.observations.filter((o) => s.frequency !== "DAILY" || o.periodStart >= since).reverse(),
  }));
}

export type MarketSeriesView = Awaited<ReturnType<typeof listMarketSeries>>[number];

export async function latestIngestionRuns() {
  const rows = await db.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 40 });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.provider)) latest.set(r.provider, r);
  return latest;
}

export async function listNewsLeads(actor: Actor, companyId: string | null, status = "NEW") {
  if (!can.viewEditorial(actor)) throw new ForbiddenError();
  return db.newsLead.findMany({ where: { status, ...(companyId ? { companyId } : {}) }, include: { company: { select: { shortName: true, name: true } } }, orderBy: { seenAt: "desc" }, take: 100 });
}

/** Marks a lead as handled. "DRAFTED" when an analyst starts an announcement from it, "DISMISSED" when it is not useful. */
export async function reviewNewsLead(actor: Actor, id: string, status: "DRAFTED" | "DISMISSED" | "NEW") {
  if (!can.draftContent(actor)) throw new ForbiddenError();
  const lead = await db.newsLead.findUnique({ where: { id } });
  if (!lead) throw new NotFoundError();
  if (!["DRAFTED", "DISMISSED", "NEW"].includes(status)) throw new AppError("Unknown lead status.");
  const updated = await db.newsLead.update({ where: { id }, data: { status, reviewedById: actor.id, reviewedAt: new Date() } });
  await audit(actor.id, `news_lead.${status.toLowerCase()}`, "NewsLead", id);
  return updated;
}
