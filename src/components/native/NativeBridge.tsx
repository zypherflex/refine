"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

/**
 * Glue for the Google Play and App Store apps (Capacitor shells that load this site). Does nothing in a normal browser.
 * - Android back button walks back through pages, and leaves the app from the first one.
 * - Links to other sites open in the phone's browser; RefineryLens links (deep links) open inside the app.
 * - Hides the native splash once the page has loaded, styles the status bar and shows an offline banner.
 */
export function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

export function useIsNativeApp() {
  const [native, setNative] = useState(false);
  useEffect(() => setNative(isNativeApp()), []);
  return native;
}

export function NativeBridge() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("native-app");
    const cleanups: (() => void)[] = [];
    let cancelled = false;

    (async () => {
      const [{ App }, { SplashScreen }, { StatusBar, Style }, { Network }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/splash-screen"),
        import("@capacitor/status-bar"),
        import("@capacitor/network"),
        import("@capacitor/browser"),
      ]);
      if (cancelled) return;
      await SplashScreen.hide().catch(() => undefined);
      await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);

      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && window.history.length > 1) window.history.back();
        else App.minimizeApp().catch(() => App.exitApp());
      });
      cleanups.push(() => back.remove());

      // Deep links: https://<site>/hub/... or ng.refinerylens.app://hub/... open the matching page.
      const opened = await App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          const path = u.protocol.startsWith("http") ? `${u.pathname}${u.search}` : `/${u.host}${u.pathname}${u.search}`;
          if (path.startsWith("/")) router.push(path);
        } catch {
          /* ignore malformed links */
        }
      });
      cleanups.push(() => opened.remove());

      const status = await Network.getStatus();
      setOffline(!status.connected);
      const net = await Network.addListener("networkStatusChange", (s) => setOffline(!s.connected));
      cleanups.push(() => net.remove());

      // Other sites (sources, Paystack receipts, OpenStreetMap) open in the in-app browser sheet, not this view.
      const onClick = (e: MouseEvent) => {
        const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!a || e.defaultPrevented) return;
        const url = new URL(a.href, window.location.href);
        if (url.origin === window.location.origin || !/^https?:$/.test(url.protocol)) return;
        e.preventDefault();
        Browser.open({ url: url.toString() }).catch(() => undefined);
      };
      document.addEventListener("click", onClick, true);
      cleanups.push(() => document.removeEventListener("click", onClick, true));
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [router]);

  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 bg-amber-100 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+8px)] text-center text-sm font-medium text-amber-900 shadow">
      You are offline. Prices, messages and jobs will update when you reconnect.
    </div>
  );
}

/** Shows its children on the website only. Inside the store apps, paid plans are managed on the website. */
export function WebOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return useIsNativeApp() ? <>{fallback}</> : <>{children}</>;
}
