import { Logo } from "@/components/Logo";

export const metadata = { title: "Offline" };
export const dynamic = "force-static";

/** Shown by the service worker when there is no connection and this page was never opened on this device. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink-50 px-4">
      <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lift ring-1 ring-ink-100">
        <Logo />
        <h1 className="mt-6 font-serif text-2xl font-semibold text-ink-950">You are offline</h1>
        <p className="mt-2 text-sm text-ink-700">RefineryLens needs a connection for live prices, messages and jobs. Pages you opened recently still work offline.</p>
        <a href="/hub" className="btn-primary mt-6">Try again</a>
      </div>
    </main>
  );
}
