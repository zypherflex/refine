import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { FREE_WEEKS, hasPriceData, METHODOLOGY, NATIONAL, priceHistory } from "@/server/hub/priceindex";
import { isState, PRICED_PRODUCTS, productById, productLabel, stateName, STATES_BY_NAME } from "@/lib/hub/catalog";
import { Notice, PageHeader, SectionHeader } from "@/components/ui";
import { IndexChart } from "@/components/hub/IndexChart";
import { naira } from "@/components/hub/bits";

export const metadata = { title: "Price history" };

export default async function PriceHistoryPage({ searchParams }: { searchParams: Promise<{ product?: string; state?: string; weeks?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const product = PRICED_PRODUCTS.some((p) => p.id === sp.product) ? sp.product! : "LPG";
  const state = sp.state && isState(sp.state) ? sp.state : NATIONAL;
  const subscribed = hasPriceData(await db.user.findUnique({ where: { id: user.id } }));
  const weeks = subscribed ? (sp.weeks === "104" ? 104 : sp.weeks === "26" ? 26 : 52) : FREE_WEEKS;
  const points = await priceHistory({ product, state, weeks });
  const unit = productById(product)?.priceUnit ?? "";
  const place = state === NATIONAL ? "All Nigeria" : stateName(state);
  const label = `${productLabel(product)}, ${place}`;

  return (
    <>
      <PageHeader eyebrow="Price index" title="Price history" subtitle="Weekly medians of past prices that sellers say they charged. A week shows a figure only when three or more sellers reported in it." actions={<Link href="/hub/prices" className="btn-secondary btn-sm no-underline">Today&apos;s board</Link>} />

      <form method="get" role="search" aria-label="Choose a price series" className="mb-5 grid gap-3 rounded-xl border border-ink-100 bg-ink-50 p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <div><label htmlFor="product" className="label">Product</label><select id="product" name="product" className="input" defaultValue={product}>{PRICED_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
        <div><label htmlFor="state" className="label">Where</label><select id="state" name="state" className="input" defaultValue={state}><option value={NATIONAL}>All Nigeria</option>{STATES_BY_NAME.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        {subscribed && <div><label htmlFor="weeks" className="label">Period</label><select id="weeks" name="weeks" className="input" defaultValue={String(weeks)}><option value="26">26 weeks</option><option value="52">52 weeks</option><option value="104">2 years</option></select></div>}
        <button className="btn-primary">Show</button>
      </form>

      <section className="card mb-6" aria-labelledby="chart-h">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="chart-h" className="h-section">{label}</h2>
          {subscribed && <a className="text-sm" href={`/api/hub/price-history?product=${product}&state=${state}`}>Download CSV (2 years)</a>}
        </div>
        <IndexChart points={points} unit={unit} label={label} />
      </section>

      {!subscribed && (
        <div className="mb-6">
          <Notice title={`You are seeing the last ${FREE_WEEKS} weeks`}>
            Up to two years of history, CSV exports and the price API come with <Link href="/hub/data">price data</Link>. It is set up by the RefineryLens team; online payment is not switched on yet.
          </Notice>
        </div>
      )}

      <section aria-labelledby="table-h">
        <SectionHeader id="table-h" title="Weekly figures" />
        <div className="table-wrap">
          <table className="tbl min-w-0">
            <thead><tr><th scope="col">Week ending</th><th scope="col" className="text-right">Median per {unit}</th><th scope="col" className="text-right">Sellers</th></tr></thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.weekEnding}><td className="num">{p.weekEnding}</td><td className="num text-right">{p.median != null ? naira(p.median) : <span className="muted">Not enough reports</span>}</td><td className="num text-right">{p.sellers}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted mt-3 text-xs">{METHODOLOGY}</p>
      </section>
    </>
  );
}
