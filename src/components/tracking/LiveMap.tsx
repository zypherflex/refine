"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker, Polyline, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Phone } from "lucide-react";
import { fmtEta } from "@/lib/tracking";
import type { TripView } from "@/server/tracking";

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const POLL_MS = 10_000;

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

/** Live map of the driver for a gas order or delivery job, refreshed every 10 seconds while the trip is open. */
export function LiveMap({ kind, id, waitingText }: { kind: "gas-order" | "job"; id: string; waitingText: string }) {
  const [view, setView] = useState<TripView | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<{ m: LeafletMap; driver: CircleMarker | null; trail: Polyline; dest: LayerGroup; fitted: boolean } | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const res = await fetch(`/api/trips/${kind}/${id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok && !stop) setView(await res.json());
      if (!stop) timer = setTimeout(load, POLL_MS);
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [kind, id]);

  const hasMap = !!view && (!!view.last || !!view.dest);
  useEffect(() => {
    if (!hasMap || !box.current || !view) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current) return;
      if (!map.current) {
        const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([9.06, 7.49], 6);
        L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(m);
        map.current = { m, driver: null, trail: L.polyline([], { color: "#087c47", weight: 4, opacity: 0.7 }).addTo(m), dest: L.layerGroup().addTo(m), fitted: false };
      }
      const st = map.current;
      st.trail.setLatLngs(view.trail ?? []);
      st.dest.clearLayers();
      if (view.dest) L.circleMarker([view.dest.lat, view.dest.lon], { radius: 9, color: "#182a5a", fillColor: "#4766be", fillOpacity: 0.9, weight: 3 }).bindTooltip(`Drop-off: ${view.dest.label}`).addTo(st.dest);
      if (view.last) {
        const ll: [number, number] = [view.last.lat, view.last.lon];
        if (!st.driver) st.driver = L.circleMarker(ll, { radius: 10, color: "#ffffff", fillColor: view.live ? "#087c47" : "#8a94a6", fillOpacity: 1, weight: 3 }).bindTooltip(view.driverName ?? "Driver").addTo(st.m);
        else st.driver.setLatLng(ll).setStyle({ fillColor: view.live ? "#087c47" : "#8a94a6" });
        // Keep the driver in view as they move; the person can still pan and zoom freely in between.
        if (st.fitted && !st.m.getBounds().pad(-0.1).contains(ll)) st.m.panTo(ll);
      }
      if (!st.fitted) {
        const pts: [number, number][] = [...(view.last ? [[view.last.lat, view.last.lon] as [number, number]] : []), ...(view.dest ? [[view.dest.lat, view.dest.lon] as [number, number]] : [])];
        if (pts.length > 1) st.m.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
        else if (pts.length) st.m.setView(pts[0], 14);
        st.fitted = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasMap, view]);

  useEffect(() => () => {
    map.current?.m.remove();
    map.current = null;
  }, []);

  if (!view) return <div className="card text-sm text-ink-600">Loading the driver&apos;s location…</div>;
  if (view.status === "NONE") return <div className="card text-sm text-ink-600">{waitingText}</div>;

  const summary = view.status === "ENDED"
    ? "Sharing ended."
    : !view.last
      ? `${view.driverName} has the link but has not started sharing yet.`
      : view.live
        ? `${view.driverName} is on the way${view.distanceKm != null ? `, ${view.distanceKm} km away in a straight line` : ""}${view.etaMin != null ? `, arriving in ${fmtEta(view.etaMin)}` : ""}.`
        : `${view.driverName}'s last position was ${ago(view.last.at)}. Their phone may have lost signal or closed the page.`;

  return (
    <section aria-labelledby="track-h" className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="track-h" className="h-section flex items-center gap-2">
          {view.live && <span aria-hidden className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-600" /></span>}
          {view.live ? "Live tracking" : "Driver location"}
        </h2>
        {view.driverPhone && view.status !== "ENDED" && <a href={`tel:${view.driverPhone}`} className="btn-secondary btn-sm no-underline"><Phone size={14} aria-hidden /> Call {view.driverName}</a>}
      </div>
      <p className="text-sm text-ink-800" aria-live="polite">{summary}</p>
      {view.live && view.etaMin != null && (
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-600">Arrives in</dt><dd className="num text-xl font-semibold text-ink-950">{fmtEta(view.etaMin)}</dd></div>
          <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-600">Distance</dt><dd className="num text-xl font-semibold text-ink-950">{view.distanceKm} km</dd></div>
        </dl>
      )}
      {hasMap && <div ref={box} role="img" aria-label="Map showing the driver's position and route so far" className="relative isolate z-0 h-72 w-full overflow-hidden rounded-xl border border-ink-100 sm:h-96" />}
      <p className="text-xs text-ink-600">Updated every 10 seconds while the driver&apos;s page is open. Arrival time is a rough guide from distance and speed.{view.dest ? ` The drop-off pin is approximate (${view.dest.label}).` : ""}</p>
    </section>
  );
}
