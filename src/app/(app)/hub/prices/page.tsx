import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getMyBusiness } from "@/server/hub/business";
import { myReports, priceBoard } from "@/server/hub/prices";
import { MIN_SELLERS, naira, PRICE_ITEMS, priceItem, WINDOW_DAYS } from "@/lib/hub/prices";
import { fmtDate } from "@/lib/format";
import { PriceReportForm } from "@/components/hub/opsForms";
import { EmptyState, Notice, PageHeader } from "@/components/ui";
import { ShareButton } from "@/components/native/ShareButton";

export const metadata = { title: "Price board" };

function Change({ now, prev }: { now: number | null; prev: number | null }) {
  if (now === null || prev === null || prev === 0) return <span className="text-ink-500">–</span>;
  const pct = ((now - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return <span className="text-ink-600">→ flat</span>;
  // Rising prices hurt buyers, so up reads as a warning; the arrow and sign carry the meaning without colour.
  return <span className={pct > 0 ? "text-risk-700" : "text-brand-800"}>{pct > 0 ? "▲ +" : "▼ "}{pct.toFixed(1)}%</span>;
}

export default async function PriceBoardPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const user = await requireUser();
  const { item: itemParam } = await searchParams;
  const item = priceItem(itemParam ?? "") ?? PRICE_ITEMS[1];
  const [{ cells, national, includesDemo }, mine] = await Promise.all([priceBoard(user, item.id), getMyBusiness(user)]);
  const canReport = !!mine && mine.roles.some((r) => r === "SELLER" || r === "REFINERY") && mine.verification !== "SUSPENDED";
  const mineReports = canReport ? await myReports(user) : [];
  const shown = cells.filter((c) => c.median !== null);
  const groups = [...new Set(PRICE_ITEMS.map((p) => p.group))];

  return (
    <>
      <PageHeader
        eyebrow="Trade hub"
        title="Price board"
        subtitle={`What sellers on RefineryLens charged in the last ${WINDOW_DAYS} days, by state. Each figure is the median across at least ${MIN_SELLERS} sellers, so no single seller's price is shown.`}
        actions={<><ShareButton title={`${item.label} prices by state`} text={`${item.label} prices by state on RefineryLens`} path={`/hub/prices?item=${item.id}`} />{canReport ? <a href="#report" className="btn-primary btn-sm no-underline">Report my prices</a> : <Link href="/hub/me" className="btn-secondary btn-sm no-underline">Sellers: set up your business to report</Link>}</>}
      />

      {includesDemo && <div className="mb-4"><Notice tone="warn" title="Includes demo sellers">Some figures come from fictional demo businesses seeded for this installation. They are sample data, not market prices.</Notice></div>}
      <nav aria-label="Product" className="mb-5 space-y-2">
        {groups.map((g) => (
          <div key={g} className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-eyebrow text-ink-500">{g}</span>
            {PRICE_ITEMS.filter((p) => p.group === g).map((p) => (
              <Link key={p.id} href={`/hub/prices?item=${p.id}`} aria-current={p.id === item.id ? "page" : undefined} className={`rounded-full px-3 py-1 text-sm no-underline hover:no-underline ${p.id === item.id ? "bg-ink-950 font-medium text-white" : "bg-white text-ink-800 ring-1 ring-inset ring-ink-100 hover:bg-ink-50"}`}>{p.label}</Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="card"><p className="text-xs text-ink-600">National median · {item.label}, {item.unit}</p><p className="num mt-1 text-3xl font-semibold text-ink-950">{national.median === null ? "–" : naira(national.median)}</p><p className="mt-1 text-xs text-ink-600">{national.sellers} seller{national.sellers === 1 ? "" : "s"} reporting{national.median === null ? `; needs ${MIN_SELLERS}` : ""}</p></div>
        <div className="card"><p className="text-xs text-ink-600">States with a median</p><p className="num mt-1 text-3xl font-semibold text-ink-950">{shown.length}</p><p className="mt-1 text-xs text-ink-600">of 37; others have too few reports</p></div>
        <div className="card"><p className="text-xs text-ink-600">Cheapest state</p><p className="mt-1 text-xl font-semibold text-ink-950">{shown.length ? [...shown].sort((a, b) => a.median! - b.median!)[0].state : "–"}</p><p className="num mt-1 text-xs text-ink-600">{shown.length ? naira([...shown].sort((a, b) => a.median! - b.median!)[0].median!) + " " + item.unit : "Not enough reports yet"}</p></div>
      </div>

      <section aria-labelledby="board-h" className="mb-8">
        <h2 id="board-h" className="h-section">{item.label}, {item.unit}, by state</h2>
        {cells.length === 0 ? (
          <EmptyState title="No reports yet">When sellers report what they charged, medians appear here by state.</EmptyState>
        ) : (
          <div className="table-wrap mt-2">
            <table className="tbl">
              <thead><tr><th>State</th><th className="text-right">Median</th><th className="text-right">Range</th><th className="text-right">Week on week</th><th className="text-right">Sellers</th><th>Latest report</th></tr></thead>
              <tbody>
                {cells.map((c) => (
                  <tr key={c.state}>
                    <td className="font-medium">{c.state}</td>
                    <td className="num text-right font-semibold">{c.median === null ? <span className="font-normal text-ink-500">Too few reports</span> : naira(c.median)}</td>
                    <td className="num text-right text-ink-700">{c.low === null ? "–" : `${naira(c.low)}–${naira(c.high!)}`}</td>
                    <td className="num text-right"><Change now={c.median} prev={c.previous} /></td>
                    <td className="num text-right">{c.sellers}</td>
                    <td className="text-ink-700">{c.updated ? fmtDate(c.updated) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-ink-600">Seller-reported prices for their own sales, not checked by RefineryLens and not an offer. Range shows the lowest and highest price among sellers counted. Week on week compares with the median of the {WINDOW_DAYS} days before.</p>
      </section>

      {canReport && (
        <section id="report" aria-labelledby="report-h" className="card max-w-4xl">
          <h2 id="report-h" className="h-section">Report what you charged</h2>
          <p className="muted mb-4">Takes a minute. Sellers who report regularly help buyers trust the board and get a reporting badge on their profile.</p>
          <PriceReportForm defaultState={mine!.state} />
          {mineReports.length > 0 && (
            <details className="mt-6 rounded-xl border border-ink-100">
              <summary className="px-4 py-3 text-sm font-medium">Your recent reports ({mineReports.length}) · only you can see these</summary>
              <div className="table-wrap border-t border-ink-100">
                <table className="tbl">
                  <thead><tr><th>Day</th><th>Product</th><th>State</th><th className="text-right">Your price</th></tr></thead>
                  <tbody>
                    {mineReports.map((r) => {
                      const it = priceItem(r.item);
                      return <tr key={r.id}><td>{fmtDate(r.day)}</td><td>{it?.label ?? r.item}</td><td>{r.state}</td><td className="num text-right">{naira(r.priceNaira)} <span className="text-xs text-ink-500">{it?.unit}</span></td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </section>
      )}
      <div className="mt-6"><Notice title="How the board stays fair">Only prices already charged are collected, never planned ones; a state appears only with at least {MIN_SELLERS} sellers; and individual sellers&apos; prices are never published.</Notice></div>
    </>
  );
}
