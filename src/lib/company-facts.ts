/** A fact quoted from a company's own public pages, stored on Company.profileFacts. */
export type CompanyFact = {
  label: string;
  value: string;
  sourceUrl: string;
  retrievedAt: string;
  group?: "scale" | "facility" | "global" | "governance";
  /** Headline number and its unit, for "scale at a glance" tiles. */
  figure?: string;
  unit?: string;
  /** Rankings and promotional or comparative statements RefineryLens cannot verify. */
  claim?: boolean;
};

export function companyFacts(raw: unknown): CompanyFact[] {
  return Array.isArray(raw) ? (raw as CompanyFact[]).filter((f) => f && typeof f.label === "string" && typeof f.sourceUrl === "string") : [];
}

export function factsIn(facts: CompanyFact[], group: NonNullable<CompanyFact["group"]>) {
  return facts.filter((f) => (f.group ?? "facility") === group);
}
