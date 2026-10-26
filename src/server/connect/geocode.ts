import { db } from "@/lib/db";
import { callJson } from "./http";

/**
 * Approximate coordinates for gas sites from their town and state, through OpenStreetMap's Nominatim. The public
 * service allows about one request a second for a whole application and needs an identifying User-Agent, so lookups
 * run one at a time in the background worker and set NOMINATIM_EMAIL as the contact.
 * Policy: https://operations.osmfoundation.org/policies/nominatim/
 */

export function geocoderConfigured() {
  return (process.env.GEOCODER ?? "").toLowerCase() === "nominatim" && Boolean(process.env.NOMINATIM_EMAIL);
}

let lastCall = 0;

export async function geocodeSite(siteId: string) {
  if (!geocoderConfigured()) return null;
  const s = await db.gasSite.findUnique({ where: { id: siteId } });
  if (!s) return null;
  const wait = lastCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const base = (process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org").replace(/\/$/, "");
  const q = new URLSearchParams({ format: "jsonv2", countrycodes: "ng", limit: "1", q: [s.town, s.state.replace("FCT Abuja", "Abuja"), "Nigeria"].filter(Boolean).join(", ") });
  const res = await callJson<{ lat: string; lon: string }[]>("Nominatim", `${base}/search?${q}`, {
    headers: { "User-Agent": `RefineryLens/1.0 (${process.env.NOMINATIM_EMAIL})`, Accept: "application/json" },
  });
  const hit = res[0];
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  // Nigeria's bounding box, roughly; anything outside is a bad match.
  if (!(lat > 4 && lat < 14 && lon > 2.5 && lon < 15)) return null;
  await db.gasSite.update({ where: { id: siteId }, data: { lat, lon } });
  return { lat, lon };
}

export const osmLink = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=13/${lat.toFixed(5)}/${lon.toFixed(5)}`;
