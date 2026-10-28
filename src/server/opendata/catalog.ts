import type { ContextScope, Provenance } from "@prisma/client";

/**
 * The free, openly licensed data feeds RefineryLens ingests, and the series it takes from each.
 * Licence notes are written to the Source record so editors see them before approving the source.
 * Everything here is sector or country context. None of it is a company figure.
 */
export type ProviderId = "eia" | "worldbank" | "exchangerate-api" | "climate-trace";

export type ProviderDef = {
  id: ProviderId;
  name: string;
  publisher: string;
  homepageUrl: string;
  provenance: Provenance;
  licenseNotes: string;
  /** Shown next to every value from this provider. */
  attribution: string;
  attributionUrl: string;
  /** Environment variable holding a required API key, if any. */
  keyEnv?: string;
};

export const PROVIDERS: Record<ProviderId, ProviderDef> = {
  eia: {
    id: "eia",
    name: "EIA Open Data API",
    publisher: "U.S. Energy Information Administration",
    homepageUrl: "https://www.eia.gov/opendata/",
    provenance: "REGULATOR_EXCHANGE",
    licenseNotes: "U.S. government statistics, in the public domain. EIA asks to be cited as the source. Free API key (EIA_API_KEY) required.",
    attribution: "Source: U.S. Energy Information Administration (EIA)",
    attributionUrl: "https://www.eia.gov/opendata/",
    keyEnv: "EIA_API_KEY",
  },
  worldbank: {
    id: "worldbank",
    name: "World Bank Indicators API (World Development Indicators)",
    publisher: "The World Bank",
    homepageUrl: "https://data.worldbank.org/",
    provenance: "REGULATOR_EXCHANGE",
    licenseNotes: "CC BY 4.0 under the World Bank Terms of Use for Datasets. Attribute as \"The World Bank: World Development Indicators\". Do not imply World Bank endorsement. No key required.",
    attribution: "The World Bank: World Development Indicators (CC BY 4.0)",
    attributionUrl: "https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets",
  },
  "exchangerate-api": {
    id: "exchangerate-api",
    name: "ExchangeRate-API open access endpoint",
    publisher: "ExchangeRate-API",
    homepageUrl: "https://www.exchangerate-api.com/docs/free",
    provenance: "INDEPENDENT_REPORT",
    licenseNotes: "Free open-access endpoint, updated once a day. Attribution link required on pages that show the rates; caching allowed; the raw rates must not be redistributed, so they are shown in the app but never offered for export. A reference rate, not the CBN official rate.",
    attribution: "Rates by Exchange Rate API",
    attributionUrl: "https://www.exchangerate-api.com",
  },
  "climate-trace": {
    id: "climate-trace",
    name: "Climate TRACE asset inventory (oil and gas refining)",
    publisher: "Climate TRACE",
    homepageUrl: "https://climatetrace.org/",
    provenance: "INDEPENDENT_REPORT",
    licenseNotes: "CC BY 4.0, commercial use allowed with attribution to Climate TRACE and a note of any changes. Capacities and emissions are modelled estimates from satellite and public data, not company disclosures. No key required.",
    attribution: "Refinery inventory and emissions estimates: Climate TRACE (CC BY 4.0)",
    attributionUrl: "https://climatetrace.org/terms",
  },
};

export type SeriesDef = {
  key: string;
  provider: "eia" | "worldbank" | "exchangerate-api";
  externalId: string;
  label: string;
  description: string;
  unit: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "ANNUAL";
  contextScope: ContextScope;
  geography: string;
  sourcePageUrl: string;
  /** Provider-specific request parameters. */
  params: Record<string, string>;
};

const eiaSpot = (key: string, series: string, label: string, unit: string, geography: string, description: string): SeriesDef => ({
  key,
  provider: "eia",
  externalId: `petroleum/pri/spt:${series}`,
  label,
  description,
  unit,
  frequency: "DAILY",
  contextScope: "GLOBAL_MARKET",
  geography,
  sourcePageUrl: "https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm",
  params: { route: "petroleum/pri/spt", facet: "series", value: series },
});

const wb = (key: string, indicator: string, label: string, unit: string, description: string): SeriesDef => ({
  key,
  provider: "worldbank",
  externalId: `NGA:${indicator}`,
  label,
  description,
  unit,
  frequency: "ANNUAL",
  contextScope: "NIGERIA_MACRO",
  geography: "Nigeria",
  sourcePageUrl: `https://data.worldbank.org/indicator/${indicator}?locations=NG`,
  params: { country: "NGA", indicator },
});

export const SERIES: SeriesDef[] = [
  eiaSpot("eia.brent_spot", "RBRTE", "Brent crude spot price (FOB)", "USD/bbl", "Global benchmark", "The main Atlantic-basin crude benchmark. Nigerian crude grades are priced against it."),
  eiaSpot("eia.wti_spot", "RWTC", "WTI crude spot price (Cushing)", "USD/bbl", "United States", "The US crude benchmark, a reference for imported US crude cargoes."),
  eiaSpot("eia.gulf_gasoline_spot", "EER_EPMRU_PF4_RGC_DPG", "US Gulf Coast conventional gasoline spot price", "USD/gal", "United States Gulf Coast", "A product price benchmark for petrol in the Atlantic basin."),
  eiaSpot("eia.gulf_ulsd_spot", "EER_EPD2DXL0_PF4_RGC_DPG", "US Gulf Coast ultra-low-sulphur diesel spot price", "USD/gal", "United States Gulf Coast", "A product price benchmark for diesel (AGO) in the Atlantic basin."),
  eiaSpot("eia.gulf_jet_spot", "EER_EPJK_PF4_RGC_DPG", "US Gulf Coast kerosene-type jet fuel spot price", "USD/gal", "United States Gulf Coast", "A product price benchmark for jet fuel and kerosene."),
  {
    key: "eia.us_refinery_utilization",
    provider: "eia",
    externalId: "petroleum/pnp/wiup:WPULEUS3",
    label: "US refinery utilization, weekly",
    description: "Share of US operable distillation capacity in use. A benchmark for how hard the largest refining system runs; it moves product prices that also reach West Africa.",
    unit: "%",
    frequency: "WEEKLY",
    contextScope: "GLOBAL_MARKET",
    geography: "United States",
    sourcePageUrl: "https://www.eia.gov/dnav/pet/pet_pnp_wiup_dcu_nus_w.htm",
    params: { route: "petroleum/pnp/wiup", facet: "series", value: "WPULEUS3" },
  },
  {
    key: "eia.nigeria_crude_production",
    provider: "eia",
    externalId: "international:57/1/NGA/TBPD",
    label: "Nigeria crude oil production (incl. lease condensate)",
    description: "National crude output, the domestic feedstock pool that local refiners can buy from. A national total, not refinery intake.",
    unit: "thousand bbl/day",
    frequency: "MONTHLY",
    contextScope: "NIGERIA_MACRO",
    geography: "Nigeria",
    sourcePageUrl: "https://www.eia.gov/international/data/country/NGA",
    params: { route: "international", productId: "57", activityId: "1", countryRegionId: "NGA", unit: "TBPD" },
  },
  {
    key: "fx.usd_ngn",
    provider: "exchangerate-api",
    externalId: "latest/USD:NGN",
    label: "US dollar to naira reference rate",
    description: "A daily reference rate aggregated by ExchangeRate-API. Not the Central Bank of Nigeria official rate. Crude purchases and debt service are largely in dollars, while domestic product sales are in naira.",
    unit: "NGN per USD",
    frequency: "DAILY",
    contextScope: "NIGERIA_MACRO",
    geography: "Nigeria",
    sourcePageUrl: "https://www.exchangerate-api.com/docs/free",
    params: { base: "USD", quote: "NGN" },
  },
  wb("wb.ngn_official_fx", "PA.NUS.FCRF", "Official exchange rate, annual average", "NGN per USD", "The official naira rate averaged over each year, as reported to the World Bank."),
  wb("wb.ng_inflation", "FP.CPI.TOTL.ZG", "Consumer price inflation", "% a year", "Annual change in consumer prices in Nigeria."),
  wb("wb.ng_gdp", "NY.GDP.MKTP.CD", "Gross domestic product", "current USD", "Size of the Nigerian economy in current US dollars."),
  wb("wb.ng_fuel_imports_share", "TM.VAL.FUEL.ZS.UN", "Fuel imports, share of merchandise imports", "% of merchandise imports", "How much of Nigeria's import bill is fuel, the market a domestic refinery competes to replace."),
  wb("wb.ng_fuel_exports_share", "TX.VAL.FUEL.ZS.UN", "Fuel exports, share of merchandise exports", "% of merchandise exports", "How dependent Nigerian exports are on crude and fuel."),
];

/** Free sources that were checked and deliberately not ingested, with the reason. Shown in the README and admin. */
export const NOT_INGESTED: { name: string; reason: string }[] = [
  { name: "UN Comtrade (Nigeria refined-product imports)", reason: "Licence prohibits commercial use and redistribution without written UN permission." },
  { name: "FRED (St. Louis Fed)", reason: "Its oil series are EIA data, already ingested at source; FRED's terms restrict third-party series." },
  { name: "OPEC Reference Basket", reason: "No documented public API, and the website terms do not grant reuse." },
  { name: "Central Bank of Nigeria, NBS, NUPRC, NMDPRA", reason: "No documented machine-readable API. Their reports can be uploaded as documents and reviewed." },
  { name: "JODI Oil", reason: "Bulk file downloads rather than an API; a candidate for a later file importer." },
  { name: "Platts, Argus and other price-reporting agencies", reason: "Paid licences." },
  { name: "AIS ship tracking (e.g. aisstream.io)", reason: "Free tiers are live streams with no history; they need a stream consumer rather than a periodic feed." },
];
