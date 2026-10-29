"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigation, Square } from "lucide-react";
import { PING_EVERY_MS } from "@/lib/tracking";

type Phase = "idle" | "asking" | "sharing" | "ended" | "denied" | "unsupported";

/**
 * Shares the phone's position while this page is open: asks for location permission, sends a position at most every
 * 10 seconds, keeps the screen awake where the browser allows it, and stops by itself when the delivery ends.
 */
export function DriverConsole({ token, initiallyEnded, canDeliver }: { token: string; initiallyEnded: boolean; canDeliver: boolean }) {
  const [phase, setPhase] = useState<Phase>(initiallyEnded ? "ended" : "idle");
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const watch = useRef<number | null>(null);
  const lastSent = useRef(0);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const post = useCallback((action: string, body?: unknown) => fetch(`/api/drive/${token}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }), [token]);

  const halt = useCallback(async () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    await wake.current?.release().catch(() => undefined);
    wake.current = null;
  }, []);

  useEffect(() => () => void halt(), [halt]);

  // Browsers release the wake lock when the page is hidden; take it again when the driver comes back.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState === "visible" && watch.current !== null && !wake.current) wake.current = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen").catch(() => null) ?? null;
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const start = async () => {
    if (!("geolocation" in navigator)) return setPhase("unsupported");
    setPhase("asking");
    setMessage(null);
    wake.current = await (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen").catch(() => null) ?? null;
    watch.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setPhase("sharing");
        const now = Date.now();
        if (now - lastSent.current < PING_EVERY_MS) return;
        lastSent.current = now;
        const { latitude: lat, longitude: lon, accuracy, speed, heading } = pos.coords;
        const res = await post("ping", { lat, lon, accuracy, speed: speed ?? null, heading: heading == null || Number.isNaN(heading) ? null : heading }).catch(() => null);
        if (!res) return setMessage("No internet connection. Your position will be sent when the signal returns.");
        if (res.status === 410) {
          await halt();
          setPhase("ended");
          return setMessage((await res.json().catch(() => ({}))).error ?? "This delivery has ended.");
        }
        if (res.ok) {
          setSentAt(new Date());
          setMessage(null);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          void halt();
          setPhase("denied");
        } else setMessage("Looking for GPS signal… Step outside or near a window if this takes long.");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
    );
  };

  const stopSharing = async () => {
    await halt();
    await post("stop").catch(() => undefined);
    setPhase("idle");
  };

  const delivered = async () => {
    if (!confirm("Mark this order as delivered? Do this once the customer has the gas and has paid.")) return;
    const res = await post("delivered").catch(() => null);
    if (res?.ok || res?.status === 410) {
      await halt();
      setPhase("ended");
      setMessage("Marked as delivered. Thank you!");
    } else setMessage("Could not mark as delivered. Check your connection and try again.");
  };

  if (phase === "ended") return <div className="rounded-2xl bg-ink-100 p-5 text-center"><p className="font-semibold text-ink-950">Sharing has ended</p><p className="mt-1 text-sm text-ink-700">{message ?? "This delivery is finished. You can close this page."}</p></div>;

  return (
    <div className="space-y-4">
      {phase === "sharing" ? (
        <div className="rounded-2xl bg-brand-600 p-5 text-white">
          <p className="flex items-center gap-2 text-lg font-semibold"><span aria-hidden className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-white" /></span>Sharing your location</p>
          <p className="mt-1 text-sm text-brand-50" aria-live="polite">{sentAt ? `Last sent ${sentAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Sending…"}. Keep this page open until you arrive.</p>
        </div>
      ) : (
        <button onClick={start} disabled={phase === "asking"} className="btn-primary w-full justify-center py-4 text-lg"><Navigation size={20} aria-hidden /> {phase === "asking" ? "Waiting for location permission…" : "Start sharing my location"}</button>
      )}
      {phase === "denied" && <p role="alert" className="rounded-xl bg-risk-50 p-3 text-sm text-risk-800">Location is blocked for this page. Open your browser&apos;s site settings, allow location for this site, then tap Start again.</p>}
      {phase === "unsupported" && <p role="alert" className="rounded-xl bg-risk-50 p-3 text-sm text-risk-800">This browser cannot share location. Open the link in Chrome or Safari.</p>}
      {message && <p className="text-sm text-ink-700" aria-live="polite">{message}</p>}
      {phase === "sharing" && <button onClick={stopSharing} className="btn-secondary w-full justify-center"><Square size={16} aria-hidden /> Stop sharing</button>}
      {canDeliver && <button onClick={delivered} className="btn-secondary w-full justify-center">Mark as delivered</button>}
    </div>
  );
}
