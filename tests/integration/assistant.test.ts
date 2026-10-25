import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { answerQuestion } from "@/server/assistant/engine";
import { createThesis } from "@/server/services/thesis";
import { company, resetDb, user } from "../helpers";

async function fixture() {
  const [reader, co] = await Promise.all([user(), company()]);
  const doc = await db.document.create({ data: { companyId: co.id, title: "FY2025 report (fictional)", visibility: "PUBLIC", status: "APPROVED", provenance: "COMPANY_DISCLOSED", pageCount: 2, isFictional: true, pages: { create: [{ pageNumber: 1, text: "Chair statement" }, { pageNumber: 2, text: "Revenue: NGN 100.0 billion. Operating profit: NGN 12.0 billion." }] } } });
  const base = { companyId: co.id, category: "FINANCIAL" as const, unit: "NGN", currency: "NGN", scale: "billions", scope: "GROUP" as const, periodType: "FY", periodLabel: "FY2025", periodStart: new Date("2025-01-01"), periodEnd: new Date("2025-12-31"), provenance: "COMPANY_DISCLOSED" as const, status: "PUBLISHED" as const, auditStatus: "AUDITED" as const, documentId: doc.id, page: 2 };
  await db.metric.create({ data: { ...base, key: "revenue", label: "Revenue", value: 100 } });
  await db.metric.create({ data: { ...base, key: "operating_profit", label: "Operating profit", value: 12 } });
  await db.metric.create({ data: { ...base, key: "operating_cash_flow", label: "Operating cash flow", value: 8 } });
  await db.metric.create({ data: { ...base, key: "net_profit", label: "Net profit", value: 10 } });
  await db.metric.create({ data: { ...base, key: "dividends", label: "Dividends", value: null, disclosureStatus: "NOT_DISCLOSED" } });
  const ann = await db.announcement.create({
    data: { companyId: co.id, headline: "Throughput fell after outage", originalTitle: "Ops", publisher: "Co", sourceUrl: "https://example.org", documentType: "PRESS_RELEASE", sourcePublishedAt: new Date("2026-10-10"), retrievedAt: new Date("2026-10-11"), provenance: "COMPANY_DISCLOSED", summary: "Throughput fell to 300,000 bpd after an outage.", whyItMatters: "Lower utilization.", uncertainties: "Duration unknown.", topics: ["throughput", "utilization"], status: "PUBLISHED", publishedAt: new Date() },
  });
  await db.announcement.create({ data: { companyId: co.id, headline: "Secret draft about a merger", originalTitle: "x", publisher: "x", sourceUrl: "https://example.org/d", documentType: "OTHER", sourcePublishedAt: new Date("2026-10-12"), retrievedAt: new Date(), provenance: "UNVERIFIED", summary: "Unreviewed merger rumour.", whyItMatters: "x", uncertainties: "x", status: "DRAFT" } });
  return { reader, co, doc, ann };
}

describe("cited research assistant (evidence mode)", () => {
  beforeEach(resetDb);

  it("answers 'what changed' from published items only, with citations and a cut-off date", async () => {
    const { reader, co, ann } = await fixture();
    const a = await answerQuestion(reader, { companyId: co.id, question: "What changed this month?" });
    expect(a.cutoff).not.toBeNull();
    expect(a.evidence.length).toBeGreaterThan(0);
    expect(a.sources.some((s) => s.announcementId === ann.id)).toBe(true);
    expect(JSON.stringify(a)).not.toMatch(/merger/);
    // Every claim cites a listed source.
    const refs = new Set(a.sources.map((s) => s.ref));
    for (const e of a.evidence) expect(e.refs.every((r) => refs.has(r))).toBe(true);
  });

  it("explains a report with page citations and shows calculation formulas", async () => {
    const { reader, co, doc } = await fixture();
    const a = await answerQuestion(reader, { companyId: co.id, question: "Explain this report in simple language." });
    expect(a.sources.some((s) => s.documentId === doc.id && s.page === 2)).toBe(true);
    const margin = a.calculations.find((c) => c.name.startsWith("Operating margin"));
    expect(margin?.result).toBeCloseTo(12, 5);
    expect(margin?.formula).toMatch(/÷/);
    expect(a.evidence.some((e) => e.kind === "FACT")).toBe(true);
    expect(a.missing.join(" ")).toMatch(/Dividends: not publicly disclosed/);
  });

  it("separates a general explanation from company-specific evidence", async () => {
    const { reader, co } = await fixture();
    const a = await answerQuestion(reader, { companyId: co.id, question: "Why can higher fuel prices fail to increase profit?" });
    expect(a.generalExplanation).toMatch(/margin/i);
    expect(["GENERAL", "MIXED"]).toContain(a.scope);
  });

  it("says when evidence is insufficient instead of guessing", async () => {
    const { reader, co } = await fixture();
    const a = await answerQuestion(reader, { companyId: co.id, question: "What is the CEO's favourite colour?" });
    expect(a.insufficientEvidence).toBe(true);
    expect(a.sources).toHaveLength(0);
  });

  it("lists missing information", async () => {
    const { reader, co } = await fixture();
    const a = await answerQuestion(reader, { companyId: co.id, question: "What information is missing from this analysis?" });
    expect(a.missing.some((m) => m.startsWith("Actual crude throughput"))).toBe(true);
  });

  it("tests the user's own thesis against disclosures", async () => {
    const { reader, co } = await fixture();
    await createThesis(reader, { companyId: co.id, title: "Utilization case", rationale: "Utilization will rise and lift cash flow.", assumptions: [{ statement: "Utilization rises", topics: ["utilization"] }] });
    const a = await answerQuestion(reader, { companyId: co.id, question: "Which disclosures challenge my saved thesis?" });
    expect(a.evidence.length).toBeGreaterThan(0);
    expect(a.directAnswer).toMatch(/has not changed your thesis/);
  });
});
