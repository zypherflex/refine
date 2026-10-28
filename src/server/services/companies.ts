import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const COMPANY_COOKIE = "rl_company";

export async function listCompanies() {
  return db.company.findMany({ orderBy: [{ isFictional: "asc" }, { name: "asc" }] });
}

/** The selected company comes from ?company=slug, then a cookie, then the first covered company. */
export async function selectedCompany(slug?: string | null) {
  const jar = await cookies();
  const wanted = slug || jar.get(COMPANY_COOKIE)?.value;
  const company = wanted ? await db.company.findUnique({ where: { slug: wanted } }) : null;
  return company ?? (await db.company.findFirst({ orderBy: [{ isFictional: "asc" }, { createdAt: "asc" }] }));
}

export async function companyFreshness(companyId: string) {
  const [ann, metric, doc, pendingReview] = await Promise.all([
    db.announcement.findFirst({ where: { companyId, status: "PUBLISHED" }, orderBy: { retrievedAt: "desc" }, select: { retrievedAt: true, sourcePublishedAt: true } }),
    db.metric.findFirst({ where: { companyId, status: "PUBLISHED" }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    db.document.findFirst({ where: { companyId, status: "APPROVED", visibility: "PUBLIC" }, orderBy: { retrievedAt: "desc" }, select: { retrievedAt: true } }),
    db.announcement.count({ where: { companyId, status: { in: ["DRAFT", "IN_REVIEW"] } } }),
  ]);
  const dates = [ann?.retrievedAt, metric?.updatedAt, doc?.retrievedAt].filter(Boolean) as Date[];
  const latest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
  return { latest, latestSourceDate: ann?.sourcePublishedAt ?? null, pendingReview };
}
