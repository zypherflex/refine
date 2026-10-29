/**
 * FICTIONAL DEMONSTRATION DATA.
 * "Lagoon Coast Refining Co." and every figure, document, source and announcement below are invented to
 * demonstrate RefineryLens. They do not describe any real company.
 */
import type { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createHash } from "node:crypto";
import { localStorageDriver } from "../src/server/storage";
import { extractPages } from "../src/server/extraction";

const FICTION = "FICTIONAL DEMONSTRATION DOCUMENT - NOT A REAL COMPANY";

async function makePdf(title: string, pages: string[][]): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(title);
  pages.forEach((lines, i) => {
    const page = pdf.addPage([595, 842]);
    page.drawText(FICTION, { x: 40, y: 810, size: 8, font: bold, color: rgb(0.7, 0.1, 0.1) });
    page.drawText(title, { x: 40, y: 780, size: 14, font: bold, color: rgb(0.04, 0.11, 0.2) });
    let y = 750;
    for (const line of lines) {
      for (const chunk of wrap(line, 95)) {
        page.drawText(chunk, { x: 40, y, size: 10, font });
        y -= 15;
      }
      y -= 4;
    }
    page.drawText(`Page ${i + 1}`, { x: 520, y: 30, size: 8, font });
  });
  return Buffer.from(await pdf.save());
}

function wrap(s: string, n: number): string[] {
  const words = s.split(" ");
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > n) {
      out.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

export async function seedDemo(db: PrismaClient, ids: { editorId: string; analystId: string }) {
  const company = await db.company.create({
    data: {
      slug: "demo-lagoon-coast",
      name: "Lagoon Coast Refining Co. (fictional demo)",
      shortName: "Lagoon Coast (demo)",
      country: "Fictional coastal state",
      sector: "Oil refining (fictional)",
      description:
        "A fictional refinery used to demonstrate every RefineryLens feature with realistic-looking data. Nothing on this company's pages is real.",
      coverageStatus: "DEMONSTRATION",
      coverageNote: "All content for this company is fictional sample data for demonstration only.",
      isFictional: true,
      legalEntities: {
        create: [
          { name: "Lagoon Coast Holdings Plc (fictional)", scope: "GROUP", notes: "Listed parent. Group figures include trading and logistics subsidiaries." },
          { name: "Lagoon Coast Refinery Ltd (fictional)", scope: "REFINERY", notes: "Operating company that owns the refinery." },
          { name: "Fictional national downstream sector", scope: "NATIONAL_SECTOR", notes: "Sector totals published by the fictional regulator." },
        ],
      },
    },
    include: { legalEntities: true },
  });
  const group = company.legalEntities.find((e) => e.scope === "GROUP")!;
  const refinery = company.legalEntities.find((e) => e.scope === "REFINERY")!;
  const sector = company.legalEntities.find((e) => e.scope === "NATIONAL_SECTOR")!;

  const src = async (name: string, provenance: any) =>
    db.source.create({ data: { name, publisher: name, provenance, approved: true, approvedById: ids.editorId, approvedAt: new Date("2026-06-01"), isFictional: true, homepageUrl: "https://example.org/fictional", licenseNotes: "Fictional source for demonstrations." } });
  const ir = await src("Lagoon Coast investor relations (fictional)", "COMPANY_DISCLOSED");
  const regulator = await src("Fictional Downstream Regulatory Authority", "REGULATOR_EXCHANGE");
  const ledger = await src("The Coastline Ledger (fictional newspaper)", "INDEPENDENT_REPORT");
  const desk = await src("RefineryLens analyst desk (demo)", "ANALYST_ESTIMATE");

  async function doc(title: string, sourceId: string, type: any, provenance: any, publishedAt: string, pages: string[][], topics: string[], status: "APPROVED" | "EXTRACTED" = "APPROVED") {
    const data = await makePdf(title, pages);
    const key = await localStorageDriver.put("library/public", data, "pdf");
    const text = await extractPages("pdf", data);
    return db.document.create({
      data: {
        companyId: company.id,
        sourceId,
        title,
        publisher: (await db.source.findUnique({ where: { id: sourceId } }))!.publisher,
        url: "https://example.org/fictional/" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        documentType: type,
        publishedAt: new Date(publishedAt),
        retrievedAt: new Date(new Date(publishedAt).getTime() + 3600_000 * 5),
        provenance,
        visibility: "PUBLIC",
        storageKey: key,
        originalName: title + ".pdf",
        mimeType: "application/pdf",
        sizeBytes: data.length,
        sha256: createHash("sha256").update(data).digest("hex"),
        pageCount: text.length,
        status,
        topics,
        isFictional: true,
        processingNote: `${text.length} page(s) extracted.`,
        pages: { create: text.map((t, i) => ({ pageNumber: i + 1, text: t })) },
      },
    });
  }

  const annual = await doc(
    "Lagoon Coast Holdings FY2025 Annual Report (fictional)",
    ir.id,
    "ANNUAL_REPORT",
    "COMPANY_DISCLOSED",
    "2026-07-03",
    [
      ["Chair's statement", "FY2025 was our first full year at stable operations. Average crude throughput rose to 330,000 barrels per day against nameplate capacity of 450,000 barrels per day.", "All figures are for Lagoon Coast Holdings Plc (group) and are audited unless stated. Currency: NGN."],
      ["Consolidated income statement (group, audited)", "Revenue: NGN 6,135.4 billion (FY2024: NGN 4,820.0 billion)", "Operating profit: NGN 688.9 billion (FY2024: NGN 512.3 billion)", "Finance costs: NGN 431.5 billion (FY2024: NGN 402.0 billion)", "Foreign exchange loss: NGN 120.2 billion (FY2024: NGN 455.0 billion)", "Net profit: NGN 210.4 billion (FY2024: loss of NGN 145.6 billion)"],
      ["Consolidated cash flow statement (group, audited)", "Net cash from operating activities: NGN 455.7 billion (FY2024: NGN 298.1 billion)", "Purchase of property, plant and equipment: NGN 340.5 billion (FY2024: NGN 610.0 billion)", "Operating cash flow was below operating profit mainly because trade receivables from domestic marketers increased by NGN 190 billion."],
      ["Balance sheet extracts (group, audited)", "Total borrowings: NGN 4,120.0 billion (FY2024: NGN 3,950.0 billion)", "Cash and cash equivalents: NGN 395.2 billion (FY2024: NGN 280.4 billion)", "Approximately 85 percent of borrowings are denominated in US dollars."],
      ["Dividends", "The board has not declared a dividend for FY2025 and has not stated a dividend policy."],
      ["Operations review (refinery)", "Nameplate capacity: 450,000 barrels per day. Average throughput FY2025: 330,000 barrels per day.", "A planned 21-day maintenance shutdown of crude unit 2 is scheduled for March 2026."],
    ],
    ["results", "cash-flow", "debt", "fx", "throughput"],
  );

  const interim = await doc(
    "Lagoon Coast H1 2026 Interim Results (fictional, unaudited)",
    ir.id,
    "INTERIM_REPORT",
    "COMPANY_DISCLOSED",
    "2026-09-30",
    [
      ["Highlights (unaudited)", "Six months to 30 June 2026. Figures are unaudited. Group figures are for Lagoon Coast Holdings Plc; refinery figures are for Lagoon Coast Refinery Ltd."],
      ["Group income and cash flow (unaudited)", "Revenue: NGN 3,410.2 billion", "Operating profit: NGN 402.7 billion", "Net profit: NGN 155.0 billion", "Net cash from operating activities: NGN 120.3 billion", "Capital expenditure: NGN 140.8 billion", "Operating cash flow was well below profit because receivables from domestic marketers rose by a further NGN 260 billion."],
      ["Group balance sheet and financing (unaudited)", "Total borrowings: NGN 4,050.0 billion", "Cash and cash equivalents: NGN 310.9 billion", "Finance costs: NGN 210.3 billion", "Foreign exchange gain: NGN 18.4 billion"],
      ["Refinery operations (Lagoon Coast Refinery Ltd)", "Average crude throughput H1 2026: 405,000 barrels per day. Nameplate capacity: 450,000 barrels per day.", "Refined product output: 52.8 million barrels. Yields: gasoline 38 percent, diesel 31 percent, jet fuel 9 percent, other 22 percent.", "Domestic deliveries: 31.0 million barrels. Crude slate: 62 percent domestic grades, 38 percent imported.", "Refinery revenue (refinery entity only): NGN 3,190.6 billion."],
    ],
    ["results", "cash-flow", "utilization", "throughput", "crude-supply"],
  );

  const bulletin = await doc(
    "Downstream Regulatory Authority bulletin, September 2026 (fictional)",
    regulator.id,
    "REGULATORY_PUBLICATION",
    "REGULATOR_EXCHANGE",
    "2026-10-06",
    [
      ["Fuel pricing framework", "From 1 January 2027 the authority will replace the current pump-price cap with a monthly formula linked to import parity, with a transition band of plus or minus 5 percent per month.", "The authority estimates national petrol consumption of 52 million litres per day in September 2026 (sector total, all suppliers)."],
    ],
    ["regulation", "margins", "domestic-sales"],
  );

  const ledgerDoc = await doc(
    "Coastline Ledger: Lagoon Coast ran below stated rates (fictional)",
    ledger.id,
    "NEWS_REPORT",
    "INDEPENDENT_REPORT",
    "2026-10-14",
    [["News report", "Two people familiar with operations told the Ledger that the refinery averaged about 360,000 barrels per day in the first half of 2026, below the 405,000 barrels per day stated by the company, because of feedstock shortages in May.", "The company declined to comment."]],
    ["throughput", "utilization", "crude-supply"],
  );

  const deskNote = await doc(
    "RefineryLens desk note: estimated refining margin H1 2026 (demo)",
    desk.id,
    "ANALYST_NOTE",
    "ANALYST_ESTIMATE",
    "2026-10-10",
    [["Method", "Estimated gross refining margin of USD 9.8 per barrel for H1 2026.", "Method: published product yields (gasoline 38 percent, diesel 31 percent, jet 9 percent, other 22 percent) multiplied by average regional product price assessments, minus an assumed crude cost of Brent plus USD 2.0 per barrel. Operating costs are excluded.", "This is an estimate, not a company disclosure. A change of USD 1 per barrel in the assumed crude premium changes the estimate by USD 1 per barrel."]],
    ["margins"],
  );

  // A document still in the editorial queue: extraction drafted figures that an editor must check.
  const trading = await doc(
    "Lagoon Coast Q3 2026 trading update (fictional)",
    ir.id,
    "PRESS_RELEASE",
    "COMPANY_DISCLOSED",
    "2026-10-22",
    [["Trading update (unaudited)", "Nine months to 30 September 2026.", "Revenue: NGN 5,205.0 billion", "Net cash from operating activities: NGN 210.6 billion", "Average throughput in Q3 2026: 372,000 barrels per day, reduced by an unplanned 9-day outage of crude unit 1."]],
    ["results", "throughput", "maintenance"],
    "EXTRACTED",
  );

  const metric = (d: any) => db.metric.create({ data: { companyId: company.id, provenance: "COMPANY_DISCLOSED", status: "PUBLISHED", isFictional: true, ...d } });
  const fy = (y: number) => ({ periodLabel: `FY${y}`, periodType: "FY", periodStart: new Date(`${y}-01-01`), periodEnd: new Date(`${y}-12-31`) });
  const h1 = { periodLabel: "H1 2026", periodType: "H1", periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-06-30") };
  const money = { unit: "NGN", currency: "NGN", scale: "billions", category: "FINANCIAL" };
  const fin: [string, string, number, number, number, number, number][] = [
    // key, label, FY24, FY25, H1'26, annual page, interim page
    ["revenue", "Revenue", 4820.0, 6135.4, 3410.2, 2, 2],
    ["operating_profit", "Operating profit", 512.3, 688.9, 402.7, 2, 2],
    ["net_profit", "Net profit", -145.6, 210.4, 155.0, 2, 2],
    ["operating_cash_flow", "Operating cash flow", 298.1, 455.7, 120.3, 3, 2],
    ["capex", "Capital expenditure", 610.0, 340.5, 140.8, 3, 2],
    ["total_debt", "Total borrowings", 3950.0, 4120.0, 4050.0, 4, 3],
    ["cash", "Cash and cash equivalents", 280.4, 395.2, 310.9, 4, 3],
    ["finance_costs", "Finance costs", 402.0, 431.5, 210.3, 2, 3],
    ["fx_gain_loss", "Foreign-exchange gain/(loss)", -455.0, -120.2, 18.4, 2, 3],
  ];
  const quote = (label: string, v: number) => `${label}: NGN ${Math.abs(v).toLocaleString("en-GB", { minimumFractionDigits: 1 })} billion`;
  for (const [key, label, a, b, c, pa, pi] of fin) {
    await metric({ ...money, key, label, value: a, ...fy(2024), scope: "GROUP", legalEntityId: group.id, auditStatus: "AUDITED", documentId: annual.id, page: pa, excerpt: `${label} comparative FY2024 shown in brackets on page ${pa}.` });
    await metric({ ...money, key, label, value: b, ...fy(2025), scope: "GROUP", legalEntityId: group.id, auditStatus: "AUDITED", documentId: annual.id, page: pa, excerpt: quote(label, b) });
    await metric({ ...money, key, label, value: c, ...h1, scope: "GROUP", legalEntityId: group.id, auditStatus: "UNAUDITED", documentId: interim.id, page: pi, excerpt: quote(label, c) });
  }
  await metric({ ...money, key: "revenue", label: "Revenue (refinery entity)", value: 3190.6, ...h1, scope: "REFINERY", legalEntityId: refinery.id, auditStatus: "UNAUDITED", documentId: interim.id, page: 4, excerpt: "Refinery revenue (refinery entity only): NGN 3,190.6 billion.", notes: "Refinery-entity figure. Not comparable with group revenue without a reconciliation, which the company has not published." });
  await metric({ ...money, key: "dividends", label: "Dividends", value: null, ...fy(2025), scope: "GROUP", legalEntityId: group.id, auditStatus: "AUDITED", disclosureStatus: "NOT_DISCLOSED", documentId: annual.id, page: 5, excerpt: "The board has not declared a dividend for FY2025 and has not stated a dividend policy." });

  const ops = { category: "OPERATIONAL", scope: "REFINERY", legalEntityId: refinery.id, scale: "units" };
  await metric({ ...ops, key: "nameplate_capacity", label: "Nameplate processing capacity", value: 450000, unit: "barrels per day", periodLabel: "As stated, H1 2026", periodType: "POINT", periodEnd: new Date("2026-06-30"), documentId: interim.id, page: 4, excerpt: "Nameplate capacity: 450,000 barrels per day." });
  const thrFy = await metric({ ...ops, key: "throughput", label: "Actual crude throughput", value: 330000, unit: "barrels per day", ...fy(2025), auditStatus: "NOT_APPLICABLE", documentId: annual.id, page: 6, excerpt: "Average throughput FY2025: 330,000 barrels per day." });
  const thrH1 = await metric({ ...ops, key: "throughput", label: "Actual crude throughput", value: 405000, unit: "barrels per day", ...h1, documentId: interim.id, page: 4, excerpt: "Average crude throughput H1 2026: 405,000 barrels per day." });
  const thrLedger = await metric({ ...ops, key: "throughput", label: "Actual crude throughput (independent report)", value: 360000, unit: "barrels per day", ...h1, provenance: "INDEPENDENT_REPORT", documentId: ledgerDoc.id, page: 1, excerpt: "the refinery averaged about 360,000 barrels per day in the first half of 2026", notes: "Anonymous sources; company declined to comment." });
  await metric({ ...ops, key: "utilization", label: "Capacity utilization", value: 90.0, unit: "%", ...h1, valueType: "CALCULATED", formula: "average throughput ÷ nameplate capacity × 100", inputs: [{ label: "Throughput H1 2026 (company)", value: 405000, unit: "bpd" }, { label: "Nameplate capacity", value: 450000, unit: "bpd" }], documentId: interim.id, page: 4, excerpt: "Average crude throughput H1 2026: 405,000 barrels per day. Nameplate capacity: 450,000 barrels per day.", notes: "Calculated by RefineryLens from company figures. Using the independently reported 360,000 bpd gives 80.0%." });
  await metric({ ...ops, key: "utilization", label: "Capacity utilization", value: 73.3, unit: "%", ...fy(2025), valueType: "CALCULATED", formula: "average throughput ÷ nameplate capacity × 100", inputs: [{ label: "Throughput FY2025", value: 330000, unit: "bpd" }, { label: "Nameplate capacity", value: 450000, unit: "bpd" }], documentId: annual.id, page: 6, excerpt: "Nameplate capacity: 450,000 barrels per day. Average throughput FY2025: 330,000 barrels per day." });
  await metric({ ...ops, key: "production_volume", label: "Refined product output", value: 52.8, unit: "million barrels", ...h1, documentId: interim.id, page: 4, excerpt: "Refined product output: 52.8 million barrels." });
  for (const [label, v] of [["Gasoline yield", 38], ["Diesel yield", 31], ["Jet fuel yield", 9], ["Other products yield", 22]] as const) {
    await metric({ ...ops, key: "product_yield", label, value: v, unit: "% of output", ...h1, documentId: interim.id, page: 4, excerpt: "Yields: gasoline 38 percent, diesel 31 percent, jet fuel 9 percent, other 22 percent." });
  }
  await metric({ ...ops, key: "domestic_sales", label: "Domestic deliveries", value: 31.0, unit: "million barrels", ...h1, documentId: interim.id, page: 4, excerpt: "Domestic deliveries: 31.0 million barrels.", notes: "Deliveries, not invoiced sales." });
  await metric({ ...ops, key: "exports", label: "Export volumes", value: null, unit: "", ...h1, disclosureStatus: "NOT_DISCLOSED", documentId: interim.id, page: 4, excerpt: "", notes: "The interim report does not state export volumes." });
  await metric({ ...ops, key: "crude_mix", label: "Domestic crude share", value: 62, unit: "% of crude slate", ...h1, documentId: interim.id, page: 4, excerpt: "Crude slate: 62 percent domestic grades, 38 percent imported.", inputs: [{ label: "Domestic grades", value: 62, unit: "%" }, { label: "Imported", value: 38, unit: "%" }] });
  await metric({ ...ops, key: "maintenance", label: "Planned shutdown, crude unit 2", value: 21, unit: "days", periodLabel: "March 2026", periodType: "EVENT", periodStart: new Date("2026-03-01"), periodEnd: new Date("2026-03-31"), documentId: annual.id, page: 6, excerpt: "A planned 21-day maintenance shutdown of crude unit 2 is scheduled for March 2026." });
  await metric({ ...ops, key: "expansion", label: "Polymer unit start-up (target)", value: null, unit: "", periodLabel: "Target Q1 2027", periodType: "EVENT", disclosureStatus: "DISCLOSED", notes: "Company moved the target from Q3 2026 to Q1 2027 (see superseded announcement).", excerpt: "Start-up now targeted for the first quarter of 2027." });
  await metric({ ...ops, key: "refining_margin", label: "Gross refining margin (estimate)", value: 9.8, unit: "USD per barrel", ...h1, provenance: "ANALYST_ESTIMATE", valueType: "ESTIMATED", methodology: "Published yields × average regional product price assessments, minus assumed crude cost of Brent + USD 2.0/bbl. Operating costs excluded. ±USD 1/bbl per USD 1 change in assumed crude premium.", documentId: deskNote.id, page: 1, excerpt: "Estimated gross refining margin of USD 9.8 per barrel for H1 2026." });
  await metric({ category: "OPERATIONAL", scope: "NATIONAL_SECTOR", legalEntityId: sector.id, scale: "units", key: "national_demand", label: "National petrol consumption (sector total)", value: 52, unit: "million litres per day", periodLabel: "September 2026", periodType: "MONTH", periodStart: new Date("2026-09-01"), periodEnd: new Date("2026-09-30"), provenance: "REGULATOR_EXCHANGE", documentId: bulletin.id, page: 1, excerpt: "national petrol consumption of 52 million litres per day in September 2026 (sector total, all suppliers)", notes: "All suppliers, including imports. Not a company figure." });

  // Draft figures from the trading update, as automatic extraction would produce them.
  for (const [key, label, value] of [["revenue", "Revenue", 5205.0], ["operating_cash_flow", "Operating cash flow", 210.6]] as const) {
    await metric({ ...money, key, label, value, periodLabel: "Needs editor input", periodType: "UNKNOWN", scope: "GROUP", status: "DRAFT", documentId: trading.id, page: 1, excerpt: `${label === "Revenue" ? "Revenue: NGN 5,205.0 billion" : "Net cash from operating activities: NGN 210.6 billion"}`, notes: "Automatically extracted. Check value, period, scope and audit status against the cited page before publishing." });
  }

  const ann = (d: any) =>
    db.announcement.create({
      data: {
        companyId: company.id,
        isFictional: true,
        status: "PUBLISHED",
        reviewerId: ids.editorId,
        sourceVersion: "1",
        createdById: ids.analystId,
        ...d,
        retrievedAt: d.retrievedAt ?? new Date(d.sourcePublishedAt.getTime() + 3 * 3600_000),
        reviewedAt: d.reviewedAt ?? new Date(d.sourcePublishedAt.getTime() + 20 * 3600_000),
        publishedAt: d.publishedAt ?? new Date(d.sourcePublishedAt.getTime() + 24 * 3600_000),
      },
    });

  const fyAnn = await ann({
    legalEntityId: group.id, sourceId: ir.id, headline: "FY2025 audited results: first full-year profit, debt still rising",
    originalTitle: "Lagoon Coast Holdings FY2025 Annual Report", publisher: ir.publisher, sourceUrl: annual.url, documentType: "ANNUAL_REPORT",
    eventDate: new Date("2025-12-31"), sourcePublishedAt: new Date("2026-07-03"), provenance: "COMPANY_DISCLOSED",
    summary: "The group reported an audited net profit of NGN 210.4 billion for FY2025 after a loss in FY2024, helped by a smaller foreign-exchange loss. Borrowings rose to NGN 4,120.0 billion.",
    whatChanged: "Net profit turned positive; FX losses fell from NGN 455.0 billion to NGN 120.2 billion.",
    whyItMatters: "Profitability improved mostly because currency losses shrank, not only because operations improved. Debt remains large relative to cash generation.",
    uncertainties: "About 85% of borrowings are in US dollars, so profit remains sensitive to the exchange rate. No dividend policy is stated.",
    alternativeExplanations: "Lower FX losses may reflect a calmer currency year rather than lasting hedging.",
    openQuestions: "How much of the FX exposure is hedged? What are the debt maturities?",
    topics: ["results", "debt", "fx", "cash-flow"],
    excerpts: { create: [{ documentId: annual.id, page: 2, quote: "Net profit: NGN 210.4 billion (FY2024: loss of NGN 145.6 billion)" }, { documentId: annual.id, page: 4, quote: "Total borrowings: NGN 4,120.0 billion (FY2024: NGN 3,950.0 billion)" }] },
  });

  const loan = await ann({
    legalEntityId: group.id, sourceId: ir.id, headline: "USD 1.2 billion term-loan refinancing signed",
    originalTitle: "Lagoon Coast signs refinancing facility", publisher: ir.publisher, sourceUrl: "https://example.org/fictional/refinancing", documentType: "PRESS_RELEASE",
    eventDate: new Date("2026-08-11"), sourcePublishedAt: new Date("2026-08-12"), provenance: "COMPANY_DISCLOSED",
    summary: "The group says it refinanced USD 1.2 billion of loans due in 2027 with a new facility maturing in 2031.",
    whatChanged: "Near-term maturities were pushed out by four years.",
    whyItMatters: "Extending maturities reduces refinancing pressure in 2027, but the debt is still in US dollars.",
    uncertainties: "The interest rate and covenants were not disclosed.",
    alternativeExplanations: "Lenders may have required tighter covenants in exchange for the longer tenor.",
    openQuestions: "What is the new interest margin? Are there cash sweep provisions?",
    topics: ["debt", "fx"],
    excerpts: { create: [{ quote: "refinanced USD 1.2 billion of loans due in 2027 with a new facility maturing in 2031" }] },
  });

  const h1Ann = await ann({
    legalEntityId: group.id, sourceId: ir.id, headline: "H1 2026 results: profit up, but operating cash flow lags as receivables rise",
    originalTitle: "Lagoon Coast H1 2026 Interim Results", publisher: ir.publisher, sourceUrl: interim.url, documentType: "INTERIM_REPORT",
    eventDate: new Date("2026-06-30"), sourcePublishedAt: new Date("2026-09-30"), provenance: "COMPANY_DISCLOSED",
    summary: "Unaudited H1 2026 net profit was NGN 155.0 billion, but operating cash flow was only NGN 120.3 billion because receivables from domestic marketers rose by NGN 260 billion. The company reported throughput of 405,000 bpd.",
    whatChanged: "Throughput rose to a reported 405,000 bpd (90% of capacity) while cash conversion weakened.",
    whyItMatters: "Higher utilization did not translate into cash in this period. If customers keep paying late, profit can overstate the cash available for debt service.",
    uncertainties: "Figures are unaudited. An independent report puts H1 throughput at about 360,000 bpd (see the conflict). Receivable ageing was not disclosed.",
    alternativeExplanations: "The receivables build may be seasonal or tied to a one-off delay in government-related payments.",
    openQuestions: "How old are the receivables? Is there credit insurance or a settlement mechanism with marketers?",
    topics: ["results", "cash-flow", "utilization", "throughput"],
    excerpts: { create: [{ documentId: interim.id, page: 2, quote: "Operating cash flow was well below profit because receivables from domestic marketers rose by a further NGN 260 billion." }, { documentId: interim.id, page: 4, quote: "Average crude throughput H1 2026: 405,000 barrels per day." }] },
  });

  const pricing = await ann({
    legalEntityId: sector.id, sourceId: regulator.id, headline: "Regulator to replace pump-price cap with import-parity formula from January 2027",
    originalTitle: "Downstream Regulatory Authority bulletin, September 2026", publisher: regulator.publisher, sourceUrl: bulletin.url, documentType: "REGULATORY_PUBLICATION",
    eventDate: new Date("2027-01-01"), sourcePublishedAt: new Date("2026-10-06"), provenance: "REGULATOR_EXCHANGE",
    summary: "From 1 January 2027 a monthly formula linked to import parity will replace the pump-price cap, with prices allowed to move up to 5% per month.",
    whatChanged: "The current price cap will end; prices will follow a formula with a ±5% monthly band.",
    whyItMatters: "Domestic prices closer to import parity could widen local refining margins, but the 5% band can delay pass-through when crude prices jump.",
    uncertainties: "The formula details and the treatment of locally refined product versus imports are not yet published. Policy could change before January.",
    alternativeExplanations: "If import parity falls, the formula could lower domestic prices and compress margins.",
    openQuestions: "Will locally refined product be priced at full import parity? How are FX rates set in the formula?",
    topics: ["regulation", "margins", "domestic-sales"],
    excerpts: { create: [{ documentId: bulletin.id, page: 1, quote: "From 1 January 2027 the authority will replace the current pump-price cap with a monthly formula linked to import parity" }] },
  });

  const ledgerAnn = await ann({
    legalEntityId: refinery.id, sourceId: ledger.id, headline: "Newspaper reports H1 throughput nearer 360,000 bpd than the 405,000 bpd stated",
    originalTitle: "Lagoon Coast ran below stated rates", publisher: ledger.publisher, sourceUrl: ledgerDoc.url, documentType: "NEWS_REPORT",
    eventDate: new Date("2026-06-30"), sourcePublishedAt: new Date("2026-10-14"), provenance: "INDEPENDENT_REPORT",
    summary: "The Coastline Ledger, citing two unnamed people, reports average H1 2026 throughput of about 360,000 bpd because of feedstock shortages in May. The company declined to comment.",
    whatChanged: "An independent claim now conflicts with the company's stated H1 throughput.",
    whyItMatters: "If correct, utilization would be about 80% rather than 90%, and crude supply reliability would be a bigger risk than reported.",
    uncertainties: "Anonymous sources; methodology unknown. The company has not responded.",
    alternativeExplanations: "The sources may be describing a single month or a single unit rather than the half-year average.",
    openQuestions: "Will the company clarify H1 throughput? What happened to feedstock supply in May?",
    topics: ["throughput", "utilization", "crude-supply"],
    excerpts: { create: [{ documentId: ledgerDoc.id, page: 1, quote: "the refinery averaged about 360,000 barrels per day in the first half of 2026" }] },
  });

  const outage = await ann({
    legalEntityId: refinery.id, sourceId: ir.id, headline: "Crude unit 1 back online after unplanned 9-day outage",
    originalTitle: "Operational update", publisher: ir.publisher, sourceUrl: "https://example.org/fictional/operational-update", documentType: "PRESS_RELEASE",
    eventDate: new Date("2026-10-18"), sourcePublishedAt: new Date("2026-10-20"), provenance: "COMPANY_DISCLOSED",
    summary: "The company says crude unit 1 restarted on 18 October after an unplanned 9-day outage caused by a compressor failure.",
    whatChanged: "An unplanned outage occurred in October; the unit has restarted.",
    whyItMatters: "Unplanned outages reduce throughput and may raise maintenance costs. Two outages within a year would point to reliability issues.",
    uncertainties: "The company did not quantify lost production or say whether insurance covers it.",
    alternativeExplanations: "A single compressor failure may be an isolated event.",
    openQuestions: "How much throughput was lost in Q4? Is the root cause resolved?",
    topics: ["maintenance", "throughput"],
    excerpts: { create: [{ quote: "crude unit 1 restarted on 18 October after an unplanned 9-day outage" }] },
  });

  // A retracted item stays visible with its retraction notice.
  const retracted = await ann({
    legalEntityId: refinery.id, sourceId: ledger.id, headline: "Report: export licence suspended",
    originalTitle: "Lagoon Coast export licence suspended, sources say", publisher: ledger.publisher, sourceUrl: "https://example.org/fictional/export-licence", documentType: "NEWS_REPORT",
    eventDate: new Date("2026-09-08"), sourcePublishedAt: new Date("2026-09-09"), provenance: "INDEPENDENT_REPORT",
    summary: "A newspaper reported that the refinery's product export licence had been suspended.",
    whyItMatters: "A suspension would remove an outlet for surplus product.", uncertainties: "Single anonymous source.",
    topics: ["exports", "regulation"], status: "RETRACTED", retractedAt: new Date("2026-09-11"), revision: 2,
    retractionReason: "The regulator confirmed on 11 September that no licence was suspended, and the newspaper withdrew its report.",
    excerpts: { create: [{ quote: "export licence had been suspended" }] },
  });
  await db.correction.create({ data: { entityType: "Announcement", entityId: retracted.id, announcementId: retracted.id, kind: "RETRACTION", summary: retracted.retractionReason, createdById: ids.editorId, createdAt: new Date("2026-09-11T10:00:00Z") } });

  // A superseded item, linked to its replacement.
  const oldPolymer = await ann({
    legalEntityId: refinery.id, sourceId: ir.id, headline: "Polymer unit start-up targeted for Q3 2026",
    originalTitle: "Project update", publisher: ir.publisher, sourceUrl: "https://example.org/fictional/project-update-1", documentType: "PRESS_RELEASE",
    sourcePublishedAt: new Date("2026-03-15"), provenance: "COMPANY_DISCLOSED",
    summary: "The company targeted mechanical completion and start-up of its polymer unit in Q3 2026.",
    whyItMatters: "The unit would diversify revenue beyond fuels.", uncertainties: "No budget update was given.",
    topics: ["expansion"], status: "SUPERSEDED",
    excerpts: { create: [{ quote: "start-up of the polymer unit in the third quarter of 2026" }] },
  });
  await ann({
    legalEntityId: refinery.id, sourceId: ir.id, headline: "Polymer unit start-up moved to Q1 2027",
    originalTitle: "Project update", publisher: ir.publisher, sourceUrl: "https://example.org/fictional/project-update-2", documentType: "PRESS_RELEASE",
    sourcePublishedAt: new Date("2026-09-02"), provenance: "COMPANY_DISCLOSED", supersedesId: oldPolymer.id,
    summary: "The company now targets polymer unit start-up in Q1 2027, citing delayed delivery of a reactor.",
    whatChanged: "Start-up slipped by about two quarters.",
    whyItMatters: "Delays push back diversification and may add cost.",
    uncertainties: "No revised budget was given.", alternativeExplanations: "The delay may be limited to one supplier.", openQuestions: "Has the project budget changed?",
    topics: ["expansion"],
    excerpts: { create: [{ quote: "Start-up now targeted for the first quarter of 2027." }] },
  });
  await db.correction.create({ data: { entityType: "Announcement", entityId: oldPolymer.id, announcementId: oldPolymer.id, kind: "SUPERSESSION", summary: "Superseded by “Polymer unit start-up moved to Q1 2027”.", createdById: ids.editorId, createdAt: new Date("2026-09-03T09:00:00Z") } });

  // An AI-drafted item awaiting human review.
  await db.announcement.create({
    data: {
      companyId: company.id, legalEntityId: group.id, sourceId: ir.id, isFictional: true, status: "IN_REVIEW", aiGenerated: true, createdById: ids.analystId,
      headline: "Q3 2026 trading update: revenue NGN 5,205.0 billion for nine months",
      originalTitle: "Lagoon Coast Q3 2026 trading update", publisher: ir.publisher, sourceUrl: trading.url, documentType: "PRESS_RELEASE",
      sourcePublishedAt: new Date("2026-10-22"), retrievedAt: new Date("2026-10-22T14:00:00Z"), provenance: "COMPANY_DISCLOSED",
      summary: "AI draft: nine-month revenue of NGN 5,205.0 billion and operating cash flow of NGN 210.6 billion; Q3 throughput averaged 372,000 bpd after an unplanned outage.",
      whatChanged: "Q3 throughput fell from the H1 level.",
      whyItMatters: "Lower throughput and weak cash conversion would challenge a utilization-led recovery case.",
      uncertainties: "Unaudited trading update; Q3-only figures must be derived by subtracting H1, which the company did not do.",
      topics: ["results", "throughput", "cash-flow"],
      excerpts: { create: [{ documentId: trading.id, page: 1, quote: "Average throughput in Q3 2026: 372,000 barrels per day" }] },
    },
  });

  await db.sourceConflict.create({
    data: {
      companyId: company.id,
      topic: "H1 2026 average throughput",
      description: "The company and an independent newspaper give different averages for the same period. Both are shown; RefineryLens has not chosen between them.",
      status: "UNRESOLVED",
      flaggedById: ids.editorId,
      claims: {
        create: [
          { claim: "405,000 barrels per day", sourceLabel: "Company H1 2026 interim results, p.4", sourceDate: new Date("2026-09-30"), provenance: "COMPANY_DISCLOSED", announcementId: h1Ann.id, metricId: thrH1.id },
          { claim: "About 360,000 barrels per day", sourceLabel: "The Coastline Ledger (anonymous sources)", sourceDate: new Date("2026-10-14"), provenance: "INDEPENDENT_REPORT", announcementId: ledgerAnn.id, metricId: thrLedger.id },
        ],
      },
    },
  });

  const risk = async (d: any, evidence: { id: string; note: string }[] = []) =>
    db.risk.create({ data: { companyId: company.id, status: "PUBLISHED", isFictional: true, ...d, evidence: { create: evidence.map((e) => ({ announcementId: e.id, note: e.note })) } } });
  await risk({ category: "CRUDE_SUPPLY", title: "Feedstock shortages may limit throughput", summary: "An independent report links lower H1 throughput to crude shortages in May.", evidenceSummary: "Newspaper report (anonymous sources); 62% of crude is from domestic grades.", impactPathway: "Short supply lowers throughput, spreading fixed costs over fewer barrels.", horizon: "Near term (next 2 quarters)", severity: "HIGH", confidence: "MODERATE", evidenceQuality: "One independent report with anonymous sources, plus disclosed crude mix.", uncertainty: "The company has not confirmed any shortage.", clarifyingDisclosure: "Monthly throughput and crude receipts by source." }, [{ id: ledgerAnn.id, note: "Independent claim of shortages" }]);
  await risk({ category: "PRICES_AND_MARGINS", title: "Margins depend on the new pricing formula", summary: "The 2027 import-parity formula could widen or compress domestic margins.", evidenceSummary: "Regulator bulletin; analyst margin estimate of USD 9.8/bbl for H1 2026.", impactPathway: "Domestic prices set the revenue per barrel; crude costs follow international prices.", horizon: "Medium term (2027)", severity: "HIGH", confidence: "LOW", evidenceQuality: "Official policy statement; margin is an estimate.", uncertainty: "Formula details are unpublished.", clarifyingDisclosure: "Published formula and company commentary on margins." }, [{ id: pricing.id, note: "Pricing reform" }]);
  await risk({ category: "FOREIGN_EXCHANGE", title: "Dollar debt against local-currency sales", summary: "About 85% of borrowings are in US dollars while most sales are domestic.", evidenceSummary: "Annual report p.4; FX losses of NGN 455.0 bn (FY2024) and 120.2 bn (FY2025).", impactPathway: "Currency weakness raises debt in local terms and can produce large accounting losses.", horizon: "Ongoing", severity: "HIGH", confidence: "HIGH", evidenceQuality: "Audited disclosure.", uncertainty: "Hedging is not disclosed.", clarifyingDisclosure: "Hedging policy and currency split of revenue." }, [{ id: fyAnn.id, note: "FX losses in audited results" }]);
  await risk({ category: "DEBT_AND_LIQUIDITY", title: "High leverage and weak cash conversion", summary: "Borrowings of NGN 4,050 bn against H1 operating cash flow of NGN 120 bn.", evidenceSummary: "Interim results; refinancing extended 2027 maturities.", impactPathway: "If receivables keep rising, cash for debt service tightens.", horizon: "Near to medium term", severity: "HIGH", confidence: "MODERATE", evidenceQuality: "Company disclosures, unaudited for H1.", uncertainty: "Debt maturity schedule beyond the refinancing is not public.", clarifyingDisclosure: "Maturity profile, covenants and receivable ageing." }, [{ id: h1Ann.id, note: "Cash conversion" }, { id: loan.id, note: "Refinancing" }]);
  await risk({ category: "OPERATIONAL_RELIABILITY", title: "Unplanned outages", summary: "An unplanned 9-day outage in October followed planned maintenance in March.", evidenceSummary: "Company operational update.", impactPathway: "Outages cut throughput and may raise repair costs.", horizon: "Near term", severity: "MODERATE", confidence: "MODERATE", evidenceQuality: "Company disclosure; lost volumes not quantified.", uncertainty: "Root cause and insurance cover unknown.", clarifyingDisclosure: "Q4 throughput and incident report." }, [{ id: outage.id, note: "Outage" }]);
  await risk({ category: "REGULATION_AND_TAX", title: "Policy changes to pricing and licensing", summary: "Pricing reform and past (retracted) licence reports show regulatory sensitivity.", evidenceSummary: "Regulator bulletin.", impactPathway: "Rules on pricing, exports and tax directly affect revenue.", horizon: "Medium term", severity: "MODERATE", confidence: "MODERATE", evidenceQuality: "Official source.", uncertainty: "Implementation details pending.", clarifyingDisclosure: "Final formula and any tax changes." }, [{ id: pricing.id, note: "Policy" }]);
  await risk({ category: "COMPETITION", title: "Imports set the price ceiling", summary: "Under import parity, imported product competes directly with local supply.", evidenceSummary: "Regulator bulletin; national consumption is a sector total including imports.", impactPathway: "Importers can undercut when international cargoes are cheap.", horizon: "Medium term", severity: "MODERATE", confidence: "LOW", evidenceQuality: "Inference from policy design (interpretation).", uncertainty: "Market shares are not disclosed.", clarifyingDisclosure: "Company market share and import volumes." });
  await risk({ category: "EXPANSION_EXECUTION", title: "Polymer unit delay", summary: "Start-up moved from Q3 2026 to Q1 2027.", evidenceSummary: "Two company project updates (one superseded).", impactPathway: "Delays push back revenue and may add cost.", horizon: "Near term", severity: "LOW", confidence: "HIGH", evidenceQuality: "Company disclosure.", uncertainty: "Budget impact unknown.", clarifyingDisclosure: "Updated project budget." });
  await risk({ category: "GOVERNANCE", title: "Conflicting operating data", summary: "Company and independent figures for H1 throughput differ by 45,000 bpd.", evidenceSummary: "Open source conflict.", impactPathway: "Unclear operating data makes all utilization-based analysis less reliable.", horizon: "Until clarified", severity: "MODERATE", confidence: "MODERATE", evidenceQuality: "Two sources of different quality.", uncertainty: "Neither figure is independently audited.", clarifyingDisclosure: "Company clarification or audited operating data." }, [{ id: ledgerAnn.id, note: "Conflicting claim" }]);
  await risk({ category: "ENVIRONMENT_AND_COMMUNITY", title: "Limited environmental disclosure", summary: "No emissions or community data has been published.", evidenceSummary: "Absence of disclosure in annual and interim reports.", impactPathway: "Incidents or tighter rules could bring fines or operating limits.", horizon: "Long term", severity: "MODERATE", confidence: "LOW", evidenceQuality: "Absence of evidence only.", uncertainty: "Actual performance unknown.", clarifyingDisclosure: "Emissions, flaring and incident reporting." });

  return { company, announcements: { fyAnn, loan, h1Ann, pricing, ledgerAnn, outage }, documents: { annual, interim } };
}
