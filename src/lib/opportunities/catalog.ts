import type { CalculatorId } from "./calculators";
import type { SourceId } from "./sources";

/**
 * Business opportunities in Nigeria's fuel, gas and refining value chain, written by RefineryLens as analysis. None of
 * these is an offer, tender or partnership programme of any company. Each "context" note is what a dated source
 * reported. Opportunity sizes are never stated here: users size them with their own numbers in the tools.
 */

export const SCALES = [
  { id: "micro", label: "Micro", who: "Sole traders, LPG and kerosene retailers, artisans, single-truck owners" },
  { id: "small", label: "Small", who: "One or two filling stations, small fleets, small converters and service firms" },
  { id: "medium", label: "Medium", who: "Station networks, depot owners, regional transporters, plastics manufacturers" },
  { id: "large", label: "Large", who: "Major marketers, vessel operators, modular refiners, EPC and maintenance contractors" },
  { id: "enterprise", label: "Enterprise", who: "Crude suppliers, international traders, banks, infrastructure investors" },
] as const;
export type ScaleId = (typeof SCALES)[number]["id"];

export const SEGMENTS = [
  { id: "fuels", label: "Fuel distribution and retail" },
  { id: "gas", label: "LPG and CNG" },
  { id: "logistics", label: "Logistics and marine" },
  { id: "petrochemicals", label: "Polypropylene and petrochemicals" },
  { id: "feedstock", label: "Crude and feedstock" },
  { id: "refining", label: "Modular and regional refining" },
  { id: "services", label: "Plant services and supply chain" },
  { id: "trade", label: "Regional trade and export" },
] as const;
export type SegmentId = (typeof SEGMENTS)[number]["id"];

/** Stages on a user's private opportunity board, matching the OpportunityStage enum. */
export const STAGES = [
  ["EXPLORING", "Exploring"],
  ["VALIDATING", "Validating with quotes"],
  ["PURSUING", "Pursuing"],
  ["PARKED", "Parked"],
] as const;

export const ASSETS = [
  { id: "trucks", label: "Tanker trucks or a delivery fleet" },
  { id: "station", label: "An existing filling station" },
  { id: "site", label: "Land or a roadside site" },
  { id: "storage", label: "Tank storage, a depot or a warehouse" },
  { id: "factory", label: "A factory or workshop" },
  { id: "vessel", label: "Vessels or marine assets" },
  { id: "feedstock", label: "Access to crude, condensate or gas" },
  { id: "network", label: "Customers or a distribution network" },
  { id: "technical", label: "Engineering or technical staff" },
  { id: "finance", label: "Trade finance or bank credit lines" },
  { id: "licences", label: "Existing NMDPRA licences or permits" },
] as const;
export type AssetId = (typeof ASSETS)[number]["id"];

export type ContextNote = { text: string; source: SourceId; stance: "tailwind" | "headwind" | "neutral" };

export type Opportunity = {
  slug: string;
  title: string;
  segment: SegmentId;
  scales: ScaleId[];
  pitch: string;
  howItWorks: string;
  context: ContextNote[];
  validate: string[];
  risks: string[];
  permits: string[];
  calculator?: { id: CalculatorId; unit?: string };
  /** Open-data series worth watching for this opportunity (keys from the open-data adapters). */
  signals: string[];
  /** Things a business may already have that give it a head start here. Used by "Find my fit". */
  leverages: AssetId[];
};

const PERMIT_NOTE = "Confirm current licence names, fees and conditions with NMDPRA before committing money; categories change.";

export const OPPORTUNITIES: Opportunity[] = [
  {
    slug: "retail-station-supply",
    title: "Filling stations supplied by local refineries",
    segment: "fuels",
    scales: ["small", "medium"],
    pitch: "Retail petrol and diesel bought from refineries or distributors close to you, rather than through several layers of depots.",
    howItWorks: "A station owner buys gasoline (PMS) and diesel (AGO) on refinery or distributor terms and earns the difference between the pump price and the delivered cost. Volume and payment terms decide whether it works.",
    context: [],
    validate: [
      "Get a written supply quote, minimum order and payment terms for your location.",
      "Check how often deliveries arrive in practice and what happens when supply is short.",
      "Compare the delivered cost with your current depot supplier for a whole month, not one load.",
    ],
    risks: ["Pump prices can be cut faster than your stock turns over.", "A single supplier can change terms; keep a second source.", "Station licensing, safety and environmental compliance costs."],
    permits: ["Retail outlet approvals from NMDPRA", "State and local planning approvals", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "litre" },
    signals: ["eia.gulf_gasoline_spot", "eia.gulf_ulsd_spot", "fx.usd_ngn"],
    leverages: ["station", "site", "licences", "finance"],
  },
  {
    slug: "depot-bulk-marketing",
    title: "Depot storage and bulk resale",
    segment: "fuels",
    scales: ["medium", "large"],
    pitch: "Use tank farms in Lagos, Warri, Port Harcourt or Calabar to break bulk for stations and industrial buyers far from the refineries.",
    howItWorks: "A depot buys large parcels, stores them and resells by the truckload. Earnings come from the resale margin, storage fees for third parties, and the logistics edge of being closer to customers.",
    context: [],
    validate: ["Which refineries or importers will sell to you in bulk by vessel or pipeline, and at what discount to truck prices?", "Which customers are outside refiners' own delivery reach?", "Can you lease idle tankage instead of building?"],
    risks: ["Refiners delivering direct to customers can shrink the depot's role.", "Stock losses and price falls while product sits in tanks.", "Working capital tied up in inventory."],
    permits: ["Depot licence and operating permits from NMDPRA", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "litre" },
    signals: ["eia.gulf_gasoline_spot", "eia.gulf_ulsd_spot", "fx.usd_ngn"],
    leverages: ["storage", "network", "finance", "licences"],
  },
  {
    slug: "tanker-haulage",
    title: "Tanker haulage and last-mile delivery",
    segment: "logistics",
    scales: ["micro", "small", "medium"],
    pitch: "Move product from refinery loading points and depots to stations and industrial customers.",
    howItWorks: "Truck owners are paid per litre delivered or per trip. Profit depends on turnaround time at loading points, distance, fuel or gas cost, and keeping trucks busy.",
    context: [],
    validate: ["Who will contract you: refiners, marketers or industrial buyers?", "Measured queue time at the loading point today.", "Back-haul options so trucks do not return empty."],
    risks: ["Road conditions and security on long routes.", "Rates fall if refiners' own fleets cover your routes.", "Truck integrity and calibration requirements."],
    permits: ["Truck tanker integrity test and calibration (NMDPRA)", PERMIT_NOTE],
    calculator: { id: "haulage" },
    signals: ["fx.usd_ngn", "eia.gulf_ulsd_spot"],
    leverages: ["trucks", "network"],
  },
  {
    slug: "cng-refuelling",
    title: "CNG refuelling and truck conversion",
    segment: "gas",
    scales: ["small", "medium", "large"],
    pitch: "Serve the growing CNG truck fleet with refuelling, conversion kits and maintenance along fuel corridors.",
    howItWorks: "A CNG station buys pipeline gas, compresses it and sells it per standard cubic metre or kilogram. Workshops convert diesel trucks and maintain gas systems.",
    context: [{ text: "NMDPRA's gas permits portal lists CNG compression, CNG refuelling and auto gas permits.", source: "nmdpraPortal", stance: "neutral" }],
    validate: ["Access to a gas pipeline or virtual pipeline supply at your site.", "Which fleets will commit to refuelling with you.", "Kit, cylinder and technician availability."],
    risks: ["Gas supply interruptions.", "Safety standards for high-pressure cylinders.", "Competition from large operators' stations on the same routes."],
    permits: ["CNG compression and CNG refuelling permits (NMDPRA gas permits portal)", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "kg" },
    signals: ["fx.usd_ngn"],
    leverages: ["site", "technical", "feedstock", "station"],
  },
  {
    slug: "lpg-retail",
    title: "LPG cylinder refilling and retail",
    segment: "gas",
    scales: ["micro", "small", "medium"],
    pitch: "Bring cooking gas closer to households and small businesses with refill points and cylinder exchange.",
    howItWorks: "A refill plant or retailer buys LPG in bulk and sells by the kilogram. Small operators win on location and convenience; larger ones on bulk supply terms and cylinder logistics.",
    context: [{ text: "NMDPRA's gas permits portal lists LPG plant, LPG auto refilling and a category for LPG retailers.", source: "nmdpraPortal", stance: "neutral" }],
    validate: ["Can you buy bulk LPG from a refinery or terminal, or only through a distributor?", "Daily demand within walking or delivery distance.", "Cylinder testing and requalification costs."],
    risks: ["Fire and explosion safety; this is the main regulatory focus.", "Price swings with the exchange rate."],
    permits: ["LPG plant, auto refilling or retailer permits (NMDPRA gas permits portal)", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "kg" },
    signals: ["fx.usd_ngn"],
    leverages: ["site", "network", "licences"],
  },
  {
    slug: "diesel-industrial-telecoms",
    title: "Diesel supply to industry and telecom towers",
    segment: "fuels",
    scales: ["small", "medium"],
    pitch: "Contract diesel supply and fuel management for factories, estates, hospitals and tower sites.",
    howItWorks: "A supplier holds contracts to keep generators fuelled, earning a margin per litre plus service fees for monitoring and theft prevention.",
    context: [],
    validate: ["Which customers prefer a managed service to buying direct?", "Your payment terms versus your customers' payment terms.", "Fuel-theft controls you can offer."],
    risks: ["Customers switching to solar, gas or grid power.", "Late payment by large customers.", "Refiners delivering direct to large customers."],
    permits: ["NMDPRA approvals for storage and dispensing on customer sites", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "litre" },
    signals: ["eia.gulf_ulsd_spot", "fx.usd_ngn"],
    leverages: ["trucks", "network", "storage"],
  },
  {
    slug: "polypropylene-conversion",
    title: "Polypropylene conversion: sacks, packaging and moulding",
    segment: "petrochemicals",
    scales: ["small", "medium", "large"],
    pitch: "Turn locally made polypropylene into woven sacks, film, crates, household goods and automotive parts.",
    howItWorks: "A converter buys resin of a particular grade and melts it into products. Local resin can cut lead times and FX exposure compared with imported resin.",
    context: [],
    validate: ["Is the grade you need made locally? Ask producers for technical data sheets.", "Minimum order, packaging and delivery terms for resin.", "Your buyers: agriculture, cement, food, retail."],
    risks: ["Some grades may still need importing.", "Competition from imported finished goods."],
    permits: ["Standards Organisation of Nigeria (SON) product certification where applicable", "Environmental permits for plastics processing"],
    calculator: { id: "pp-converter" },
    signals: ["fx.usd_ngn"],
    leverages: ["factory", "technical", "network"],
  },
  {
    slug: "resin-distribution",
    title: "Resin distribution to small converters",
    segment: "petrochemicals",
    scales: ["medium"],
    pitch: "Break bulk polypropylene into smaller lots, with credit and technical support, for converters who cannot buy direct.",
    howItWorks: "A distributor buys by the truckload or container and resells by the bag or pallet, earning a margin for credit, storage and grade advice.",
    context: [],
    validate: ["Will the producer appoint distributors, and on what terms?", "Number of small converters in your region and the grades they use."],
    risks: ["Producer selling direct to your customers.", "Bad debts from small buyers."],
    permits: ["Standard business and warehouse registrations"],
    calculator: { id: "unit-margin", unit: "tonne" },
    signals: ["fx.usd_ngn"],
    leverages: ["storage", "network", "finance"],
  },
  {
    slug: "aviation-fuel",
    title: "Jet A-1 supply and into-plane services",
    segment: "fuels",
    scales: ["large"],
    pitch: "Supply airports and airlines with locally refined jet fuel, including storage, quality control and fuelling at the aircraft.",
    howItWorks: "Aviation fuel suppliers buy jet in bulk, hold it in certified storage and deliver into aircraft under strict quality standards. Margins are thin but contracts are long.",
    context: [],
    validate: ["Quality certification of local product for international airlines.", "Airport access and hydrant or bowser rights."],
    risks: ["Very high quality and safety standards.", "Airline credit risk and FX settlement."],
    permits: ["Aviation fuel handling approvals (NMDPRA, airport authority, aviation regulator)", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "litre" },
    signals: ["eia.gulf_jet_spot", "fx.usd_ngn"],
    leverages: ["storage", "licences", "technical", "finance"],
  },
  {
    slug: "regional-export-trading",
    title: "Regional export and product trading",
    segment: "trade",
    scales: ["large", "enterprise"],
    pitch: "Buy Nigerian-refined products for neighbouring West and Central African markets that import most of their fuel.",
    howItWorks: "A trader charters vessels or trucks, buys from Nigerian refineries and sells into markets where locally refined product competes with cargoes from Europe, Asia or the Gulf. The test is import parity in the destination market.",
    context: [],
    validate: ["Import parity in each target market (use the import parity tool).", "Destination country specifications and import licences.", "Trade finance and FX settlement."],
    risks: ["Price competition from imported cargoes.", "Border and customs rules that change quickly."],
    permits: ["Export permits and customs documentation", "Destination country import licences"],
    calculator: { id: "import-parity" },
    signals: ["eia.gulf_gasoline_spot", "eia.gulf_ulsd_spot", "calc.crack_321", "fx.usd_ngn"],
    leverages: ["finance", "network", "vessel"],
  },
  {
    slug: "crude-feedstock-supply",
    title: "Crude and condensate supply",
    segment: "feedstock",
    scales: ["enterprise"],
    pitch: "Sell domestic or imported crude and condensate to Nigeria's large and modular refineries.",
    howItWorks: "Producers, traders and shippers supply crude cargoes priced against international benchmarks. Domestic supply arrangements sit alongside imports.",
    context: [],
    validate: ["Crude grades each refinery can run and its tender process.", "Shipping, inspection and payment security."],
    risks: ["Concentration on a few buyers.", "Policy changes to domestic crude allocation."],
    permits: ["NUPRC and export or domestic crude supply obligations"],
    signals: ["eia.brent_spot", "eia.wti_spot", "eia.nigeria_crude_production"],
    leverages: ["feedstock", "vessel", "finance"],
  },
  {
    slug: "modular-refining",
    title: "Modular and condensate refineries",
    segment: "refining",
    scales: ["large", "enterprise"],
    pitch: "Small plants near oil fields serve regional diesel, kerosene and fuel-oil demand, and can feed naphtha or residue to bigger refineries.",
    howItWorks: "A modular refinery of a few thousand to tens of thousands of barrels a day distils local crude or condensate. Location near feedstock and customers matters more than scale.",
    context: [
      { text: "Prime Business Africa reported in April 2026 that Waltersmith doubled its Imo State modular refinery from 5,000 to 10,000 bpd, producing diesel, kerosene, fuel oil and naphtha, and plans a 30,000 bpd condensate refinery.", source: "primeWaltersmith", stance: "tailwind" },
    ],
    validate: ["Long-term feedstock agreement with nearby producers.", "Which products you can sell locally and which compete with large refineries' output.", "Licensor yields for your specific crude or condensate."],
    risks: ["Price competition from large refineries for the same customers.", "Feedstock security.", "Low complexity leaves a lot of low-value residue."],
    permits: ["Licence to establish, construct and operate a refinery (NMDPRA)", PERMIT_NOTE],
    calculator: { id: "modular-refinery" },
    signals: ["eia.brent_spot", "eia.gulf_ulsd_spot", "eia.gulf_jet_spot", "calc.crack_321"],
    leverages: ["feedstock", "site", "technical", "finance"],
  },
  {
    slug: "marine-logistics",
    title: "Marine logistics and coastal shipping",
    segment: "logistics",
    scales: ["large", "enterprise"],
    pitch: "Coastal tankers, tugs, mooring, inspection and bunkering services around refinery and terminal jetties.",
    howItWorks: "Vessel operators carry product along the coast to depots and neighbouring countries; service firms provide tugs, pilots, cargo inspection and crew services.",
    context: [],
    validate: ["Approved vessel requirements at each jetty.", "Coastal routes where sea freight beats road."],
    risks: ["Cabotage and vessel vetting rules.", "Security in the Gulf of Guinea."],
    permits: ["NIMASA vessel and cabotage registration", "Port and terminal approvals"],
    signals: ["eia.brent_spot"],
    leverages: ["vessel", "technical"],
  },
  {
    slug: "plant-services",
    title: "Plant services and local supply chain",
    segment: "services",
    scales: ["micro", "small", "medium", "large"],
    pitch: "Maintenance, inspection, environmental services, catering, transport and security for refineries and large industrial plants.",
    howItWorks: "Large plants buy many services from local firms, from catering and staff buses to specialised inspection, wastewater handling and turnaround labour. Vendor registration is the entry point.",
    context: [],
    validate: ["Each plant's vendor registration and pre-qualification process.", "Certifications buyers ask for (HSE, ISO, Nigerian content)."],
    risks: ["Long payment cycles.", "Strict safety performance requirements."],
    permits: ["Nigerian Content Development and Monitoring Board (NCDMB) registration where required", "Corporate Affairs Commission registration"],
    signals: [],
    leverages: ["technical", "trucks", "network"],
  },
];

export function opportunityBySlug(slug: string) {
  return OPPORTUNITIES.find((o) => o.slug === slug) ?? null;
}

export function filterOpportunities(opts: { scale?: string | null; segment?: string | null; q?: string | null }) {
  const q = opts.q?.trim().toLowerCase();
  return OPPORTUNITIES.filter(
    (o) =>
      (!opts.scale || o.scales.includes(opts.scale as ScaleId)) &&
      (!opts.segment || o.segment === opts.segment) &&
      (!q || [o.title, o.pitch, o.howItWorks].some((t) => t.toLowerCase().includes(q))),
  );
}

export const scaleLabel = (id: string) => SCALES.find((s) => s.id === id)?.label ?? id;
export const segmentLabel = (id: string) => SEGMENTS.find((s) => s.id === id)?.label ?? id;

export type FitProfile = { scale: string; segments: string[]; assets: string[] };
export type FitResult = { opportunity: Opportunity; score: number; reasons: string[] };

/**
 * Ranks opportunities for a business profile. Size must match; areas of interest and assets the business already has
 * raise the rank. The reasons are shown to the user, so the ranking is never a black box.
 */
export function rankForProfile(profile: FitProfile): FitResult[] {
  return OPPORTUNITIES.filter((o) => o.scales.includes(profile.scale as ScaleId))
    .map((o) => {
      const reasons = [`Suits ${scaleLabel(profile.scale).toLowerCase()} businesses`];
      let score = 1;
      if (profile.segments.includes(o.segment)) {
        score += 2;
        reasons.push(`In an area you chose: ${segmentLabel(o.segment).toLowerCase()}`);
      }
      const have = o.leverages.filter((a) => profile.assets.includes(a));
      score += have.length;
      if (have.length) reasons.push(`Uses what you have: ${have.map((a) => assetLabel(a).toLowerCase()).join(", ")}`);
      return { opportunity: o, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.opportunity.title.localeCompare(b.opportunity.title));
}

export const assetLabel = (id: string) => ASSETS.find((a) => a.id === id)?.label ?? id;
