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

export const SOURCES = {
  primeWaltersmith: {
    id: "primeWaltersmith",
    publisher: "Prime Business Africa",
    title: "Waltersmith doubles refinery capacity to 10,000 bpd, unveils new expansion plans",
    url: "https://www.primebusiness.africa/?p=249035",
    publishedAt: "2026-04-26",
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
