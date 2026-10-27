import Link from "next/link";
import { Logo } from "@/components/Logo";
import { checkCylinder, RETEST_YEARS } from "@/server/hub/cylinders";
import { day } from "@/components/hub/bits";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check a gas cylinder" };

/** Public safety check by serial number. No sign-in, and nothing beyond what a buyer needs to stay safe. */
export default async function CheckCylinderPage({ searchParams }: { searchParams: Promise<{ serial?: string }> }) {
  const serial = ((await searchParams).serial ?? "").slice(0, 40);
  const c = serial ? await checkCylinder(serial) : null;
  const unsafe = c && (c.status === "CONDEMNED" || c.overdue);
  return (
    <div className="min-h-screen bg-white">
      <div aria-hidden className="band-ng h-[3px]" />
      <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-5"><Link href="/" className="no-underline hover:no-underline"><Logo /></Link></header>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink-950">Check a gas cylinder</h1>
        <p className="mt-2 text-ink-700">Type the serial number stamped on the cylinder collar to see whether it is due for its safety test.</p>
        <form method="get" className="mt-5 flex flex-wrap items-end gap-2">
          <div className="flex-1"><label htmlFor="serial" className="label">Serial number</label><input id="serial" name="serial" className="input num uppercase" defaultValue={serial} placeholder="IKG-000001" required maxLength={40} /></div>
          <button className="btn-primary">Check</button>
        </form>

        {serial && !c && (
          <div className="mt-6 rounded-xl border border-ink-100 bg-ink-50 p-4" role="status">
            <p className="font-semibold">Not found</p>
            <p className="mt-1 text-sm text-ink-700">This serial is not registered on RefineryLens. That does not mean it is unsafe: many owners have not joined yet. Check the test date stamped on the collar and buy from a licensed refill plant.</p>
          </div>
        )}

        {c && (
          <section className={`mt-6 rounded-xl border p-4 ${unsafe ? "border-amber-300 bg-amber-50" : "border-brand-200 bg-brand-50"}`} aria-labelledby="result-h" role="status">
            <h2 id="result-h" className="text-lg font-semibold text-ink-950">
              {c.status === "CONDEMNED" ? "Do not use: this cylinder has been condemned" : c.overdue ? "Do not refill: the safety test is overdue" : "Registered and within its test date"}
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-ink-600">Serial</dt><dd className="num">{c.serial}</dd>
              <dt className="text-ink-600">Size</dt><dd className="num">{c.sizeKg} kg</dd>
              <dt className="text-ink-600">Owner</dt><dd>{c.owner.verification === "VERIFIED" ? c.owner.name : "Owner not verified"}{c.owner.isSample ? " (sample data)" : ""}</dd>
              <dt className="text-ink-600">Last tested</dt><dd className="num">{day(c.lastTestOn)}</dd>
              <dt className="text-ink-600">Next test due</dt><dd className="num">{day(c.nextTestDue)}</dd>
              <dt className="text-ink-600">Last filled</dt><dd className="num">{c.lastFilledAt ? day(c.lastFilledAt) : "Not recorded"}</dd>
            </dl>
            {unsafe && <p className="mt-3 text-sm text-ink-800">Return it to the owner or a licensed refill plant. Do not refill or use it until it passes a test.</p>}
          </section>
        )}
        <p className="muted mt-8 text-xs">Owners record tests and fills on RefineryLens; we show what they recorded and have not inspected the cylinder. Cylinders are retested every {RETEST_YEARS} years in this register. If you smell gas, close the valve, open windows and do not switch anything on.</p>
      </main>
    </div>
  );
}
