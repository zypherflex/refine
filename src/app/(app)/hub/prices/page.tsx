import Link from "next/link";
import { requireUser } from "@/server/auth";
import { myBusiness } from "@/server/hub/business";
import { myPriceReports, priceBoard } from "@/server/hub/prices";
import { isState, PRICED_PRODUCTS, productById, productLabel, stateName } from "@/lib/hub/catalog";
import { MIN_SELLERS_FOR_MEDIAN, PRICE_BOARD_RULES, PRICE_WINDOW_DAYS } from "@/lib/hub/rules";
import { reportPriceAction } from "@/app/actions/hub";
import { Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { ProductSelect, StateSelect, day, isoDay, naira } from "@/components/hub/bits";

export const metadata = { title: "Price board" };

export default async function PricesPage({ searchParams }: { searchParams: Promise<{ product?: string; state?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const product = PRICED_PRODUCTS.some((p) => p.id === sp.product) ? sp.product! : "";
  const state = sp.state && isState(sp.state) ? sp.state : "";
  const [board, me, mine] = await Promise.all([priceBoard(), myBusiness(user), myPriceReports(user)]);
  const rows = board.filter((c) => (!product || c.product === product) && (!state || c.state === state));
  const canReport = !!me && me.verification !== "SUSPENDED" && (me.roles.includes("SELLER") || me.roles.includes("REFINERY"));
  const today = isoDay(new Date());

  return (
    <>
      <PageHeader eyebrow="Trade hub" title="Price board" subtitle={`What fuel and gas really cost, by state. Each figure is the median of prices sellers say they charged in the last ${PRICE_WINDOW_DAYS} days, shown only when at least ${MIN_SELLERS_FOR_MEDIAN} different sellers reported, with the dates it covers.`} />
      <div className="mb-6"><Notice title="How this board stays fair">{PRICE_BOARD_RULES} Prices are what sellers state; RefineryLens does not check each one. They are not quotes or offers.</Notice></div>

      <form method="get" role="search" aria-label="Filter prices" className="mb-5 grid gap-3 rounded-xl border border-ink-100 bg-ink-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <ProductSelect value={product} any="All products" only={PRICED_PRODUCTS.map((p) => p.id)} />
        <StateSelect value={state} any="All states" />
        <button className="btn-primary">Show</button>
      </form>

      <div className="table-wrap">
        <table className="tbl min-w-0">
          <caption className="sr-only">Median seller-stated prices by product and state</caption>
          <thead><tr><th scope="col">Product and state</th><th scope="col" className="text-right">Median</th><th scope="col" className="text-right">Sellers</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={`${c.product}-${c.state}`}>
                <td><span className="font-medium text-ink-950">{productLabel(c.product)}</span><span className="block text-xs text-ink-600">{stateName(c.state)}</span></td>
                <td className="text-right">
                  {c.median != null ? (
                    <>
                      <span className="num font-semibold text-ink-950">{naira(c.median)}</span><span className="text-xs text-ink-600"> /{productById(c.product)?.priceUnit}</span>
                      <span className="block text-xs text-ink-600">Charged {day(c.oldest!)} to {day(c.latest!)}</span>
                      {c.includesSample && <Pill className="mt-1 bg-ink-50 text-ink-700 ring-1 ring-dashed ring-ink-300">Includes sample data</Pill>}
                    </>
                  ) : <span className="text-xs text-ink-600">Not enough reports yet</span>}
                </td>
                <td className="text-right"><span className="num">{c.sellers}</span>{c.verifiedSellers > 0 && <span className="block text-[11px] text-brand-800">{c.verifiedSellers} verified</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-sm text-ink-600">No prices reported for this selection in the last {PRICE_WINDOW_DAYS} days.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-600">Each seller counts once, using their latest report. Reports older than {PRICE_WINDOW_DAYS} days drop off. No individual seller&apos;s price or price range is published. Have this board sent to you each morning: WhatsApp and SMS alerts are coming next.</p>

      <section className="mt-10" aria-labelledby="report-h">
        <SectionHeader id="report-h" title="Report a price you charged" />
        {canReport ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <HubForm action={reportPriceAction} submit="Record price" className="card space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <ProductSelect only={PRICED_PRODUCTS.map((p) => p.id)} value="LPG" />
                <StateSelect value={me!.state} />
                <div>
                  <label htmlFor="priceNgn" className="label">Price per unit (₦)</label>
                  <input id="priceNgn" name="priceNgn" type="number" inputMode="decimal" min="1" step="0.01" className="input num" required placeholder="e.g. 1350" />
                  <p className="hint">Per kg for LPG, per litre for liquids, per scm for CNG.</p>
                </div>
                <div>
                  <label htmlFor="chargedOn" className="label">Date you charged it</label>
                  <input id="chargedOn" name="chargedOn" type="date" className="input" max={today} defaultValue={today} required />
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmCharged" className="mt-1" required /> <span>This is a price I actually charged customers on this date. It is not a planned, future or suggested price.</span></label>
            </HubForm>
            <div>
              <p className="text-sm font-medium">Your recent reports (private to you)</p>
              {mine.length ? (
                <ul className="mt-2 divide-y divide-ink-100 rounded-xl border border-ink-100 text-sm">
                  {mine.map((r) => <li key={r.id} className="flex justify-between gap-2 px-3 py-2"><span>{productLabel(r.product)} · {stateName(r.state)} · {day(r.chargedOn)}</span><span className="num">{naira(r.priceNgn)}</span></li>)}
                </ul>
              ) : <p className="muted mt-1">None yet.</p>}
            </div>
          </div>
        ) : (
          <p className="muted">Sellers report prices from a business profile with the Seller role. <Link href="/hub/my">Set up your business</Link>.</p>
        )}
      </section>
    </>
  );
}
