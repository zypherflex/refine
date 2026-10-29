"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp, useIsNativeApp } from "./NativeBridge";

/**
 * Push notifications in the store apps. Permission is asked only when someone taps "Turn on" in Account settings,
 * never at launch. Once granted, the app refreshes its token on each start and opens an alert's page when tapped.
 */

const KEY = "rl_push_token";
const remember = (t: string | null) => {
  try {
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
};
const recalled = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

async function plugin() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const { Capacitor } = await import("@capacitor/core");
  return { PushNotifications, platform: Capacitor.getPlatform() };
}

/** Registers with the push service and sends the token to RefineryLens. Resolves once the token is saved. */
async function register(): Promise<boolean> {
  const { PushNotifications, platform } = await plugin();
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean) => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    PushNotifications.addListener("registration", async ({ value }) => {
      const res = await fetch("/api/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value, platform }) }).catch(() => null);
      if (res?.ok) remember(value);
      done(!!res?.ok);
    });
    PushNotifications.addListener("registrationError", () => done(false));
    if (platform === "android") PushNotifications.createChannel({ id: "trade", name: "Trade alerts", description: "Messages, quotes and deliveries", importance: 4 }).catch(() => undefined);
    PushNotifications.register().catch(() => done(false));
    setTimeout(() => done(false), 20_000);
  });
}

/** Mounted in the signed-in app: silent token refresh and tap handling. */
export function PushBootstrap() {
  const router = useRouter();
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    (async () => {
      const { PushNotifications } = await plugin();
      const tapped = await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
        const link = (notification.data as { link?: string } | undefined)?.link;
        if (link?.startsWith("/")) router.push(link);
      });
      remove = () => tapped.remove();
      const { receive } = await PushNotifications.checkPermissions();
      if (receive === "granted") await register();
    })().catch(() => undefined);
    return () => remove?.();
  }, [router]);
  return null;
}

/** Removes this phone's token on sign-out so the next person on the phone does not get the previous user's alerts. */
export async function forgetDevice() {
  const token = recalled();
  if (!token) return;
  await fetch("/api/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => undefined);
  remember(null);
}

/** Account settings control, shown only in the store apps. */
export function PushSettings() {
  const native = useIsNativeApp();
  const [state, setState] = useState<"unknown" | "on" | "off" | "denied" | "busy" | "failed">("unknown");
  useEffect(() => {
    if (!native) return;
    plugin()
      .then(({ PushNotifications }) => PushNotifications.checkPermissions())
      .then(({ receive }) => setState(receive === "granted" && recalled() ? "on" : receive === "denied" ? "denied" : "off"))
      .catch(() => setState("off"));
  }, [native]);
  if (!native) return null;
  return (
    <section className="card space-y-2" aria-labelledby="push-h">
      <h2 id="push-h" className="h-section">Phone notifications</h2>
      <p className="text-sm text-ink-700">Get a notification on this phone for new messages, quotes, deliveries to confirm and verification results.</p>
      {state === "on" && <p className="text-sm font-medium text-brand-800" role="status">✓ On for this phone</p>}
      {state === "denied" && <p className="text-sm text-amber-800" role="status">Notifications are blocked for RefineryLens. Turn them on in your phone&apos;s Settings, then come back.</p>}
      {state === "failed" && <p className="text-sm text-risk-800" role="alert">This phone could not be registered. Check your connection and try again.</p>}
      {(state === "off" || state === "failed" || state === "busy") && (
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            const { PushNotifications } = await plugin();
            const { receive } = await PushNotifications.requestPermissions();
            if (receive !== "granted") return setState("denied");
            setState((await register()) ? "on" : "failed");
          }}
        >
          {state === "busy" ? "Turning on…" : "Turn on notifications"}
        </button>
      )}
    </section>
  );
}
