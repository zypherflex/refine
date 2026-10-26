import "server-only";
import type { Actor } from "@/lib/permissions";

/**
 * Bridge to the open-data adapters (src/server/opendata, added in a separate change). The types mirror that module's
 * exports. Until it lands, these return nothing and every page shows an honest "not loaded" state instead of numbers.
 */
export type MarketSignal = {
  key: string;
  label: string;
  value: number;
  unit: string;
  asOf: Date;
  period: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: Date;
  attribution: string;
  licence: string;
  provenance: string;
  scope: "GLOBAL_MARKET" | "NIGERIA_MACRO";
  approved: boolean;
};

export type RefineryAsset = {
  id: string;
  externalId: string;
  name: string;
  countryCode: string;
  assetType: string;
  capacityBpd: number | null;
  owners: string[];
  lat: number;
  lon: number;
  emissionsTCo2e: number | null;
  emissionsYear: number | null;
  sourceUrl: string;
  retrievedAt: Date;
  attribution: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getMarketSignals(_keys: string[], _actor?: Actor | null): Promise<MarketSignal[]> {
  return [];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listRefineryAssets(_filter?: { countries?: string[]; minCapacityBpd?: number }): Promise<RefineryAsset[]> {
  return [];
}

/** West and Central African coastal markets most exposed to Nigerian refined product (ISO 3166-1 alpha-3). */
export const REGION_COUNTRIES = ["NGA", "BEN", "TGO", "GHA", "CIV", "LBR", "SLE", "GIN", "SEN", "CMR", "GAB", "GNQ", "COG", "AGO"];
