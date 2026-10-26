import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listBoard } from "@/server/opportunities/board";
import { regionalRefineries, signalPoints } from "@/server/opportunities/context";
import { filterOpportunities, OPPORTUNITIES, SCALES, SEGMENTS, STAGES, scaleLabel, segmentLabel } from "@/lib/opportunities/catalog";
import { DANGOTE_STATED_CDU_BPD } from "@/lib/opportunities/calculators";
import { HUB_SIGNALS } from "@/lib/opportunities/signals";
import { MarketPanel } from "@/components/opportunities/MarketPanel";
import { EmptyState, Notice, PageHeader, Pill, Unavailable } from "@/components/ui";

export const metadata = { title: "Business opportunities" };

type Search = Promise<{ scale?: string; segment?: string; q?: string; welcome?: string }>;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Search }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scale = SCALES.some((s) => s.id === sp.scale) ? sp.scale! : "";
  const segment = SEGMENTS.some((s) => s.id === sp.segment) ? sp.segment! : "";
  const q = (sp.q ?? "").slice(0, 80);
  const list = filterOpportunities({ scale, segment, q });
  const [board, points, refineries] = await Promise.all([listBoard(user), signalPoints(HUB_SIGNALS, user), regionalRefineries(user)]);
  const onBoard = new Map(board.map((b) => [b.opportunitySlug, b.stage]));
  const stageLabel = Object.fromEntries(STAGES) as Record<string, string>;

  return (
    <>
      <PageHeader
        eyebrow="Opportunities"
        title="Business opportunities around Dangote"
        subtitle="Where businesses of every size could plug into Dangote's Lekki complex, which the company states has 700,000 bpd of refining and 830 KTPA of polypropylene capacity: fuel distribution, gas, logistics, polypropylene, crude supply, modular refining and plant services. Each idea shows the company-stated facts it rests on, dated reports that help or hurt the case, and a tool to size it with your own numbers."
        actions={<><Link href="/opportunities/tools" className="btn-secondary btn-sm no-underline">Sizing tools</Link><Link href="/opportunities/board" className="btn-primary btn-sm no-underline">My board ({board.length})</Link></>}
      />
      {sp.welcome && <div className="mb-4"><Notice tone="ok" title="Welcome to RefineryLens">Pick your business size below, open an opportunity, and size it with your own numbers. Your board and scenarios are private to you.</Notice></div>}
      <div className="mb-6">
        <Notice title="Independent analysis, not an offer">
          These are RefineryLens research notes on possible business models. None is an offer, tender, distributorship or partnership programme of Dangote or any Dangote company, and RefineryLens is not affiliated with them. Confirm terms directly with suppliers and regulators. Not financial advice.
        </Notice>
      </div>

      <section aria-labelledby="scale-h" className="mb-8">
        <h2 id="scale-h" className="h-section">Start from your size</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SCALES.map((s) => {
            const n = OPPORTUNITIES.filter((o) => o.scales.includes(s.id)).length;
            const active = scale === s.id;
            return (
              <li key={s.id}>
                <Link href={active ? "/opportunities" : `/opportunities?scale=${s.id}`} aria-current={active ? "true" : undefined} className={`card-link block h-full rounded-xl border p-3 no-underline hover:no-underline ${active ? "border-brand-600 bg-brand-50" : "border-ink-100 bg-white"}`}>
                  <p className="font-semibold text-ink-950">{s.label} <span className="text-xs font-normal text-ink-500">· {n} ideas</span></p>
                  <p className="mt-1 text-xs text-ink-600">{s.who}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <form method="get" className="mb-5 grid gap-3 rounded-xl border border-ink-100 bg-white p-4 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end" role="search" aria-label="Filter opportunities">
        <div>
          <label htmlFor="scale" className="label">Business size</label>
          <select id="scale" name="scale" className="input" defaultValue={scale}>
            <option value="">All sizes</option>
            {SCALES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="segment" className="label">Area</label>
          <select id="segment" name="segment" className="input" defaultValue={segment}>
            <option value="">All areas</option>
            {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" className="input" defaultValue={q} placeholder="e.g. LPG, trucks, plastics" maxLength={80} />
        </div>
        <button className="btn-primary">Show</button>
      </form>

      <section aria-labelledby="list-h">
        <h2 id="list-h" className="sr-only">Opportunities</h2>
        <p className="mb-3 text-sm text-ink-600" role="status">{list.length} of {OPPORTUNITIES.length} opportunities{scale ? ` for ${scaleLabel(scale).toLowerCase()} businesses` : ""}{segment ? ` in ${segmentLabel(segment).toLowerCase()}` : ""}.</p>
        {list.length === 0 ? (
          <EmptyState title="No opportunities match" action={<Link href="/opportunities" className="btn-secondary btn-sm no-underline">Clear filters</Link>}>Try a different size or area.</EmptyState>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {list.map((o) => (
              <li key={o.slug} className="card flex flex-col">
                <p className="eyebrow">{segmentLabel(o.segment)}</p>
                <h3 className="mt-1 text-base font-semibold text-ink-950"><Link href={`/opportunities/${o.slug}`}>{o.title}</Link></h3>
                <p className="mt-1 flex-1 text-sm text-ink-700">{o.pitch}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {o.scales.map((s) => <Pill key={s} className="bg-ink-50 text-ink-700 ring-1 ring-inset ring-ink-100">{scaleLabel(s)}</Pill>)}
                  {o.calculator && <Pill className="bg-brand-50 text-brand-800">Sizing tool</Pill>}
                  {onBoard.has(o.slug) && <Pill className="bg-brand-600 text-white">On your board: {stageLabel[onBoard.get(o.slug)!]}</Pill>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 space-y-8">
        <MarketPanel keys={HUB_SIGNALS} points={points} />
        <section aria-labelledby="reg-h">
          <h2 id="reg-h" className="h-section">Refineries in West and Central Africa</h2>
          <p className="muted">Capacity benchmarks for regional trade and modular refining. Dangote's stated crude distillation capacity is {DANGOTE_STATED_CDU_BPD.toLocaleString("en-GB")} bpd.</p>
          {refineries.length === 0 ? (
            <div className="mt-3"><Unavailable title="Refinery directory is not loaded yet">The open refinery directory has not been imported into this installation. RefineryLens does not list refineries from memory.</Unavailable></div>
          ) : (
            <div className="table-wrap mt-3">
              <table className="tbl">
                <caption className="sr-only">Refineries by stated capacity</caption>
                <thead><tr><th scope="col">Refinery</th><th scope="col">Country</th><th scope="col" className="text-right">Capacity (bpd)</th><th scope="col" className="text-right">vs Dangote stated</th><th scope="col">Source</th></tr></thead>
                <tbody>
                  {refineries.slice(0, 25).map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td>{r.countryCode}</td>
                      <td className="num text-right">{r.capacityBpd === null ? "Not stated" : r.capacityBpd.toLocaleString("en-GB")}</td>
                      <td className="num text-right">{r.capacityBpd === null ? "–" : `${((r.capacityBpd / DANGOTE_STATED_CDU_BPD) * 100).toFixed(1)}%`}</td>
                      <td className="text-xs"><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{r.attribution}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
