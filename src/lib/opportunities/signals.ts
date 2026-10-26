/** Labels for the open-data series the hub reads, so a missing series can still be named honestly. */
export const SIGNAL_LABELS: Record<string, string> = {
  "eia.brent_spot": "Brent crude spot",
  "eia.wti_spot": "WTI crude spot",
  "eia.gulf_gasoline_spot": "US Gulf Coast gasoline spot",
  "eia.gulf_ulsd_spot": "US Gulf Coast diesel (ULSD) spot",
  "eia.gulf_jet_spot": "US Gulf Coast jet fuel spot",
  "eia.us_refinery_utilization": "US refinery utilisation",
  "eia.nigeria_crude_production": "Nigeria crude oil production",
  "fx.usd_ngn": "US dollar to naira",
  "wb.ngn_official_fx": "Official naira exchange rate (annual)",
  "wb.ng_inflation": "Nigeria consumer price inflation",
  "calc.crack_321": "Indicative 3-2-1 crack spread",
};

export const HUB_SIGNALS = ["eia.brent_spot", "eia.gulf_gasoline_spot", "eia.gulf_ulsd_spot", "eia.gulf_jet_spot", "calc.crack_321", "fx.usd_ngn"];

/** What the browser needs to prefill a field and say where the number came from. */
export type SignalPoint = { key: string; label: string; value: number; unit: string; period: string; sourceName: string; sourceUrl: string; attribution: string };
