import { describe, expect, it } from "vitest";
import { CALCULATORS, exampleInputs, DANGOTE_STATED_CDU_BPD, type CalculatorId } from "@/lib/opportunities/calculators";
import { filterOpportunities, OPPORTUNITIES, SCALES } from "@/lib/opportunities/catalog";
import { SOURCES } from "@/lib/opportunities/sources";

describe("sizing tools", () => {
  it("every tool calculates from its example inputs and shows a formula for each line", () => {
    for (const id of Object.keys(CALCULATORS) as CalculatorId[]) {
      const r = CALCULATORS[id].compute(exampleInputs(id));
      expect(r.ok, id).toBe(true);
      if (r.ok) for (const l of r.lines) expect(l.formula.length, `${id}: ${l.label}`).toBeGreaterThan(5);
    }
  });

  it("refuses to calculate with missing inputs and names them", () => {
    const r = CALCULATORS["unit-margin"].compute({ volumePerDay: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Supply price/);
  });

  it("treats optional fields as zero but still validates ranges", () => {
    const base = { ...exampleInputs("unit-margin"), otherVariable: null, upfront: null };
    expect(CALCULATORS["unit-margin"].compute(base).ok).toBe(true);
    const r = CALCULATORS["unit-margin"].compute({ ...base, daysPerMonth: 40 });
    expect(r.ok).toBe(false);
  });

  it("resale margin: margin, profit, break-even and payback", () => {
    const r = CALCULATORS["unit-margin"].compute({ volumePerDay: 1000, daysPerMonth: 30, buyPrice: 800, deliveryCost: 10, otherVariable: 5, sellPrice: 850, fixedMonthly: 700_000, upfront: 3_500_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const get = (l: string) => r.lines.find((x) => x.label === l)!.value;
    expect(get("Margin per unit")).toBe(35);
    expect(get("Gross margin per month")).toBe(1_050_000);
    expect(r.headline.value).toBe(350_000);
    expect(get("Break-even volume")).toBeCloseTo(666.67, 1);
    expect(get("Simple payback")).toBe(10);
  });

  it("resale margin: a negative margin gives no break-even and says so", () => {
    const r = CALCULATORS["unit-margin"].compute({ volumePerDay: 1000, daysPerMonth: 30, buyPrice: 900, deliveryCost: 10, sellPrice: 850, fixedMonthly: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines.some((l) => l.label === "Break-even volume")).toBe(false);
      expect(r.notes.join(" ")).toMatch(/no volume covers/);
    }
  });

  it("haulage: trips are whole and impossible schedules are refused", () => {
    const ok = CALCULATORS.haulage.compute({ ...exampleInputs("haulage"), roundTripKm: 400, avgSpeedKmh: 40, loadUnloadHours: 10, hoursPerDay: 12, daysPerMonth: 26 });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.lines.find((l) => l.label.startsWith("Round trips"))!.value).toBe(15); // 312 h ÷ 20 h
    const bad = CALCULATORS.haulage.compute({ ...exampleInputs("haulage"), roundTripKm: 5000, avgSpeedKmh: 10, hoursPerDay: 1, daysPerMonth: 1 });
    expect(bad.ok).toBe(false);
  });

  it("modular refinery: refuses yields above 100% and benchmarks against the stated capacity", () => {
    const ex = exampleInputs("modular-refinery");
    expect(CALCULATORS["modular-refinery"].compute({ ...ex, y_diesel: 80 }).ok).toBe(false);
    const r = CALCULATORS["modular-refinery"].compute({ ...ex, capacityBpd: 7000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lines.find((l) => l.label.includes("Dangote"))!.value).toBeCloseTo((7000 / DANGOTE_STATED_CDU_BPD) * 100);
  });

  it("modular refinery: gross product worth is the yield-weighted price", () => {
    const r = CALCULATORS["modular-refinery"].compute({ capacityBpd: 1000, utilisationPct: 100, daysPerYear: 300, crudeUsdBbl: 70, crudeDiffUsdBbl: 0, y_naphtha: 50, y_jet: 0, y_diesel: 50, y_fuelOil: 0, p_naphtha: 60, p_jet: 0, p_diesel: 100, p_fuelOil: 0, opexUsdBbl: 5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lines[0].value).toBe(80);
      expect(r.lines[2].value).toBe(5);
      expect(r.headline.value).toBeCloseTo(1.5); // 5 USD × 1,000 bbl × 300 days = USD 1.5 m
    }
  });

  it("import parity converts gallons to litres and compares with the local quote", () => {
    const r = CALCULATORS["import-parity"].compute({ intlPriceUsdGal: 3.785411784, litresPerTonne: 1000, freightUsdTonne: 0, insurancePct: 0, portUsdTonne: 0, fxNgnUsd: 1000, otherNgnLitre: 0, localPriceNgnLitre: 1100 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.headline.value).toBeCloseTo(1000);
      expect(r.lines[3].value).toBeCloseTo(100);
      expect(r.notes[0]).toMatch(/above import parity/);
    }
  });
});

describe("opportunity catalogue", () => {
  it("covers every business size and cites a known source for every claim", () => {
    for (const s of SCALES) expect(OPPORTUNITIES.some((o) => o.scales.includes(s.id)), s.id).toBe(true);
    const slugs = new Set<string>();
    for (const o of OPPORTUNITIES) {
      expect(slugs.has(o.slug)).toBe(false);
      slugs.add(o.slug);
      expect(o.anchors.length, o.slug).toBeGreaterThan(0);
      for (const a of [...o.anchors, ...o.context]) expect(SOURCES[a.source], `${o.slug}: ${a.source}`).toBeDefined();
      for (const a of o.anchors) expect(SOURCES[a.source].provenance, `${o.slug} anchors must be company statements`).toBe("COMPANY_DISCLOSED");
      if (o.calculator) expect(CALCULATORS[o.calculator.id]).toBeDefined();
    }
  });

  it("never states an opportunity size in the catalogue text", () => {
    const text = JSON.stringify(OPPORTUNITIES.map((o) => [o.pitch, o.howItWorks, o.validate, o.risks]));
    expect(text).not.toMatch(/(NGN|₦|N)\s?\d|\$\s?\d+\s?(m|bn|million|billion)/i);
  });

  it("filters by size, area and text", () => {
    expect(filterOpportunities({ scale: "micro" }).every((o) => o.scales.includes("micro"))).toBe(true);
    expect(filterOpportunities({ segment: "gas" }).map((o) => o.slug)).toEqual(expect.arrayContaining(["lpg-retail", "cng-refuelling"]));
    expect(filterOpportunities({ q: "polypropylene" }).length).toBeGreaterThan(0);
    expect(filterOpportunities({ scale: "enterprise", segment: "petrochemicals" })).toEqual([]);
  });
});

describe("find my fit", () => {
  it("only recommends opportunities for the chosen size and explains the ranking", async () => {
    const { rankForProfile } = await import("@/lib/opportunities/catalog");
    const r = rankForProfile({ scale: "micro", segments: ["gas"], assets: ["trucks"] });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.opportunity.scales.includes("micro"))).toBe(true);
    expect(r[0].opportunity.segment === "gas" || r[0].opportunity.leverages.includes("trucks")).toBe(true);
    const haul = r.find((x) => x.opportunity.slug === "tanker-haulage")!;
    expect(haul.reasons.join(" ")).toMatch(/tanker trucks/i);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
  });
});

describe("sensitivity", () => {
  it("moves one driver at a time and reports n/a when a limit is broken", async () => {
    const { sensitivity } = await import("@/lib/opportunities/calculators");
    const s = sensitivity("unit-margin", { volumePerDay: 1000, daysPerMonth: 30, buyPrice: 800, deliveryCost: 10, otherVariable: 5, sellPrice: 850, fixedMonthly: 700_000 });
    expect(s).not.toBeNull();
    const sell = s!.rows.find((r) => r.key === "sellPrice")!;
    expect(sell.high! - s!.base.value).toBeCloseTo(85 * 30_000); // +85 NGN/litre on 30,000 litres
    const pp = sensitivity("pp-converter", { ...exampleInputs("pp-converter"), yieldPct: 95 })!;
    expect(pp.rows.find((r) => r.key === "yieldPct")!.high).toBeNull(); // 104.5% yield is impossible
    expect(sensitivity("unit-margin", {})).toBeNull();
  });
});
