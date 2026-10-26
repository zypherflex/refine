import type { Provenance } from "@prisma/client";

/**
 * Sources behind the opportunity context notes. Each note quotes or closely paraphrases what the source says, with its
 * date, so a reader can check it. News reports describe what was reported at the time, not the current position.
 */
export type ContextSource = {
  id: string;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string | null;
  retrievedAt: string;
  provenance: Provenance;
};

const RETRIEVED = "2026-10-26";
const SITE = "https://refinery.dangote.com";

export const SOURCES = {
  dprpFacilities: { id: "dprpFacilities", publisher: "Dangote Petroleum Refinery & Petrochemicals", title: "Operations & Infrastructure page", url: `${SITE}/facilities/`, publishedAt: null, retrievedAt: "2026-10-25", provenance: "COMPANY_DISCLOSED" },
  dprpProducts: { id: "dprpProducts", publisher: "Dangote Petroleum Refinery & Petrochemicals", title: "Products page", url: `${SITE}/products/`, publishedAt: null, retrievedAt: "2026-10-25", provenance: "COMPANY_DISCLOSED" },
  dprpHome: { id: "dprpHome", publisher: "Dangote Petroleum Refinery & Petrochemicals", title: "Home page", url: `${SITE}/`, publishedAt: null, retrievedAt: "2026-10-25", provenance: "COMPANY_DISCLOSED" },
  dprpAbout: { id: "dprpAbout", publisher: "Dangote Petroleum Refinery & Petrochemicals", title: "About page", url: `${SITE}/about-us/`, publishedAt: null, retrievedAt: "2026-10-25", provenance: "COMPANY_DISCLOSED" },
  dprpSustainability: { id: "dprpSustainability", publisher: "Dangote Petroleum Refinery & Petrochemicals", title: "Sustainability page", url: `${SITE}/sustainability/`, publishedAt: null, retrievedAt: "2026-10-25", provenance: "COMPANY_DISCLOSED" },
  plattsDistribution: {
    id: "plattsDistribution",
    publisher: "S&P Global Commodity Insights (Platts)",
    title: "Nigeria's Dangote oil refinery launches fuel distribution service to curb prices",
    url: "https://www.spglobal.com/commodity-insights/en/news-research/latest-news/refined-products/061625-nigerias-dangote-oil-refinery-launches-fuel-distribution-service-to-curb-prices",
    publishedAt: "2025-06-16",
    retrievedAt: RETRIEVED,
    provenance: "INDEPENDENT_REPORT",
  },
  channelsDappman: {
    id: "channelsDappman",
    publisher: "Channels Television",
    title: "All we ask for is partnership with Dangote – DAPPMAN",
    url: "https://www.channelstv.com/2025/09/24/all-we-ask-for-is-partnership-with-dangote-dappman/",
    publishedAt: "2025-09-24",
    retrievedAt: RETRIEVED,
    provenance: "INDEPENDENT_REPORT",
  },
  primeWaltersmith: {
    id: "primeWaltersmith",
    publisher: "Prime Business Africa",
    title: "Waltersmith doubles refinery capacity to 10,000 bpd, unveils new expansion plans",
    url: "https://www.primebusiness.africa/?p=249035",
    publishedAt: "2026-04-26",
    retrievedAt: RETRIEVED,
    provenance: "INDEPENDENT_REPORT",
  },
  chronicleCargoes: {
    id: "chronicleCargoes",
    publisher: "21st Century Chronicle",
    title: "Naira-for-crude deal: Dangote refinery says only 5 out of 15 cargoes received monthly",
    url: "https://21stcenturychronicle.com/naira-for-crude-deal-dangote-refinery-says-only-5-out-of-15-cargos-received-monthly/",
    publishedAt: "2026-03-25",
    retrievedAt: RETRIEVED,
    provenance: "INDEPENDENT_REPORT",
  },
  offshoreNairaCrude: {
    id: "offshoreNairaCrude",
    publisher: "Offshore Technology",
    title: "Dangote refinery crude supply (report on naira-for-crude extension talks)",
    url: "https://www.offshore-technology.com/news/dangote-refinery-crude-supply/",
    publishedAt: "2025-03-12",
    retrievedAt: RETRIEVED,
    provenance: "INDEPENDENT_REPORT",
  },
  nmdpraPortal: {
    id: "nmdpraPortal",
    publisher: "Nigerian Midstream and Downstream Petroleum Regulatory Authority (NMDPRA)",
    title: "Gas permits and approvals portal",
    url: "https://ags.nmdpra.gov.ng/",
    publishedAt: null,
    retrievedAt: RETRIEVED,
    provenance: "REGULATOR_EXCHANGE",
  },
} satisfies Record<string, ContextSource>;

export type SourceId = keyof typeof SOURCES;
