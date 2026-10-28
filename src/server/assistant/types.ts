export type EvidenceKind = "FACT" | "CALCULATION" | "ESTIMATE" | "INTERPRETATION";

export type RetrievedItem = {
  ref: string;
  kind: "ANNOUNCEMENT" | "METRIC" | "DOCUMENT_PAGE" | "THESIS" | "CONFLICT";
  title: string;
  text: string;
  date: Date | null;
  provenance: string;
  link: string;
  score: number;
  isPrivate: boolean;
  isFictional: boolean;
  announcementId?: string;
  metricId?: string;
  documentId?: string;
  page?: number;
  quote: string;
  flaggedInstructions?: boolean;
};

export type Calculation = {
  ref: string;
  name: string;
  formula: string;
  inputs: { label: string; value: number; unit: string; ref?: string }[];
  result: number | null;
  unit: string;
  refused?: string;
};

export type StructuredAnswer = {
  question: string;
  scope: "COMPANY_SPECIFIC" | "GENERAL" | "MIXED";
  directAnswer: string;
  evidence: { claim: string; kind: EvidenceKind; refs: string[] }[];
  calculations: Calculation[];
  implications: string[];
  uncertainties: string[];
  generalExplanation?: string;
  missing: string[];
  insufficientEvidence: boolean;
  cutoff: string | null;
  mode: "evidence" | "llm";
  modeNote: string;
  flags: string[];
  sources: { ref: string; label: string; link: string; kind: string; provenance: string; date: string | null; quote: string; isPrivate: boolean; isFictional: boolean; documentId?: string; page?: number; announcementId?: string; metricId?: string }[];
};
