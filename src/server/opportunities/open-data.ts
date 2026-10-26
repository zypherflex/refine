import "server-only";

/** The opportunities hub reads market benchmarks and the refinery inventory through the shared open-data adapters. */
export { getMarketSignals, listRefineryAssets, type MarketSignal, type RefineryAssetView as RefineryAsset } from "@/server/opendata";

/** West and Central African coastal markets most exposed to Nigerian refined product (ISO 3166-1 alpha-3). */
export const REGION_COUNTRIES = ["NGA", "BEN", "TGO", "GHA", "CIV", "LBR", "SLE", "GIN", "SEN", "CMR", "GAB", "GNQ", "COG", "AGO"];
