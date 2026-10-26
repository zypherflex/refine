/**
 * Dangote coverage, built only from the company's own public website, retrieved 25 October 2026. It is the
 * factual base for the business-opportunities hub. Product copy says "Dangote", never "Dangote refinery"
 * (a standing product decision); the news search query below keeps the full name only because it is a search string.
 *
 * Everything here is labelled COMPANY_DISCLOSED and enters the editorial queue as a draft: summaries were
 * drafted by an AI model and must be reviewed by a human editor before publication. No figures were
 * invented. RefineryLens is independent and is not affiliated with the company.
 */
import type { PrismaClient } from "@prisma/client";

const RETRIEVED = new Date("2026-10-25T16:30:00Z");
const SITE = "https://refinery.dangote.com";

const fact = (label: string, value: string, path: string, extra: Record<string, unknown> = {}) => ({ label, value, sourceUrl: SITE + path, retrievedAt: RETRIEVED.toISOString(), ...extra });

export async function seedDangote(db: PrismaClient, editorId: string) {
  const company = await db.company.create({
    data: {
      slug: "dangote",
      name: "Dangote (Lekki complex)",
      shortName: "Dangote",
      country: "Nigeria",
      sector: "Oil refining and petrochemicals",
      description:
        "Dangote's merchant refining and petrochemicals complex in the Lekki Free Zone, Lagos, Nigeria, and the anchor for the business opportunities in RefineryLens. The description and facts on this page are taken from the company's public website and are shown with their source. RefineryLens is an independent research platform and is not affiliated with, endorsed by or sponsored by the company.",
      coverageStatus: "IN_PREPARATION",
      coverageNote:
        "Coverage is being prepared from the company's public website. Drafted items are awaiting editor review. The company states that financial information will be made available to qualified institutional investors through its formal capital markets process, so no financial results are shown.",
      isFictional: false,
      // News monitoring (GDELT) query for editors' news leads.
      newsQuery: '("Dangote refinery" OR "Dangote Petroleum Refinery")',
      // `group` places a fact on the profile; `figure`/`unit` make it a headline tile; `claim` marks promotional or
      // comparative statements that RefineryLens cannot verify (rankings, "global" reach) and must label as such.
      profileFacts: [
        fact("Stated crude distillation (CDU) capacity", "700,000 barrels per day", "/facilities/", { group: "scale", figure: "700,000", unit: "barrels per day, stated CDU capacity" }),
        fact("Stated expansion pathway", "1.4 million barrels per day (no timeline published)", "/about-us/", { group: "scale", figure: "1.4 million", unit: "bpd stated expansion pathway, no timeline" }),
        fact("Nelson Complexity Index (stated)", "11.5", "/facilities/", { group: "scale", figure: "11.5", unit: "Nelson Complexity Index, stated" }),
        fact("Polypropylene (stated)", "830 KTPA total (Train I 500 KTPA, Train II 330 KTPA), INEOS technology, 12 homopolymer grades; the home page says “12 premium grades today, scaling up to 155”", "/facilities/", { group: "scale", figure: "830", unit: "KTPA polypropylene, stated" }),
        fact("Marine access (stated)", "3 km deepwater jetty with multi-berth operations", "/facilities/", { group: "facility" }),
        fact("Location", "Lekki Free Trade Zone, Ibeju Lekki, Lagos, Nigeria", "/about-us/", { group: "facility" }),
        fact("Business model", "Described by the company as a “merchant refining business”", "/about-us/", { group: "facility" }),
        fact("Fuel products (stated)", "Gasoline (PMS), diesel (AGO), Jet A-1 and LPG; transport fuels stated to meet Euro V specifications, ≤10 ppm sulphur where applicable, MMT-free", "/products/", { group: "facility" }),
        fact("Power (stated)", "Independent on-site generation; capacity not published", "/facilities/", { group: "facility" }),
        fact("Size claim (about page)", "“the largest single-train refinery in the world”, with “a current CDU capacity of 700,000 barrels per day”", "/about-us/", { group: "global", claim: true }),
        fact("Size claim (home page)", "“1.4 million barrels per day – Africa's largest single-train refinery”, a figure the about page describes as an expansion pathway", "/", { group: "global", claim: true }),
        fact("Positioning (stated)", "“a world-scale refining and petrochemicals facility” and “among the world's youngest, most modern and energy-efficient refineries”", "/about-us/", { group: "global", claim: true }),
        fact("Markets served (stated)", "“Africa – Europe – Global”; products intended for “domestic and international markets”. No export volumes or destination breakdown is published", "/", { group: "global", claim: true }),
        fact("Export ambition (stated)", "An “export-driven refining hub for Africa” intended to “enable Nigeria's transition to a net exporter of refined petroleum products” and reduce import dependency", "/about-us/", { group: "global", claim: true }),
        fact("Employment (stated)", "“Tens of thousands of direct and indirect jobs created in Nigeria and beyond”; no figure published", "/", { group: "global", claim: true }),
        fact("Group footprint (stated, group level)", "“The Group currently has a presence in 17 African countries”. This describes Dangote Group, not the refinery", "/about-us/", { group: "global", claim: true }),
        fact("Chief Executive Officer / Managing Director (stated)", "David Bird", "/about-us/#governance", { group: "governance" }),
        fact("Chairman (stated)", "Aliko Dangote, GCON", "/about-us/#governance", { group: "governance" }),
        fact("Group relationship (stated)", "Presented as part of Dangote Group; the legal shareholding structure is not stated on the website", "/about-us/", { group: "governance" }),
      ],
      legalEntities: {
        create: [
          { name: "Dangote free-zone issuing entity (FZE)", scope: "REFINERY", notes: "The Lekki free-zone enterprise named as the issuer in the IPO extension notice dated 12 October 2026." },
          { name: "Dangote Group", scope: "GROUP", notes: "Parent group as described on the website. Group-level figures must not be combined with refinery-level figures." },
        ],
      },
    },
    include: { legalEntities: true },
  });
  const refinery = company.legalEntities.find((e) => e.scope === "REFINERY")!;

  const source = await db.source.create({
    data: {
      name: "Dangote company website",
      publisher: "Dangote (company website)",
      homepageUrl: SITE,
      provenance: "COMPANY_DISCLOSED",
      approved: false,
      licenseNotes:
        "Public web pages. As of 25 Oct 2026 the site's Terms of Service and Privacy Policy links are placeholders, so no reuse licence is stated. RefineryLens stores short excerpts and links only and does not republish full pages. Awaiting editor approval.",
    },
  });

  const page = (title: string, path: string, type: any, text: string, publishedAt: Date | null = null, topics: string[] = []) =>
    db.document.create({
      data: {
        companyId: company.id,
        sourceId: source.id,
        title,
        publisher: "Dangote (company website)",
        url: SITE + path,
        documentType: type,
        publishedAt,
        retrievedAt: RETRIEVED,
        provenance: "COMPANY_DISCLOSED",
        visibility: "PUBLIC",
        status: "EXTRACTED",
        pageCount: 1,
        topics,
        processingNote:
          "Web page capture: RefineryLens extraction notes with short quotations, not the full page text. No downloadable file; open the original URL. Awaiting editor approval.",
        pages: { create: [{ pageNumber: 1, text }] },
      },
    });

  const ipoDoc = await page(
    "Notice of Extension of the IPO Application Period",
    "/ipo-offer-extension/",
    "EXCHANGE_FILING",
    [
      "Extraction notes (RefineryLens) from the company's notice dated 12 October 2026.",
      "Issuer: the Dangote free-zone enterprise (FZE) named in the notice.",
      "Offer: initial public offering of 4,100,000,000 ordinary shares of US$0.000013 each at N525.00 per share.",
      "Offer opened Monday 14 September 2026. Original closing date Tuesday 13 October 2026. New closing date Tuesday 27 October 2026.",
      "The notice states that the Securities and Exchange Commission (SEC) approved the extension.",
      "Stated reasons: market-access initiatives across African jurisdictions, including wider distribution channels and depositary receipt programmes, and more time for account opening, identity verification and regulatory requirements.",
      "Indicative timetable in the notice: collation of returns 3 November 2026; allotment proposal to SEC 10 November 2026; SEC no-objection and allotment date 17 November 2026; listing and settlement allotment date plus 15 business days.",
      "The notice states these dates may change without notice at the discretion of the Issuing Houses in consultation with the Issuer.",
    ].join("\n"),
    new Date("2026-10-12T00:00:00Z"),
    ["capital-markets", "governance"],
  );

  const irDoc = await page(
    "Investor Relations page",
    "/investors-relations/",
    "OTHER",
    [
      "Extraction notes (RefineryLens) from the Investor Relations page.",
      "Financial disclosure: “Financial information will be made available to qualified institutional investors through our formal capital markets process.” No annual reports, financial statements or filings are linked on the page.",
      "The page links to the IPO offer extension notice and an IPO participation portal.",
      "The Investor Enquiries section states: “There are currently no active public offerings.”",
      "The page says further sections covering financial metrics, market share and pricing will be published later.",
      "Disclaimer on the page: for informational purposes only; not a prospectus or invitation to invest.",
    ].join("\n"),
    null,
    ["results", "capital-markets", "governance"],
  );

  const facilitiesDoc = await page(
    "Operations & Infrastructure page",
    "/facilities/",
    "OTHER",
    [
      "Extraction notes (RefineryLens) from the Operations & Infrastructure page.",
      "Refinery: described as Africa's largest single-train crude processing facility. CDU capacity 700,000 bpd. Stated expansion target 1.4M bpd. NCI 11.5. Fuel specification Euro V, ≤10 ppm sulphur, MMT-free.",
      "Petrochemical plant: INEOS-technology polypropylene units for homopolymers. Total capacity 830 KTPA: Train I 500 KTPA, Train II 330 KTPA. 12 homopolymer grades.",
      "Jetty: 3 km deepwater jetty with multi-berth operations, handling crude intake and exports of fuels and petrochemicals.",
      "Power: independent on-site generation dedicated to the complex. No capacity figure given.",
      "Not stated on the page: actual throughput, utilization, crude sources, product yields, storage totals, commissioning dates.",
    ].join("\n"),
    null,
    ["throughput", "expansion", "utilization"],
  );

  const homeDoc = await page(
    "Home page",
    "/",
    "OTHER",
    [
      "Extraction notes (RefineryLens) from the home page.",
      "Headline figures: “Refining Capacity 700,000 bpd”; text describing the refinery as “processing 700,000 barrels a day”; “Current CDU capacity 700,000 bpd”; “Expanding Capacity to 1.4M BPD”.",
      "Polypropylene: “12 premium grades today, scaling up to 155”; “Now producing Polypropylene for global markets”.",
      "Projects listed: Refinery, Polypropylene Plant, Urea & Fertiliser Plant, Jetty & Storage. No capacity or status is given for the urea and fertiliser plant.",
      "Banner: “EXTENDED NEW CLOSING DATE: 27 OCTOBER, 2026.”",
      "Employment claim: “Tens of thousands of direct and indirect jobs created in Nigeria and beyond.” No figure is given.",
    ].join("\n"),
    null,
    ["throughput", "expansion"],
  );

  await page(
    "Sustainability page",
    "/sustainability/",
    "OTHER",
    [
      "Extraction notes (RefineryLens) from the Sustainability page.",
      "Stated measures: sulphur recovery units, tail gas treatment, vapour recovery and continuous emissions monitoring; integrated wastewater and effluent treatment; automated shutdown systems, secondary containment and leak detection.",
      "No emissions volumes, water figures, incident data, employment numbers or third-party certifications are published on the page.",
    ].join("\n"),
    null,
    ["environment"],
  );

  const base = {
    companyId: company.id,
    legalEntityId: refinery.id,
    sourceId: source.id,
    publisher: "Dangote (company website)",
    provenance: "COMPANY_DISCLOSED" as const,
    retrievedAt: RETRIEVED,
    status: "IN_REVIEW" as const,
    aiGenerated: true,
    createdById: editorId,
  };

  await db.announcement.create({
    data: {
      ...base,
      headline: "IPO application period extended to 27 October 2026",
      originalTitle: "Notice of Extension of the IPO Application Period",
      sourceUrl: `${SITE}/ipo-offer-extension/`,
      documentType: "EXCHANGE_FILING",
      eventDate: new Date("2026-10-27T00:00:00Z"),
      sourcePublishedAt: new Date("2026-10-12T00:00:00Z"),
      summary:
        "The company says the application period for its initial public offering of 4.1 billion shares at N525.00 per share has been extended from 13 October to 27 October 2026, with SEC approval.",
      whatChanged: "The offer closing date moved two weeks later, and the allotment and listing timetable moved with it.",
      whyItMatters:
        "A listing would bring periodic public financial reporting, which is the main gap in current coverage. The stated reasons point to wider distribution, including depositary receipts across African markets.",
      uncertainties:
        "The timetable is indicative and may change without notice. The notice does not state the amount raised so far. The company's Investor Relations page also says there are currently no active public offerings, which contradicts the notice (see the open conflict).",
      analysis:
        "This is the company's own notice. RefineryLens has not verified the SEC approval with the regulator. This is not an invitation to invest and RefineryLens does not give investment advice.",
      alternativeExplanations: "An extension can reflect a wish to widen distribution, slower-than-expected subscriptions, or operational issues with account opening. The notice gives the first and last reasons.",
      openQuestions: "Will the SEC publish its own notice? What were subscription levels at the original closing date? When will audited financial statements be made public?",
      topics: ["capital-markets", "governance"],
      excerpts: { create: [{ documentId: ipoDoc.id, page: 1, quote: "Original closing date Tuesday 13 October 2026. New closing date Tuesday 27 October 2026." }] },
    },
  });

  await db.announcement.create({
    data: {
      ...base,
      headline: "Company states 700,000 bpd crude capacity and a 1.4 million bpd expansion pathway",
      originalTitle: "Operations & Infrastructure",
      sourceUrl: `${SITE}/facilities/`,
      documentType: "OTHER",
      sourcePublishedAt: RETRIEVED,
      summary: "The company's website gives current crude distillation capacity as 700,000 barrels per day and describes an expansion pathway to 1.4 million barrels per day.",
      whatChanged: "Stated capacity on the website is 700,000 bpd. No earlier figure is recorded in RefineryLens to compare with.",
      whyItMatters: "Capacity sets the ceiling on how much crude can be processed. It is not the same as throughput, so it does not on its own tell investors how much the plant actually runs.",
      uncertainties:
        "The website page has no publication date, so we use the retrieval date. The home page wording “processing 700,000 barrels a day” could be read as actual throughput, but the facilities page calls the figure capacity. No timeline or cost is given for the expansion.",
      alternativeExplanations: "The figure may reflect design capacity after debottlenecking rather than sustained operating rates.",
      openQuestions: "What is average actual throughput? When was 700,000 bpd first reached? What is the expansion timeline and funding plan?",
      topics: ["throughput", "utilization", "expansion"],
      excerpts: {
        create: [
          { documentId: facilitiesDoc.id, page: 1, quote: "CDU capacity 700,000 bpd. Stated expansion target 1.4M bpd." },
          { documentId: homeDoc.id, page: 1, quote: "“processing 700,000 barrels a day”; “Current CDU capacity 700,000 bpd”" },
        ],
      },
    },
  });

  await db.announcement.create({
    data: {
      ...base,
      headline: "Polypropylene plant: 830 KTPA stated capacity, 12 grades in production",
      originalTitle: "Operations & Infrastructure; Home page",
      sourceUrl: `${SITE}/facilities/`,
      documentType: "OTHER",
      sourcePublishedAt: RETRIEVED,
      summary: "The company states total polypropylene capacity of 830 thousand tonnes per year across two trains, and says it is producing 12 grades for global markets, with plans to scale to 155 grades.",
      whatChanged: "The website says polypropylene is now in production.",
      whyItMatters: "Petrochemicals can diversify revenue away from fuel margins, which are exposed to crude costs and fuel pricing policy.",
      uncertainties: "No production volumes, sales or margins are disclosed. Capacity is not output.",
      alternativeExplanations: "“Producing” may mean early or partial operation of one train.",
      openQuestions: "What share of the 830 KTPA is running? Which markets take the output?",
      topics: ["expansion"],
      excerpts: { create: [{ documentId: facilitiesDoc.id, page: 1, quote: "Total capacity 830 KTPA: Train I 500 KTPA, Train II 330 KTPA. 12 homopolymer grades." }] },
    },
  });

  const m = (data: any) =>
    db.metric.create({
      data: { companyId: company.id, legalEntityId: refinery.id, provenance: "COMPANY_DISCLOSED", status: "DRAFT", scope: "REFINERY", auditStatus: "NOT_APPLICABLE", ...data },
    });
  await m({ key: "nameplate_capacity", category: "OPERATIONAL", label: "Nameplate processing capacity (CDU)", value: 700000, unit: "barrels per day", scale: "units", periodLabel: "As stated, Oct 2026", periodType: "POINT", periodEnd: RETRIEVED, documentId: facilitiesDoc.id, page: 1, excerpt: "CDU capacity 700,000 bpd.", notes: "Website figure, no date on page. Capacity, not throughput." });
  await m({ key: "expansion", category: "OPERATIONAL", label: "Stated expansion target", value: 1400000, unit: "barrels per day", scale: "units", periodLabel: "Target, no date", periodType: "POINT", documentId: facilitiesDoc.id, page: 1, excerpt: "Stated expansion target 1.4M bpd.", notes: "A stated ambition, not achieved capacity. No timeline or cost published." });
  await m({ key: "polypropylene_capacity", category: "OPERATIONAL", label: "Polypropylene capacity", value: 830, unit: "thousand tonnes per year", scale: "units", periodLabel: "As stated, Oct 2026", periodType: "POINT", documentId: facilitiesDoc.id, page: 1, excerpt: "Total capacity 830 KTPA: Train I 500 KTPA, Train II 330 KTPA." });
  for (const [key, label] of [
    ["throughput", "Actual crude throughput"],
    ["utilization", "Capacity utilization"],
    ["exports", "Export volumes"],
    ["crude_mix", "Crude procurement mix"],
    ["refining_margin", "Refining margin"],
  ]) {
    await m({ key, category: "OPERATIONAL", label, value: null, unit: "", scale: "units", periodLabel: "Latest", periodType: "POINT", disclosureStatus: "NOT_DISCLOSED", documentId: facilitiesDoc.id, page: 1, excerpt: "Not stated on the page: actual throughput, utilization, crude sources, product yields, storage totals, commissioning dates.", notes: "Not found on the company website as of 25 Oct 2026." });
  }
  for (const [key, label] of [
    ["revenue", "Revenue"],
    ["net_profit", "Net profit"],
    ["operating_cash_flow", "Operating cash flow"],
    ["total_debt", "Total borrowings"],
  ]) {
    await m({ key, category: "FINANCIAL", label, value: null, unit: "", scale: "units", periodLabel: "Latest", periodType: "POINT", disclosureStatus: "NOT_DISCLOSED", documentId: irDoc.id, page: 1, excerpt: "“Financial information will be made available to qualified institutional investors through our formal capital markets process.”", notes: "Not publicly disclosed on the company website." });
  }

  await db.sourceConflict.create({
    data: {
      companyId: company.id,
      topic: "Whether a public offering is active",
      description: "Two statements on the same company website disagree. RefineryLens has not chosen between them.",
      status: "DRAFT",
      flaggedById: editorId,
      claims: {
        create: [
          { claim: "The IPO application period is open and closes on 27 October 2026.", sourceLabel: "IPO extension notice and home-page banner", sourceDate: new Date("2026-10-12T00:00:00Z"), provenance: "COMPANY_DISCLOSED" },
          { claim: "“There are currently no active public offerings.”", sourceLabel: "Investor Relations page, Investor Enquiries section (undated)", sourceDate: RETRIEVED, provenance: "COMPANY_DISCLOSED" },
        ],
      },
    },
  });
  await db.sourceConflict.create({
    data: {
      companyId: company.id,
      topic: "Capacity or throughput: “processing 700,000 barrels a day”",
      description: "The home page wording reads like actual processing, while the facilities page labels the same figure as CDU capacity. RefineryLens treats it as capacity until throughput is disclosed.",
      status: "DRAFT",
      flaggedById: editorId,
      claims: {
        create: [
          { claim: "The refinery is “processing 700,000 barrels a day”.", sourceLabel: "Home page (undated)", sourceDate: RETRIEVED, provenance: "COMPANY_DISCLOSED" },
          { claim: "“Current CDU capacity 700,000 bpd.”", sourceLabel: "Operations & Infrastructure page (undated)", sourceDate: RETRIEVED, provenance: "COMPANY_DISCLOSED" },
        ],
      },
    },
  });

  await db.sourceConflict.create({
    data: {
      companyId: company.id,
      topic: "How the refinery's size is described",
      description: "The home page attaches a size ranking to the 1.4 million bpd expansion figure, while the about page attaches a world ranking to a refinery with 700,000 bpd current CDU capacity. RefineryLens reports both as company claims and has not verified either ranking.",
      status: "DRAFT",
      flaggedById: editorId,
      claims: {
        create: [
          { claim: "“1.4 million barrels per day – Africa's largest single-train refinery.”", sourceLabel: "Home page (undated)", sourceDate: RETRIEVED, provenance: "COMPANY_DISCLOSED" },
          { claim: "“The largest single-train refinery in the world” with “a current CDU capacity of 700,000 barrels per day”.", sourceLabel: "About Us page (undated)", sourceDate: RETRIEVED, provenance: "COMPANY_DISCLOSED" },
        ],
      },
    },
  });

  await db.risk.create({
    data: {
      companyId: company.id,
      category: "GOVERNANCE",
      title: "Limited public financial disclosure",
      summary: "No financial statements are publicly available on the company website.",
      evidenceSummary: "The Investor Relations page says financial information will be made available to qualified institutional investors through the formal capital markets process.",
      impactPathway: "Without public accounts, investors cannot test profitability, cash generation or leverage, which raises the chance of being surprised by later disclosures.",
      horizon: "Near term (until listing documents or audited accounts are public)",
      severity: "HIGH",
      confidence: "HIGH",
      evidenceQuality: "Direct statement on the company's own website. High quality for the fact of non-disclosure.",
      uncertainty: "A prospectus may contain detailed financials that RefineryLens has not obtained. Access may be restricted.",
      clarifyingDisclosure: "Publication of audited financial statements, or a public prospectus.",
      status: "DRAFT",
    },
  });
  await db.risk.create({
    data: {
      companyId: company.id,
      category: "EXPANSION_EXECUTION",
      title: "Doubling capacity without a published plan",
      summary: "The company describes a pathway from 700,000 to 1.4 million barrels per day with no timeline, budget or funding plan.",
      evidenceSummary: "Stated expansion target on the facilities and about pages; no supporting detail.",
      impactPathway: "Large expansions can absorb cash and management attention, and delays or overruns can affect returns and debt capacity.",
      horizon: "Medium to long term",
      severity: "MODERATE",
      confidence: "LOW",
      evidenceQuality: "Company statement of ambition only.",
      uncertainty: "It is unclear whether the expansion has been approved, funded or started.",
      clarifyingDisclosure: "A project timeline, capital budget and funding sources.",
      status: "DRAFT",
    },
  });
  return company;
}
