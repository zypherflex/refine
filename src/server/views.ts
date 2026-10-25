import { db } from "@/lib/db";
import type { EntityScope } from "@prisma/client";

/** The most recent published, disclosed value for a metric key (optionally for one scope). */
export async function latestMetric(companyId: string, key: string, scope?: EntityScope) {
  return db.metric.findFirst({
    where: { companyId, key, status: "PUBLISHED", ...(scope ? { scope } : {}), provenance: { not: "INDEPENDENT_REPORT" } },
    orderBy: [{ periodEnd: "desc" }, { updatedAt: "desc" }],
    include: { document: { select: { id: true, title: true } } },
  });
}

export async function openConflicts(companyId: string, staff = false) {
  return db.sourceConflict.findMany({
    where: { companyId, status: staff ? { in: ["UNRESOLVED", "DRAFT"] } : "UNRESOLVED" },
    include: { claims: { include: { announcement: { select: { id: true, headline: true } }, metric: { select: { id: true, documentId: true, page: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}
