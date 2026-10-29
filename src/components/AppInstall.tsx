"use client";
import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { isNativeApp } from "./native/NativeBridge";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker once, in production builds only. */
export function ServiceWorker() {
  useEffect(() => {
    // The store apps have their own offline screen; the service worker is for the website and installed web app.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || isNativeApp()) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

/** Clears cached pages on sign-out, so the next person on a shared phone cannot read them offline. */
export function clearOfflinePages() {
  navigator.serviceWorker?.controller?.postMessage("clear-pages");
}

/**
 * "Install app": uses the browser's install prompt where there is one (Android, Chrome, Edge), and shows the
 * Share → Add to Home Screen steps on iPhone and iPad, which have no prompt. Hidden once installed.
 */
export function InstallApp({ compact = false }: { compact?: boolean }) {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    // Already an app: installed from the home screen, or the Google Play / App Store app.
    const standalone = isNativeApp() || window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!evt && !ios)) return null;
  return (
    <div className={compact ? "" : "rounded-xl border border-brand-600/20 bg-brand-50 p-3"}>
      <button
        type="button"
        className={compact ? "btn-secondary btn-sm" : "flex w-full items-center gap-2 text-left text-sm font-semibold text-brand-900"}
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            await evt.userChoice.catch(() => undefined);
            setEvt(null);
          } else setHelp((h) => !h);
        }}
      >
        <Download aria-hidden size={16} /> Install the RefineryLens app
      </button>
      {help && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-700" role="status">
          <Share aria-hidden size={14} className="mt-0.5 shrink-0" /> In Safari, tap Share, then “Add to Home Screen”.
        </p>
      )}
    </div>
  );
}
