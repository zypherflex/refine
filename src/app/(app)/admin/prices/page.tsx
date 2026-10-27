import Link from "next/link";
import { requireRole } from "@/server/auth";
import { priceWatch, SUSPICIOUS_SHARE } from "@/server/admin/everyday";
import { hidePriceReportAction } from "@/app/actions/admin-tools";
import { NIGERIAN_STATES } from "@/lib/hub/catalog";
import { naira } from "@/lib/hub/prices";
import { EVERYDAY_ITEMS, EVERYDAY_LABEL, MIN_REPORTERS } from "@/lib/everyday";
import { fmtDateTime } from "@/lib/format";
import { Badge, Field, FilterBar, Select } from "@/components/admin/parts";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Price watch · Administration" };
export const dynamic = "force-dynamic";

const label = (item: string) => EVERYDAY_LABEL[item as keyof typeof EVERYDAY_LABEL] ?? item;

export default async function AdminPrices({ searchParams }: { searchParams: Promise<{ state?: string; item?: string }> }) {
  const admin = await requireRole("ADMIN");
  const sp = await searchParams;
  const { table, suspicious } = await priceWatch(admin, sp);
  return (
    <>
      <PageHeader eyebrow="Everyday" title="Price watch" subtitle={`What the public is reporting this week, and reports more than ${SUSPICIOUS_SHARE * 100}% away from their state's weekly median. Hide wrong ones before they mislead people.`} />
      <FilterBar action="/admin/prices">
        <Field label="State"><Select name="state" value={sp.state} options={NIGERIAN_STATES} /></Field>
        <Field label="Product"><Select name="item" value={sp.item} options={EVERYDAY_ITEMS.map((i) => [i, label(i)] as const)} /></Field>
      </FilterBar>
      <section aria-labelledby="sus-h" className="mb-8">
        <h2 id="sus-h" className="h-section">Far from the median ({suspicious.length})</h2>
        {suspicious.length === 0 ? <EmptyState title="Nothing unusual this week" /> : (
          <div className="table-wrap mt-2">
            <table className="tbl">
              <thead><tr><th>Place</th><th>Product</th><th className="text-right">Reported</th><th className="text-right">Week median</th><th className="text-right">Off by</th><th>By</th><th /></tr></thead>
              <tbody>
                {suspicious.map(({ r, median, off }) => (
                  <tr key={r.id}>
                    <td><Link href={`/stations/${r.outlet.id}`}>{r.outlet.name}</Link><p className="text-xs text-ink-600">{r.outlet.area}, {r.outlet.state} · {fmtDateTime(r.createdAt)}</p></td>
                    <td>{label(r.item!)}</td>
                    <td className="num text-right font-semibold">{naira(r.priceNaira!)}</td>
                    <td className="num text-right">{naira(median!)}</td>
                    <td className="num text-right"><Badge tone={Math.abs(off) > 0.6 ? "bad" : "warn"}>{off > 0 ? "+" : ""}{Math.round(off * 100)}%</Badge></td>
                    <td className="text-xs">{r.user ? <Link href={`/admin/users/${r.user.id}`}>{r.user.name}</Link> : "deleted account"}</td>
                    <td><form action={hidePriceReportAction}><input type="hidden" name="id" value={r.id} /><button className="btn-ghost btn-sm text-risk-700">Hide</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-labelledby="tbl-h">
        <h2 id="tbl-h" className="h-section">Medians by state and product</h2>
        {table.length === 0 ? <EmptyState title="No price reports this week" /> : (
          <div className="table-wrap mt-2">
            <table className="tbl">
              <thead><tr><th>State</th><th>Product</th><th className="text-right">Public now (3 days)</th><th className="text-right">People</th><th className="text-right">Week median</th><th className="text-right">Week reports</th></tr></thead>
              <tbody>
                {table.map((t) => (
                  <tr key={`${t.state}-${t.item}`}>
                    <td>{t.state}</td><td>{label(t.item)}</td>
                    <td className="num text-right">{t.fresh.median === null ? <span className="text-ink-500">needs {MIN_REPORTERS}</span> : naira(t.fresh.median)}</td>
                    <td className="num text-right">{t.fresh.reporters}</td>
                    <td className="num text-right">{t.week.median === null ? "–" : naira(t.week.median)}</td>
                    <td className="num text-right">{t.week.reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
