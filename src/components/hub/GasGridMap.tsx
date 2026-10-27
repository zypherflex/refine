import Link from "next/link";
import { STATES } from "@/lib/hub/catalog";
import type { StateCell, StateStatus } from "@/server/hub/gas";

// Navy marks data, amber marks the one thing to worry about (demand with no supply), mist means no data yet.
const STYLE: Record<StateStatus, string> = {
  SERVED: "bg-ink-800 text-white",
  DELIVERY_ONLY: "bg-ink-200 text-ink-900",
  GAP: "bg-amber-100 text-amber-800 ring-2 ring-inset ring-amber-600",
  NO_DATA: "bg-ink-50 text-ink-500",
};
export const STATUS_LABEL: Record<StateStatus, string> = { SERVED: "Supply listed", DELIVERY_ONLY: "Delivery only", GAP: "Demand, no supply (gap)", NO_DATA: "Nothing listed yet" };

/** Tile-grid map of Nigeria's states. Each tile links to that state's sites. */
export function GasGridMap({ cells, gas, selected, labels = STATUS_LABEL }: { cells: StateCell[]; gas: string; selected?: string; labels?: Record<StateStatus, string> }) {
  const byId = new Map(cells.map((c) => [c.state, c]));
  return (
    <figure>
      <div className="mx-auto grid max-w-xl grid-cols-8 gap-1" role="list" aria-label="States of Nigeria, coloured by gas supply status">
        {Array.from({ length: 8 * 8 }, (_, i) => {
          const col = i % 8;
          const row = Math.floor(i / 8);
          const s = STATES.find((x) => x.col === col && x.row === row);
          if (!s) return <span key={i} aria-hidden />;
          const c = byId.get(s.id)!;
          return (
            <Link
              key={s.id}
              role="listitem"
              href={`/hub/gas-map?gas=${gas}&state=${s.id}#state-sites`}
              title={`${s.name}: ${labels[c.status]}. ${c.supply} supply, ${c.delivery} delivery, ${c.demand} demand.`}
              aria-label={`${s.name}: ${labels[c.status]}, ${c.supply} supply, ${c.delivery} delivery, ${c.demand} demand`}
              className={`flex aspect-square flex-col items-center justify-center rounded-md text-[10px] font-semibold leading-tight no-underline hover:no-underline hover:opacity-90 sm:text-xs ${STYLE[c.status]} ${selected === s.id ? "outline outline-2 outline-offset-1 outline-brand-600" : ""}`}
            >
              <span>{s.id}</span>
              {c.supply + c.demand + c.delivery > 0 && <span className="num font-normal opacity-80">{c.supply}·{c.demand}</span>}
            </Link>
          );
        })}
      </div>
      <figcaption className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-700">
        {(Object.keys(STYLE) as StateStatus[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span aria-hidden className={`inline-block h-3 w-3 rounded-sm ${STYLE[k]}`} />{labels[k]}</span>
        ))}
        <span>Numbers: supply · demand sites</span>
      </figcaption>
    </figure>
  );
}
