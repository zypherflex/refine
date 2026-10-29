import { Logo } from "@/components/Logo";
import { NotFoundError } from "@/lib/errors";
import { naira } from "@/lib/hub/prices";
import { driverView } from "@/server/tracking";
import { DriverConsole } from "@/components/tracking/DriverConsole";

export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery", robots: { index: false, follow: false } };

/** The driver's page, opened from the private link the seller or carrier sent. No account needed. */
export default async function DrivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await driverView(token).catch((e) => {
    if (e instanceof NotFoundError) return null;
    throw e;
  });
  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-100 bg-white px-4 py-3"><div className="mx-auto max-w-md"><Logo size={24} /></div></header>
      <main className="mx-auto max-w-md space-y-5 px-4 py-6">
        {!data ? (
          <div className="card"><h1 className="h-section">This link does not work</h1><p className="mt-2 text-sm text-ink-700">It may have been replaced by a newer link. Ask the business that sent it for a new one.</p></div>
        ) : (
          <>
            <div>
              <p className="eyebrow">Delivery for {data.business?.name}</p>
              <h1 className="mt-1 font-serif text-2xl font-semibold text-ink-950">Hello {data.trip.driverName}</h1>
              <p className="mt-1 text-sm text-ink-700">While you share your location, the {data.order ? "customer" : "business receiving the load"} can follow you on a map. Sharing stops when you tap Stop, close this page, or the delivery is finished.</p>
            </div>
            <section className="card space-y-2 text-sm" aria-labelledby="drop-h">
              <h2 id="drop-h" className="h-section">Drop-off</h2>
              {data.order ? (
                <dl className="space-y-1.5">
                  <div><dt className="text-xs text-ink-600">Deliver</dt><dd className="font-medium">{data.order.cylinders} × {data.order.cylinderKg} kg LPG refill</dd></div>
                  <div><dt className="text-xs text-ink-600">Address</dt><dd className="font-medium">{data.order.address}, {data.order.area}, {data.order.state}</dd></div>
                  <div><dt className="text-xs text-ink-600">Customer phone</dt><dd><a href={`tel:${data.order.phone}`} className="font-medium">{data.order.phone}</a></dd></div>
                  {data.order.priceNaira && <div><dt className="text-xs text-ink-600">Collect on delivery</dt><dd className="num text-lg font-semibold">{naira(data.order.priceNaira)}</dd></div>}
                  {data.order.note && <div><dt className="text-xs text-ink-600">Customer&apos;s note</dt><dd>{data.order.note}</dd></div>}
                </dl>
              ) : (
                <dl className="space-y-1.5">
                  <div><dt className="text-xs text-ink-600">Load</dt><dd className="font-medium">{data.job!.title}</dd></div>
                  <div><dt className="text-xs text-ink-600">Route</dt><dd className="font-medium">{[data.job!.fromTown, data.job!.fromState].filter(Boolean).join(", ")} → {[data.job!.toTown, data.job!.toState].filter(Boolean).join(", ")}</dd></div>
                  <div><dt className="text-xs text-ink-600">For</dt><dd>{data.job!.poster.name}</dd></div>
                </dl>
              )}
            </section>
            <DriverConsole token={token} initiallyEnded={data.trip.status === "ENDED" || !data.active} canDeliver={!!data.order && data.active} />
            <p className="text-xs text-ink-600">RefineryLens keeps the positions you share for 7 days after the delivery, then deletes them. <a href="/privacy">Privacy policy</a></p>
          </>
        )}
      </main>
    </div>
  );
}
