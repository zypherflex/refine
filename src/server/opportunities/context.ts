import "server-only";
import type { Actor } from "@/lib/permissions";
import { SIGNAL_LABELS, type SignalPoint } from "@/lib/opportunities/signals";
import { getMarketSignals, listRefineryAssets, REGION_COUNTRIES } from "./open-data";

/** Approved open-data series as plain values the browser can use. Missing series are left out, never filled in. */
export async function signalPoints(keys: string[], actor: Actor | null): Promise<SignalPoint[]> {
  if (!keys.length) return [];
  const rows = await getMarketSignals(keys, actor);
  return rows
    .filter((r) => r.approved)
    .map((r) => ({ key: r.key, label: SIGNAL_LABELS[r.key] ?? r.label, value: r.value, unit: r.unit, period: r.period, sourceName: r.sourceName, sourceUrl: r.sourceUrl, attribution: r.attribution }));
}

export async function regionalRefineries() {
  const rows = await listRefineryAssets({ countries: REGION_COUNTRIES });
  return rows.sort((a, b) => (b.capacityBpd ?? -1) - (a.capacityBpd ?? -1));
}
