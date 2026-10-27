/**
 * Live driver tracking: distance and a rough arrival time from the driver's last position, and a thinned trail for
 * the map. Distances are straight-line ("as the crow flies") stretched by a road factor, so arrival times are guides.
 */

/** Positions this old or older are shown as "last seen", not live. */
export const LIVE_FOR_MS = 2 * 60_000;
/** The driver page sends at most one position this often. */
export const PING_EVERY_MS = 10_000;
/** Positions less accurate than this (metres) are not stored. */
export const MAX_ACCURACY_M = 1_500;
/** Positions are deleted this long after a trip ends. */
export const KEEP_PINGS_DAYS = 7;
/** Roads are longer than straight lines; this is a typical ratio for Nigerian cities and highways. */
export const ROAD_FACTOR = 1.3;

export type LatLon = { lat: number; lon: number };

export function distanceKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const isValidPosition = (p: LatLon) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;

/**
 * Rough minutes to arrival: road distance at the recent moving speed, or a typical speed when the driver is stopped
 * or the phone does not report speed (a motorbike or van in town, a truck on the highway).
 */
export function etaMinutes(km: number, recentSpeedsMs: (number | null)[], kind: "GAS_ORDER" | "DELIVERY_JOB"): number {
  const moving = recentSpeedsMs.filter((s): s is number => s !== null && s > 2);
  const typicalKmh = kind === "GAS_ORDER" ? 20 : 45;
  const kmh = moving.length >= 3 ? Math.min(90, Math.max(10, (moving.reduce((a, b) => a + b, 0) / moving.length) * 3.6)) : typicalKmh;
  return Math.max(1, Math.round(((km * ROAD_FACTOR) / kmh) * 60));
}

/** Keeps at most `max` points, evenly spaced, always including the first and last, so long trips draw quickly. */
export function thinTrail<T>(points: T[], max = 300): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => points[Math.round(i * step)]);
}

export function fmtEta(min: number): string {
  if (min < 60) return `about ${min} min`;
  const h = Math.floor(min / 60);
  const m = Math.round((min % 60) / 5) * 5;
  return `about ${h} h${m ? ` ${m} min` : ""}`;
}
