/**
 * Opportunity sizing tools. Every input is the user's own assumption; every output carries its formula so the working
 * can be checked. The tools refuse to calculate rather than guess when inputs are missing or inconsistent.
 *
 * Shared by the browser (live results) and the server (saved scenarios), so nothing here may touch the database.
 */

export const LITRES_PER_US_GALLON = 3.785411784;
export const GALLONS_PER_BARREL = 42;

export type CalculatorId = "unit-margin" | "haulage" | "pp-converter" | "import-parity" | "modular-refinery";

export type Field = {
  key: string;
  label: string;
  unit: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Round placeholder used by "Fill with example numbers". Not market data and not an estimate. */
  example: number;
  optional?: boolean;
  /** Prefill from a cached open-data series, converted by `factor` (e.g. USD/gal × 42 = USD/bbl). */
  signal?: { key: string; factor?: number; note?: string };
};

export type OutputLine = { label: string; value: number; unit: string; formula: string };
export type CalcOutput =
  | { ok: true; headline: OutputLine; lines: OutputLine[]; notes: string[] }
  | { ok: false; reason: string };

export type Inputs = Record<string, number | null | undefined>;

export type CalculatorDef = {
  id: CalculatorId;
  name: string;
  summary: string;
  /** Unit words shown in the unit-margin tool, which works for litres, kilograms or tonnes. */
  fields: (opts?: { unit?: string }) => Field[];
  compute: (inputs: Inputs, opts?: { unit?: string }) => CalcOutput;
  /** Inputs that move the result most, flexed in the sensitivity table. */
  drivers: string[];
};

class Missing extends Error {}

function need(inputs: Inputs, fields: Field[]) {
  const out: Record<string, number> = {};
  const missing: string[] = [];
  for (const f of fields) {
    const v = inputs[f.key];
    if (v === null || v === undefined || Number.isNaN(v) || !Number.isFinite(v)) {
      if (f.optional) out[f.key] = 0;
      else missing.push(f.label);
      continue;
    }
    if (f.min !== undefined && v < f.min) throw new Missing(`${f.label} must be at least ${f.min}.`);
    if (f.max !== undefined && v > f.max) throw new Missing(`${f.label} must be at most ${f.max}.`);
    out[f.key] = v;
  }
  if (missing.length) throw new Missing(`Enter ${missing.length === 1 ? "a value for " + missing[0] : missing.length + " more values: " + missing.join(", ")}.`);
  return out;
}

function run(fields: Field[], inputs: Inputs, body: (v: Record<string, number>) => CalcOutput): CalcOutput {
  try {
    return body(need(inputs, fields));
  } catch (e) {
    if (e instanceof Missing) return { ok: false, reason: e.message };
    throw e;
  }
}

const line = (label: string, value: number, unit: string, formula: string): OutputLine => ({ label, value, unit, formula });

// ---------------------------------------------------------------------------------------------------------------------

const unitMarginFields = ({ unit = "litre" }: { unit?: string } = {}): Field[] => [
  { key: "volumePerDay", label: `Volume sold per day`, unit: `${unit}s/day`, min: 0, example: unit === "tonne" ? 20 : unit === "kg" ? 1000 : 10000 },
  { key: "daysPerMonth", label: "Trading days per month", unit: "days", min: 1, max: 31, example: 30 },
  { key: "buyPrice", label: `Supply price`, unit: `NGN/${unit}`, min: 0, help: "Your written quote from the refinery, a depot or a distributor.", example: unit === "tonne" ? 1_000_000 : unit === "kg" ? 1000 : 800 },
  { key: "deliveryCost", label: "Delivery to your site", unit: `NGN/${unit}`, min: 0, help: "Zero if delivery is included in the supply price.", example: unit === "tonne" ? 20_000 : unit === "kg" ? 20 : 10 },
  { key: "otherVariable", label: "Levies, losses and card fees", unit: `NGN/${unit}`, min: 0, optional: true, example: unit === "tonne" ? 10_000 : unit === "kg" ? 10 : 5 },
  { key: "sellPrice", label: "Your selling price", unit: `NGN/${unit}`, min: 0, example: unit === "tonne" ? 1_100_000 : unit === "kg" ? 1150 : 850 },
  { key: "fixedMonthly", label: "Fixed costs per month", unit: "NGN/month", min: 0, help: "Staff, rent, power, security, permits, insurance.", example: unit === "tonne" ? 3_000_000 : unit === "kg" ? 1_500_000 : 4_000_000 },
  { key: "upfront", label: "Upfront investment", unit: "NGN", min: 0, optional: true, help: "Equipment, tanks, site works, working capital.", example: unit === "tonne" ? 50_000_000 : unit === "kg" ? 15_000_000 : 60_000_000 },
];

function unitMargin(inputs: Inputs, { unit = "litre" }: { unit?: string } = {}): CalcOutput {
  return run(unitMarginFields({ unit }), inputs, (v) => {
    const margin = v.sellPrice - v.buyPrice - v.deliveryCost - v.otherVariable;
    const monthlyVolume = v.volumePerDay * v.daysPerMonth;
    const gross = margin * monthlyVolume;
    const net = gross - v.fixedMonthly;
    const lines = [
      line("Margin per unit", margin, `NGN/${unit}`, "selling price − supply price − delivery − levies and losses"),
      line("Volume per month", monthlyVolume, `${unit}s`, "volume per day × trading days"),
      line("Gross margin per month", gross, "NGN", "margin per unit × volume per month"),
      line("Operating profit per month", net, "NGN", "gross margin − fixed costs"),
    ];
    const notes: string[] = [];
    if (margin > 0) lines.push(line("Break-even volume", v.fixedMonthly / (margin * v.daysPerMonth), `${unit}s/day`, "fixed costs ÷ (margin per unit × trading days)"));
    else notes.push("The margin per unit is zero or negative, so no volume covers the fixed costs.");
    if (v.upfront > 0 && net > 0) lines.push(line("Simple payback", v.upfront / net, "months", "upfront investment ÷ operating profit per month"));
    else if (v.upfront > 0) notes.push("Payback is not calculated because operating profit is not positive.");
    notes.push("Before tax, financing costs and depreciation. Prices in Nigeria can change quickly, so test a lower selling price too.");
    return { ok: true, headline: lines[3], lines, notes };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

const haulageFields = (): Field[] => [
  { key: "trucks", label: "Trucks in the fleet", unit: "trucks", min: 1, step: 1, example: 3 },
  { key: "tankLitres", label: "Tank capacity", unit: "litres", min: 1, example: 33000 },
  { key: "roundTripKm", label: "Round-trip distance", unit: "km", min: 1, help: "Loading point to customer and back.", example: 400 },
  { key: "avgSpeedKmh", label: "Average speed including stops", unit: "km/h", min: 1, max: 120, example: 40 },
  { key: "loadUnloadHours", label: "Queueing, loading and discharge per trip", unit: "hours", min: 0, example: 10 },
  { key: "hoursPerDay", label: "Operating hours per day", unit: "hours", min: 1, max: 24, example: 12 },
  { key: "daysPerMonth", label: "Operating days per month", unit: "days", min: 1, max: 31, example: 26 },
  { key: "ratePerLitre", label: "Freight rate you are paid", unit: "NGN/litre", min: 0, example: 30 },
  { key: "fuelCostPerKm", label: "Fuel or gas cost per km", unit: "NGN/km", min: 0, help: "CNG trucks and diesel trucks differ a lot here.", example: 900 },
  { key: "otherCostPerKm", label: "Tyres, maintenance and tolls per km", unit: "NGN/km", min: 0, example: 300 },
  { key: "fixedMonthlyPerTruck", label: "Fixed costs per truck per month", unit: "NGN/month", min: 0, help: "Driver, insurance, tracking, permits and integrity tests.", example: 1_200_000 },
];

function haulage(inputs: Inputs): CalcOutput {
  return run(haulageFields(), inputs, (v) => {
    const tripHours = v.roundTripKm / v.avgSpeedKmh + v.loadUnloadHours;
    const trips = Math.floor((v.hoursPerDay * v.daysPerMonth) / tripHours);
    if (trips < 1) return { ok: false, reason: "With these hours a truck cannot finish one round trip in a month." };
    const revenueTrip = v.tankLitres * v.ratePerLitre;
    const costTrip = v.roundTripKm * (v.fuelCostPerKm + v.otherCostPerKm);
    const perTruck = trips * (revenueTrip - costTrip) - v.fixedMonthlyPerTruck;
    const fleet = perTruck * v.trucks;
    const lines = [
      line("Hours per round trip", tripHours, "hours", "round-trip km ÷ average speed + queueing, loading and discharge"),
      line("Round trips per truck per month", trips, "trips", "⌊operating hours per day × days ÷ hours per trip⌋"),
      line("Litres delivered by the fleet per month", trips * v.tankLitres * v.trucks, "litres", "trips × tank capacity × trucks"),
      line("Contribution per trip", revenueTrip - costTrip, "NGN", "tank capacity × freight rate − round-trip km × (fuel + other cost per km)"),
      line("Operating profit per truck per month", perTruck, "NGN", "trips × contribution per trip − fixed costs per truck"),
      line("Fleet operating profit per month", fleet, "NGN", "profit per truck × trucks"),
    ];
    return { ok: true, headline: lines[5], lines, notes: ["Assumes the truck is loaded every trip and returns empty. Before tax and financing."] };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

const ppFields = (): Field[] => [
  { key: "resinTonnes", label: "Polypropylene resin used per month", unit: "tonnes", min: 0, example: 50 },
  { key: "resinPrice", label: "Resin price delivered", unit: "NGN/tonne", min: 0, help: "Your quote for the grade you need.", example: 1_800_000 },
  { key: "yieldPct", label: "Saleable product per tonne of resin", unit: "%", min: 1, max: 100, help: "After scrap and rejects; additives and masterbatch add weight.", example: 95 },
  { key: "productPrice", label: "Selling price of finished product", unit: "NGN/tonne", min: 0, help: "Woven sacks, film, moulded parts and so on, per tonne.", example: 2_600_000 },
  { key: "conversionCost", label: "Conversion cost per tonne of resin", unit: "NGN/tonne", min: 0, help: "Power, labour, additives, packaging.", example: 400_000 },
  { key: "fixedMonthly", label: "Fixed costs per month", unit: "NGN/month", min: 0, example: 6_000_000 },
];

function ppConverter(inputs: Inputs): CalcOutput {
  return run(ppFields(), inputs, (v) => {
    const product = v.resinTonnes * (v.yieldPct / 100);
    const revenue = product * v.productPrice;
    const resinCost = v.resinTonnes * v.resinPrice;
    const conversion = v.resinTonnes * v.conversionCost;
    const net = revenue - resinCost - conversion - v.fixedMonthly;
    const lines = [
      line("Saleable product per month", product, "tonnes", "resin tonnes × saleable yield"),
      line("Revenue per month", revenue, "NGN", "saleable tonnes × selling price"),
      line("Resin and conversion costs per month", resinCost + conversion, "NGN", "resin tonnes × (resin price + conversion cost)"),
      line("Operating profit per month", net, "NGN", "revenue − resin and conversion costs − fixed costs"),
    ];
    return { ok: true, headline: lines[3], lines, notes: [] };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

const parityFields = (): Field[] => [
  { key: "intlPriceUsdGal", label: "International product price", unit: "USD/US gallon", min: 0, help: "A benchmark price, e.g. US Gulf Coast spot. West African cargo assessments are usually paid data.", example: 2.2, signal: { key: "eia.gulf_gasoline_spot", note: "US Gulf Coast conventional gasoline spot" } },
  { key: "litresPerTonne", label: "Litres per tonne of this product", unit: "litres/tonne", min: 1000, max: 2000, help: "Depends on density; gasoline is lighter than diesel. Use the figure on your cargo documents.", example: 1340 },
  { key: "freightUsdTonne", label: "Ocean freight to Lagos", unit: "USD/tonne", min: 0, example: 40 },
  { key: "insurancePct", label: "Insurance", unit: "% of cost and freight", min: 0, max: 10, example: 0.5 },
  { key: "portUsdTonne", label: "Port, jetty and inspection charges", unit: "USD/tonne", min: 0, example: 15 },
  { key: "fxNgnUsd", label: "Exchange rate", unit: "NGN per USD", min: 1, example: 1500, signal: { key: "fx.usd_ngn", note: "USD/NGN reference rate" } },
  { key: "otherNgnLitre", label: "Levies, storage, financing and margin", unit: "NGN/litre", min: 0, help: "Everything between the vessel and the depot gate.", example: 40 },
  { key: "localPriceNgnLitre", label: "Local price you were quoted", unit: "NGN/litre", min: 0, help: "Ex-refinery or ex-depot quote for the same product.", example: 900 },
];

function importParity(inputs: Inputs): CalcOutput {
  return run(parityFields(), inputs, (v) => {
    const productUsdL = v.intlPriceUsdGal / LITRES_PER_US_GALLON;
    const freightUsdL = v.freightUsdTonne / v.litresPerTonne;
    const insuranceUsdL = (productUsdL + freightUsdL) * (v.insurancePct / 100);
    const portUsdL = v.portUsdTonne / v.litresPerTonne;
    const landedUsdL = productUsdL + freightUsdL + insuranceUsdL + portUsdL;
    const landedNgnL = landedUsdL * v.fxNgnUsd + v.otherNgnLitre;
    const gap = v.localPriceNgnLitre - landedNgnL;
    const lines = [
      line("Product cost", productUsdL, "USD/litre", `price per gallon ÷ ${LITRES_PER_US_GALLON.toFixed(3)} litres`),
      line("Freight, insurance and port", freightUsdL + insuranceUsdL + portUsdL, "USD/litre", "(freight + port) ÷ litres per tonne + insurance % × (product + freight)"),
      line("Import parity at the depot gate", landedNgnL, "NGN/litre", "landed USD per litre × exchange rate + levies, storage, financing and margin"),
      line("Local quote minus import parity", gap, "NGN/litre", "local price − import parity"),
    ];
    const notes = [
      gap > 0
        ? "On these assumptions the local quote is above import parity, so importing would be cheaper. Check that you can obtain the import licence, FX and a vessel slot."
        : "On these assumptions the local quote is at or below import parity, so buying locally avoids FX, shipping and port risk.",
      "A benchmark price from another region ignores quality and location differentials.",
    ];
    return { ok: true, headline: lines[2], lines, notes };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

const YIELDS = [
  ["naphtha", "Naphtha", 25, null],
  ["jet", "Kerosene / jet", 15, "eia.gulf_jet_spot"],
  ["diesel", "Diesel (AGO)", 30, "eia.gulf_ulsd_spot"],
  ["fuelOil", "Fuel oil / residue", 27, null],
] as const;

const modularFields = (): Field[] => [
  { key: "capacityBpd", label: "Crude or condensate capacity", unit: "barrels/day", min: 100, max: 2_000_000, example: 10000 },
  { key: "utilisationPct", label: "Average utilisation", unit: "%", min: 1, max: 100, example: 80 },
  { key: "daysPerYear", label: "Operating days per year", unit: "days", min: 1, max: 366, example: 330 },
  { key: "crudeUsdBbl", label: "Crude benchmark price", unit: "USD/bbl", min: 0, example: 75, signal: { key: "eia.brent_spot", note: "Brent spot" } },
  { key: "crudeDiffUsdBbl", label: "Premium (+) or discount (−) to benchmark, delivered", unit: "USD/bbl", min: -50, max: 50, example: 2 },
  ...YIELDS.map(([k, label, ex]) => ({ key: `y_${k}`, label: `${label} yield`, unit: "% of crude", min: 0, max: 100, example: ex } as Field)),
  ...YIELDS.map(([k, label, , signal]) => ({
    key: `p_${k}`,
    label: `${label} price`,
    unit: "USD/bbl",
    min: 0,
    example: k === "naphtha" ? 70 : k === "fuelOil" ? 65 : 95,
    ...(signal ? { signal: { key: signal, factor: GALLONS_PER_BARREL, note: "US Gulf Coast spot × 42 gallons" } } : {}),
  } as Field)),
  { key: "opexUsdBbl", label: "Operating cost", unit: "USD/bbl", min: 0, help: "Power, catalysts, staff, maintenance.", example: 6 },
];

function modularRefinery(inputs: Inputs): CalcOutput {
  return run(modularFields(), inputs, (v) => {
    const yieldTotal = YIELDS.reduce((s, [k]) => s + v[`y_${k}`], 0);
    if (yieldTotal > 100) return { ok: false, reason: `The product yields add up to ${yieldTotal}%, which is more than the crude processed.` };
    const gpw = YIELDS.reduce((s, [k]) => s + (v[`y_${k}`] / 100) * v[`p_${k}`], 0);
    const crude = v.crudeUsdBbl + v.crudeDiffUsdBbl;
    const gross = gpw - crude;
    const net = gross - v.opexUsdBbl;
    const throughput = v.capacityBpd * (v.utilisationPct / 100);
    const lines = [
      line("Gross product worth", gpw, "USD/bbl", "Σ product yield × product price"),
      line("Gross refining margin", gross, "USD/bbl", "gross product worth − delivered crude cost"),
      line("Margin after operating cost", net, "USD/bbl", "gross refining margin − operating cost"),
      line("Average throughput", throughput, "barrels/day", "capacity × utilisation"),
      line("Margin after operating cost per year", (net * throughput * v.daysPerYear) / 1e6, "USD million", "margin per barrel × throughput × operating days ÷ 1,000,000"),
    ];
    const notes = [
      `Yields add up to ${yieldTotal}%; the remaining ${(100 - yieldTotal).toFixed(1)}% is treated as fuel and loss with no value.`,
      "A simple topping plant cannot convert residue into fuels, so its yields depend heavily on the crude or condensate assay. Use your licensor's yields.",
    ];
    return { ok: true, headline: lines[4], lines, notes };
  });
}

// ---------------------------------------------------------------------------------------------------------------------

export const CALCULATORS: Record<CalculatorId, CalculatorDef> = {
  "unit-margin": { id: "unit-margin", name: "Resale margin and payback", summary: "Margin, monthly profit, break-even volume and payback for reselling fuel, LPG, CNG or resin.", fields: unitMarginFields, compute: unitMargin, drivers: ["sellPrice", "buyPrice", "volumePerDay", "fixedMonthly"] },
  haulage: { id: "haulage", name: "Tanker haulage economics", summary: "Trips per month, litres delivered and profit for a truck fleet.", fields: haulageFields, compute: (i) => haulage(i), drivers: ["ratePerLitre", "fuelCostPerKm", "avgSpeedKmh", "loadUnloadHours"] },
  "pp-converter": { id: "pp-converter", name: "Polypropylene converter", summary: "Monthly profit for turning resin into sacks, film or moulded goods.", fields: ppFields, compute: (i) => ppConverter(i), drivers: ["productPrice", "resinPrice", "yieldPct", "conversionCost"] },
  "import-parity": { id: "import-parity", name: "Import parity check", summary: "Compares a local quote with the landed cost of an imported cargo.", fields: parityFields, compute: (i) => importParity(i), drivers: ["intlPriceUsdGal", "fxNgnUsd", "freightUsdTonne", "otherNgnLitre"] },
  "modular-refinery": { id: "modular-refinery", name: "Modular refinery margin", summary: "Margin per barrel and per year for a small crude or condensate plant.", fields: modularFields, compute: (i) => modularRefinery(i), drivers: ["crudeUsdBbl", "p_diesel", "utilisationPct", "opexUsdBbl"] },
};

export function isCalculatorId(id: string): id is CalculatorId {
  return Object.prototype.hasOwnProperty.call(CALCULATORS, id);
}

export function exampleInputs(id: CalculatorId, opts?: { unit?: string }): Record<string, number> {
  return Object.fromEntries(CALCULATORS[id].fields(opts).map((f) => [f.key, f.example]));
}

export type SensitivityRow = { key: string; label: string; low: number | null; high: number | null };

/**
 * Recalculates the headline with each driver moved down and up by `pct` percent, one at a time, all else unchanged.
 * A flexed value that breaks a limit (e.g. a yield above 100%) gives null rather than a clipped guess.
 */
export function sensitivity(id: CalculatorId, inputs: Inputs, opts?: { unit?: string }, pct = 10): { base: OutputLine; rows: SensitivityRow[] } | null {
  const calc = CALCULATORS[id];
  const base = calc.compute(inputs, opts);
  if (!base.ok) return null;
  const fields = calc.fields(opts);
  const rows = calc.drivers.flatMap((key) => {
    const f = fields.find((x) => x.key === key);
    const v = inputs[key];
    if (!f || v === null || v === undefined || v === 0) return [];
    const at = (factor: number) => {
      const r = calc.compute({ ...inputs, [key]: v * factor }, opts);
      return r.ok ? r.headline.value : null;
    };
    return [{ key, label: f.label, low: at(1 - pct / 100), high: at(1 + pct / 100) }];
  });
  return { base: base.headline, rows };
}
