import type { Provenance, RiskCategory, DocumentType, PublicationStatus, Level, EntityScope } from "@prisma/client";

export const provenanceLabel: Record<Provenance, string> = {
  COMPANY_DISCLOSED: "Company-disclosed",
  REGULATOR_EXCHANGE: "Regulator or exchange-published",
  INDEPENDENT_REPORT: "Independently reported",
  ANALYST_ESTIMATE: "Analyst estimate",
  USER_ASSUMPTION: "User assumption",
  UNVERIFIED: "Unverified",
};

export const provenanceHelp: Record<Provenance, string> = {
  COMPANY_DISCLOSED: "Published by the company itself. Describes who said it, not whether it is accurate.",
  REGULATOR_EXCHANGE: "Published by a regulator, exchange or official body.",
  INDEPENDENT_REPORT: "Reported by a third party such as a news organisation. Not confirmed by the company.",
  ANALYST_ESTIMATE: "An estimate made by an analyst using a stated method. Not a disclosed figure.",
  USER_ASSUMPTION: "An assumption you recorded. Not evidence.",
  UNVERIFIED: "Not yet checked against a primary source.",
};

export const riskCategoryLabel: Record<RiskCategory, string> = {
  CRUDE_SUPPLY: "Crude supply",
  PRICES_AND_MARGINS: "Commodity prices and refining margins",
  FOREIGN_EXCHANGE: "Foreign exchange",
  DEBT_AND_LIQUIDITY: "Debt and liquidity",
  OPERATIONAL_RELIABILITY: "Operational reliability",
  REGULATION_AND_TAX: "Regulation and taxation",
  COMPETITION: "Competition",
  EXPANSION_EXECUTION: "Expansion execution",
  GOVERNANCE: "Governance",
  ENVIRONMENT_AND_COMMUNITY: "Environmental and community issues",
};

export const documentTypeLabel: Record<DocumentType, string> = {
  ANNUAL_REPORT: "Annual report",
  INTERIM_REPORT: "Interim report",
  PRESS_RELEASE: "Press release",
  EXCHANGE_FILING: "Exchange filing",
  REGULATORY_PUBLICATION: "Regulatory publication",
  NEWS_REPORT: "News report",
  ANALYST_NOTE: "Analyst note",
  PRESENTATION: "Presentation",
  OTHER: "Other",
};

export const statusLabel: Record<PublicationStatus, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  PUBLISHED: "Published",
  RETRACTED: "Retracted",
  SUPERSEDED: "Superseded",
};

export const levelLabel: Record<Level, string> = { LOW: "Low", MODERATE: "Moderate", HIGH: "High" };

export const scopeLabel: Record<EntityScope, string> = {
  GROUP: "Group level",
  REFINERY: "Refinery level",
  SUBSIDIARY: "Subsidiary",
  NATIONAL_SECTOR: "National sector total",
};

/** Shared topic vocabulary used to match announcements, risks, watchlists and thesis assumptions. */
export const TOPICS = [
  "utilization",
  "throughput",
  "crude-supply",
  "margins",
  "fx",
  "debt",
  "cash-flow",
  "maintenance",
  "regulation",
  "exports",
  "domestic-sales",
  "expansion",
  "governance",
  "environment",
  "competition",
  "results",
  "capital-markets",
] as const;

export const topicLabel: Record<string, string> = {
  utilization: "Capacity utilization",
  throughput: "Throughput",
  "crude-supply": "Crude supply",
  margins: "Refining margins",
  fx: "Foreign exchange",
  debt: "Debt and liquidity",
  "cash-flow": "Cash flow",
  maintenance: "Maintenance and outages",
  regulation: "Regulation and tax",
  exports: "Exports",
  "domestic-sales": "Domestic sales",
  expansion: "Expansion",
  governance: "Governance",
  environment: "Environment and community",
  competition: "Competition",
  results: "Financial results",
  "capital-markets": "Capital markets and listing",
};
