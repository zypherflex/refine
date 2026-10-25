import { db } from "@/lib/db";

export async function resetDb() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
}

let n = 0;
export async function user(role: "USER" | "ANALYST" | "EDITOR" | "ADMIN" = "USER") {
  n++;
  return db.user.create({ data: { email: `u${n}-${Date.now()}@test.local`, name: `User ${n}`, role, passwordHash: "x" } });
}

export async function company() {
  return db.company.create({ data: { slug: `co-${Date.now()}-${n++}`, name: "Test Refinery (fictional)", shortName: "TR", country: "X", sector: "Refining", description: "Test", isFictional: true } });
}

export async function source(approved = true) {
  return db.source.create({ data: { name: `Source ${n++}`, publisher: "Pub", provenance: "COMPANY_DISCLOSED", approved } });
}

export const baseAnnouncement = (companyId: string, sourceId?: string) => ({
  companyId,
  sourceId: sourceId ?? null,
  headline: "Throughput rose to 400,000 bpd in Q3",
  originalTitle: "Q3 operations update",
  publisher: "Test Refinery",
  sourceUrl: "https://example.org/q3",
  documentType: "PRESS_RELEASE" as const,
  sourcePublishedAt: new Date("2026-10-01"),
  provenance: "COMPANY_DISCLOSED" as const,
  summary: "The company reported average Q3 throughput of 400,000 bpd.",
  whyItMatters: "Higher utilization spreads fixed costs.",
  uncertainties: "Unaudited; no cash flow data.",
  topics: ["throughput", "utilization"],
  excerpts: [{ quote: "average throughput of 400,000 bpd" }],
});
