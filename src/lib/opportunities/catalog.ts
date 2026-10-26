import type { CalculatorId } from "./calculators";
import type { SourceId } from "./sources";

/**
 * Business opportunities around a large merchant refinery, written by RefineryLens as analysis. None of these is an
 * offer, tender or partnership programme of Dangote Petroleum Refinery & Petrochemicals, and RefineryLens is not
 * affiliated with the company. Each "anchor" is a company-stated fact; each "context" note is what a dated source
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

export type Anchor = { text: string; source: SourceId };
export type ContextNote = { text: string; source: SourceId; stance: "tailwind" | "headwind" | "neutral" };

export type Opportunity = {
  slug: string;
  title: string;
  segment: SegmentId;
  scales: ScaleId[];
  pitch: string;
  howItWorks: string;
  anchors: Anchor[];
  context: ContextNote[];
  validate: string[];
  risks: string[];
  permits: string[];
  calculator?: { id: CalculatorId; unit?: string };
  /** Open-data series worth watching for this opportunity (keys from the open-data adapters). */
  signals: string[];
};

const PERMIT_NOTE = "Confirm current licence names, fees and conditions with NMDPRA before committing money; categories change.";

export const OPPORTUNITIES: Opportunity[] = [
  {
    slug: "retail-station-supply",
    title: "Filling stations supplied direct from the refinery",
    segment: "fuels",
    scales: ["small", "medium"],
    pitch: "Retail Euro V petrol and diesel bought ex-refinery or delivered, rather than through several layers of depots.",
    howItWorks: "A station owner buys gasoline (PMS) and diesel (AGO) on refinery or distributor terms and earns the difference between the pump price and the delivered cost. Volume and payment terms decide whether it works.",
    anchors: [
      { text: "The company lists gasoline (PMS), diesel (AGO), Jet A-1 and LPG, and states transport fuels meet Euro V specifications.", source: "dprpProducts" },
    ],
    context: [
      { text: "Platts reported on 16 June 2025 that the refinery said it would distribute diesel and gasoline itself from 15 August 2025, with free delivery to marketers, retail stations, telecoms companies and aviation customers.", source: "plattsDistribution", stance: "tailwind" },
      { text: "The same report said credit facilities would be offered to bulk buyers taking more than 500,000 litres.", source: "plattsDistribution", stance: "neutral" },
      { text: "Marketers' association DAPPMAN said in September 2025 that access and price were the issue and asked for an open system rather than “a few selected partners”.", source: "channelsDappman", stance: "headwind" },
    ],
    validate: [
      "Get a written supply quote, minimum order and payment terms for your location.",
      "Check how often deliveries arrive in practice and what happens when supply is short.",
      "Compare the delivered cost with your current depot supplier for a whole month, not one load.",
    ],
    risks: ["Pump prices can be cut faster than your stock turns over.", "A single supplier can change terms; keep a second source.", "Station licensing, safety and environmental compliance costs."],
    permits: ["Retail outlet approvals from NMDPRA", "State and local planning approvals", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "litre" },
    signals: ["eia.gulf_gasoline_spot", "eia.gulf_ulsd_spot", "fx.usd_ngn"],
  },
  {
    slug: "depot-bulk-marketing",
    title: "Depot storage and bulk resale",
    segment: "fuels",
    scales: ["medium", "large"],
    pitch: "Use tank farms in Lagos, Warri, Port Harcourt or Calabar to break bulk for stations and industrial buyers far from the refinery.",
    howItWorks: "A depot buys large parcels, stores them and resells by the truckload. Earnings come from the resale margin, storage fees for third parties, and the logistics edge of being closer to customers.",
    anchors: [{ text: "The company describes a 3 km deepwater jetty with multi-berth operations that handles exports of fuels and petrochemicals.", source: "dprpFacilities" }],
    context: [
      { text: "DAPPMAN said in September 2025 that its members have depots in Calabar, Port Harcourt, Warri and Lagos, and that “bulk deliveries to depots are necessary” to serve the country.", source: "channelsDappman", stance: "neutral" },
      { text: "The refinery's own trucks and delivery programme, reported in June 2025, can bypass depots for customers it serves directly.", source: "plattsDistribution", stance: "headwind" },
    ],
    validate: ["Will the refinery sell to you in bulk by vessel or pipeline, and at what discount to truck prices?", "Which customers are outside the refinery's own delivery reach?", "Can you lease idle tankage instead of building?"],
    risks: ["Direct delivery by the refinery can shrink the depot's role.", "Stock losses and price falls while product sits in tanks.", "Working capital tied up in inventory."],
    permits: ["Depot licence and operating permits from NMDPRA", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "litre" },
    signals: ["eia.gulf_gasoline_spot", "eia.gulf_ulsd_spot", "fx.usd_ngn"],
  },
  {
    slug: "tanker-haulage",
    title: "Tanker haulage and last-mile delivery",
    segment: "logistics",
    scales: ["micro", "small", "medium"],
    pitch: "Move product from the Lekki loading point, or from depots, to stations and industrial customers.",
    howItWorks: "Truck owners are paid per litre delivered or per trip. Profit depends on turnaround time at loading points, distance, fuel or gas cost, and keeping trucks busy.",
    anchors: [{ text: "The refinery is in the Lekki Free Trade Zone, Ibeju Lekki, Lagos.", source: "dprpAbout" }],
    context: [
      { text: "Platts reported the refinery said it had invested in 4,000 new CNG-powered tankers, which competes with independent hauliers for its own volumes.", source: "plattsDistribution", stance: "headwind" },
      { text: "Channels TV reported in September 2025 that PETROAN's Billy Gilly-Harris said those trucks were not enough, which suggests room for third-party fleets.", source: "channelsDappman", stance: "tailwind" },
    ],
    validate: ["Who will contract you: the refinery, marketers or industrial buyers?", "Measured queue time at the loading point today.", "Back-haul options so trucks do not return empty."],
    risks: ["Road conditions and security on long routes.", "Rates fall if the refinery's own fleet covers your routes.", "Truck integrity and calibration requirements."],
    permits: ["Truck tanker integrity test and calibration (NMDPRA)", PERMIT_NOTE],
    calculator: { id: "haulage" },
    signals: ["fx.usd_ngn", "eia.gulf_ulsd_spot"],
  },
  {
    slug: "cng-refuelling",
    title: "CNG refuelling and truck conversion",
    segment: "gas",
    scales: ["small", "medium", "large"],
    pitch: "Serve the growing CNG truck fleet with refuelling, conversion kits and maintenance along fuel corridors.",
    howItWorks: "A CNG station buys pipeline gas, compresses it and sells it per standard cubic metre or kilogram. Workshops convert diesel trucks and maintain gas systems.",
    anchors: [{ text: "The company describes independent on-site power generation; no capacity is published.", source: "dprpFacilities" }],
    context: [
      { text: "Platts reported the refinery said it had invested in 100 CNG stations alongside its CNG tankers.", source: "plattsDistribution", stance: "neutral" },
      { text: "NMDPRA's gas permits portal lists CNG compression, CNG refuelling and auto gas permits.", source: "nmdpraPortal", stance: "neutral" },
    ],
    validate: ["Access to a gas pipeline or virtual pipeline supply at your site.", "Which fleets will commit to refuelling with you.", "Kit, cylinder and technician availability."],
    risks: ["Gas supply interruptions.", "Safety standards for high-pressure cylinders.", "Competition from the refinery's own stations on the same routes."],
    permits: ["CNG compression and CNG refuelling permits (NMDPRA gas permits portal)", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "kg" },
    signals: ["fx.usd_ngn"],
  },
  {
    slug: "lpg-retail",
    title: "LPG cylinder refilling and retail",
    segment: "gas",
    scales: ["micro", "small", "medium"],
    pitch: "Bring cooking gas closer to households and small businesses with refill points and cylinder exchange.",
    howItWorks: "A refill plant or retailer buys LPG in bulk and sells by the kilogram. Small operators win on location and convenience; larger ones on bulk supply terms and cylinder logistics.",
    anchors: [{ text: "The company lists LPG among its fuel products.", source: "dprpProducts" }],
    context: [{ text: "NMDPRA's gas permits portal lists LPG plant, LPG auto refilling and a category for LPG retailers.", source: "nmdpraPortal", stance: "neutral" }],
    validate: ["Can you buy bulk LPG ex-refinery or only through a distributor?", "Daily demand within walking or delivery distance.", "Cylinder testing and requalification costs."],
    risks: ["Fire and explosion safety; this is the main regulatory focus.", "Price swings with the exchange rate."],
    permits: ["LPG plant, auto refilling or retailer permits (NMDPRA gas permits portal)", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "kg" },
    signals: ["fx.usd_ngn"],
  },
  {
    slug: "diesel-industrial-telecoms",
    title: "Diesel supply to industry and telecom towers",
    segment: "fuels",
    scales: ["small", "medium"],
    pitch: "Contract diesel supply and fuel management for factories, estates, hospitals and tower sites.",
    howItWorks: "A supplier holds contracts to keep generators fuelled, earning a margin per litre plus service fees for monitoring and theft prevention.",
    anchors: [{ text: "The company states its diesel (AGO) meets Euro V with sulphur at or below 10 ppm where applicable.", source: "dprpProducts" }],
    context: [{ text: "Platts reported telecoms companies were among the customers named for the refinery's free delivery programme.", source: "plattsDistribution", stance: "headwind" }],
    validate: ["Which customers prefer a managed service to buying direct?", "Your payment terms versus your customers' payment terms.", "Fuel-theft controls you can offer."],
    risks: ["Customers switching to solar, gas or grid power.", "Late payment by large customers."],
    permits: ["NMDPRA approvals for storage and dispensing on customer sites", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "litre" },
    signals: ["eia.gulf_ulsd_spot", "fx.usd_ngn"],
  },
  {
    slug: "polypropylene-conversion",
    title: "Polypropylene conversion: sacks, packaging and moulding",
    segment: "petrochemicals",
    scales: ["small", "medium", "large"],
    pitch: "Turn locally made polypropylene into woven sacks, film, crates, household goods and automotive parts.",
    howItWorks: "A converter buys resin of a particular grade and melts it into products. Local resin can cut lead times and FX exposure compared with imported resin.",
    anchors: [
      { text: "The company states 830 KTPA of polypropylene capacity (Train I 500 KTPA, Train II 330 KTPA) using INEOS technology, with 12 homopolymer grades.", source: "dprpFacilities" },
      { text: "The home page says “12 premium grades today, scaling up to 155”.", source: "dprpHome" },
    ],
    context: [],
    validate: ["Is the grade you need among those currently made? Ask for technical data sheets.", "Minimum order, packaging and delivery terms for resin.", "Your buyers: agriculture, cement, food, retail."],
    risks: ["Homopolymer only today, per the company; copolymer grades may still need importing.", "Competition from imported finished goods."],
    permits: ["Standards Organisation of Nigeria (SON) product certification where applicable", "Environmental permits for plastics processing"],
    calculator: { id: "pp-converter" },
    signals: ["fx.usd_ngn"],
  },
  {
    slug: "resin-distribution",
    title: "Resin distribution to small converters",
    segment: "petrochemicals",
    scales: ["medium"],
    pitch: "Break bulk polypropylene into smaller lots, with credit and technical support, for converters who cannot buy direct.",
    howItWorks: "A distributor buys by the truckload or container and resells by the bag or pallet, earning a margin for credit, storage and grade advice.",
    anchors: [{ text: "The company states 830 KTPA of polypropylene capacity and 12 homopolymer grades.", source: "dprpFacilities" }],
    context: [],
    validate: ["Will the producer appoint distributors, and on what terms?", "Number of small converters in your region and the grades they use."],
    risks: ["Producer selling direct to your customers.", "Bad debts from small buyers."],
    permits: ["Standard business and warehouse registrations"],
    calculator: { id: "unit-margin", unit: "tonne" },
    signals: ["fx.usd_ngn"],
  },
  {
    slug: "aviation-fuel",
    title: "Jet A-1 supply and into-plane services",
    segment: "fuels",
    scales: ["large"],
    pitch: "Supply airports and airlines with locally refined jet fuel, including storage, quality control and fuelling at the aircraft.",
    howItWorks: "Aviation fuel suppliers buy jet in bulk, hold it in certified storage and deliver into aircraft under strict quality standards. Margins are thin but contracts are long.",
    anchors: [{ text: "The company lists Jet A-1 among its products.", source: "dprpProducts" }],
    context: [{ text: "Platts reported aviation customers were among those named for free delivery from the refinery.", source: "plattsDistribution", stance: "neutral" }],
    validate: ["Quality certification of local product for international airlines.", "Airport access and hydrant or bowser rights."],
    risks: ["Very high quality and safety standards.", "Airline credit risk and FX settlement."],
    permits: ["Aviation fuel handling approvals (NMDPRA, airport authority, aviation regulator)", PERMIT_NOTE],
    calculator: { id: "unit-margin", unit: "litre" },
    signals: ["eia.gulf_jet_spot", "fx.usd_ngn"],
  },
  {
    slug: "regional-export-trading",
    title: "Regional export and product trading",
    segment: "trade",
    scales: ["large", "enterprise"],
    pitch: "Buy refined products for neighbouring West and Central African markets that import most of their fuel.",
    howItWorks: "A trader charters vessels or trucks, buys from the refinery and sells into markets where locally refined product competes with cargoes from Europe, Asia or the Gulf. The test is import parity in the destination market.",
    anchors: [
      { text: "The company states its products are intended for “domestic and international markets” and presents itself as an “export-driven refining hub for Africa”. No export volumes are published.", source: "dprpAbout" },
      { text: "The company describes a 3 km deepwater jetty handling exports of fuels and petrochemicals.", source: "dprpFacilities" },
    ],
    context: [{ text: "The same Platts report quoted a trader on a $10–15/mt fall in offshore Lomé gasoline prices, a reminder that regional cargo prices move with supply from the refinery.", source: "plattsDistribution", stance: "neutral" }],
    validate: ["Import parity in each target market (use the import parity tool).", "Destination country specifications and import licences.", "Trade finance and FX settlement."],
    risks: ["Price competition from imported cargoes.", "Border and customs rules that change quickly."],
    permits: ["Export permits and customs documentation", "Destination country import licences"],
    calculator: { id: "import-parity" },
    signals: ["eia.gulf_gasoline_spot", "eia.gulf_ulsd_spot", "calc.crack_321", "fx.usd_ngn"],
  },
  {
    slug: "crude-feedstock-supply",
    title: "Crude and condensate supply",
    segment: "feedstock",
    scales: ["enterprise"],
    pitch: "Sell domestic or imported crude to a refinery that has said it is not receiving the domestic cargoes it needs.",
    howItWorks: "Producers, traders and shippers supply crude cargoes priced against international benchmarks. Domestic supply under the naira-for-crude programme sits alongside imports.",
    anchors: [{ text: "The company states a crude distillation capacity of 700,000 barrels per day.", source: "dprpFacilities" }],
    context: [
      { text: "Offshore Technology reported in March 2025 that the naira-for-crude arrangement began in October 2024, and that seven smaller refineries meant to take part had not benefited.", source: "offshoreNairaCrude", stance: "neutral" },
      { text: "The refinery's chief executive was reported on 25 March 2026 as saying it should receive 13 to 15 cargoes a month under naira-for-crude but was getting five.", source: "chronicleCargoes", stance: "tailwind" },
      { text: "He was also reported as saying the crude is priced at full international benchmark rates, not at a discount.", source: "chronicleCargoes", stance: "neutral" },
    ],
    validate: ["Crude grades the refinery can run and its tender process.", "Shipping, inspection and payment security."],
    risks: ["Concentration on a single buyer.", "Policy changes to domestic crude allocation."],
    permits: ["NUPRC and export or domestic crude supply obligations"],
    signals: ["eia.brent_spot", "eia.wti_spot", "eia.nigeria_crude_production"],
  },
  {
    slug: "modular-refining",
    title: "Modular and condensate refineries",
    segment: "refining",
    scales: ["large", "enterprise"],
    pitch: "Small plants near oil fields serve regional diesel, kerosene and fuel-oil demand, and can feed naphtha or residue to bigger refineries.",
    howItWorks: "A modular refinery of a few thousand to tens of thousands of barrels a day distils local crude or condensate. Location near feedstock and customers matters more than scale.",
    anchors: [{ text: "For scale: the company states a 700,000 bpd crude distillation capacity and a Nelson Complexity Index of 11.5.", source: "dprpFacilities" }],
    context: [
      { text: "Prime Business Africa reported in April 2026 that Waltersmith doubled its Imo State modular refinery from 5,000 to 10,000 bpd, producing diesel, kerosene, fuel oil and naphtha, and plans a 30,000 bpd condensate refinery.", source: "primeWaltersmith", stance: "tailwind" },
      { text: "Offshore Technology reported that smaller refineries had not received crude under the naira-for-crude programme.", source: "offshoreNairaCrude", stance: "headwind" },
    ],
    validate: ["Long-term feedstock agreement with nearby producers.", "Which products you can sell locally and which compete with the large refinery.", "Licensor yields for your specific crude or condensate."],
    risks: ["Price competition from a 700,000 bpd refinery for the same customers.", "Feedstock security.", "Low complexity leaves a lot of low-value residue."],
    permits: ["Licence to establish, construct and operate a refinery (NMDPRA)", PERMIT_NOTE],
    calculator: { id: "modular-refinery" },
    signals: ["eia.brent_spot", "eia.gulf_ulsd_spot", "eia.gulf_jet_spot", "calc.crack_321"],
  },
  {
    slug: "marine-logistics",
    title: "Marine logistics and coastal shipping",
    segment: "logistics",
    scales: ["large", "enterprise"],
    pitch: "Coastal tankers, tugs, mooring, inspection and bunkering services around a multi-berth jetty.",
    howItWorks: "Vessel operators carry product along the coast to depots and neighbouring countries; service firms provide tugs, pilots, cargo inspection and crew services.",
    anchors: [{ text: "The company describes a 3 km deepwater jetty with multi-berth operations handling crude intake and product exports.", source: "dprpFacilities" }],
    context: [],
    validate: ["Approved vessel requirements at the jetty.", "Coastal routes where sea freight beats road."],
    risks: ["Cabotage and vessel vetting rules.", "Security in the Gulf of Guinea."],
    permits: ["NIMASA vessel and cabotage registration", "Port and terminal approvals"],
    signals: ["eia.brent_spot"],
  },
  {
    slug: "plant-services",
    title: "Plant services and local supply chain",
    segment: "services",
    scales: ["micro", "small", "medium", "large"],
    pitch: "Maintenance, inspection, environmental services, catering, transport and security for a large industrial complex.",
    howItWorks: "Large plants buy many services from local firms, from catering and staff buses to specialised inspection, wastewater handling and turnaround labour. Vendor registration is the entry point.",
    anchors: [
      { text: "The company lists sulphur recovery units, tail gas treatment, vapour recovery, continuous emissions monitoring and integrated wastewater treatment.", source: "dprpSustainability" },
      { text: "The company says it has created “tens of thousands of direct and indirect jobs”; no figure is published.", source: "dprpHome" },
    ],
    context: [],
    validate: ["The company's vendor registration and pre-qualification process.", "Certifications buyers ask for (HSE, ISO, Nigerian content)."],
    risks: ["Long payment cycles.", "Strict safety performance requirements."],
    permits: ["Nigerian Content Development and Monitoring Board (NCDMB) registration where required", "Corporate Affairs Commission registration"],
    signals: [],
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
