import { layerValue, LAYERS, STATE_GRID, type NetworkLayer, type StateSummary } from "@/lib/hub/gas";

/**
 * Schematic tile map of Nigeria's states. One sequential green scale for counts (grey means none), the count printed
 * on every tile so colour is never the only cue, and a native tooltip and link per state. "Gaps" uses the amber
 * warning colour with a "!" and the word "Gap".
 */

const TILE = 92;
const GAP = 4;
const COLS = 7;
const ROWS = 8;

// Steps of the brand green ramp, light to dark, with the text colour that meets contrast on each.
const STEPS = [
  { min: 1, fill: "#ebe5ff", text: "#0b1530" },
  { min: 2, fill: "#b8a3ff", text: "#0b1530" },
  { min: 4, fill: "#5b2ee8", text: "#ffffff" },
  { min: 7, fill: "#2a1470", text: "#ffffff" },
] as const;
const EMPTY = { fill: "#f4f6fb", text: "#66759a" };
const GAP_STYLE = { fill: "#fbefd5", text: "#7a4a05", stroke: "#b7791f" };

function style(v: number) {
  let s: { fill: string; text: string } = EMPTY;
  for (const step of STEPS) if (v >= step.min) s = step;
  return s;
}

const short: Record<string, string> = { "FCT Abuja": "FCT", "Cross River": "C. River", "Akwa Ibom": "Akwa Ibom", Nasarawa: "Nasarawa" };

export function GasMap({ summary, layer, selected, hrefFor }: { summary: StateSummary[]; layer: NetworkLayer; selected: string; hrefFor: (state: string) => string }) {
  const meta = LAYERS.find((l) => l.id === layer)!;
  const w = COLS * (TILE + GAP);
  const h = ROWS * (TILE + GAP);
  return (
    <figure className="m-0">
      {/* Fixed minimum width so state names stay legible on phones; the card scrolls sideways instead. */}
      <div className="-mx-1 overflow-x-auto px-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full min-w-[34rem] max-w-[44rem]" role="group" aria-label={`Schematic map of Nigeria's states: ${meta.label.toLowerCase()}`}>
        {summary.map((row) => {
          const pos = STATE_GRID[row.state as keyof typeof STATE_GRID];
          if (!pos) return null;
          const v = layerValue(row, layer);
          const isGap = layer === "gaps" && row.gap;
          const s = isGap ? GAP_STYLE : style(v);
          const x = pos[0] * (TILE + GAP);
          const y = pos[1] * (TILE + GAP);
          const sel = row.state === selected;
          const detail = `${row.supply} supply point${row.supply === 1 ? "" : "s"}, ${row.delivery} delivery, ${row.demand} buyer request${row.demand === 1 ? "" : "s"}${row.gap ? ". Gap: demand with no supply or delivery" : ""}`;
          return (
            <a key={row.state} href={hrefFor(row.state)} aria-label={`${row.state}: ${detail}`} aria-current={sel ? "true" : undefined} className="group outline-none">
              <title>{`${row.state}: ${detail}`}</title>
              <rect x={x} y={y} width={TILE} height={TILE} rx={8} fill={s.fill} stroke={sel ? "#0b1530" : isGap ? GAP_STYLE.stroke : v ? "transparent" : "#d5dbe9"} strokeWidth={sel ? 3 : isGap ? 2 : 1} strokeDasharray={!v && !isGap ? "4 3" : undefined} className="transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80" />
              <text x={x + TILE / 2} y={y + 34} textAnchor="middle" fontSize={13} fontWeight={500} fill={s.text}>{short[row.state] ?? row.state}</text>
              <text x={x + TILE / 2} y={y + 64} textAnchor="middle" fontSize={22} fontWeight={600} fill={s.text} className="num">{isGap ? "! Gap" : layer === "gaps" ? "–" : v}</text>
              {sel && <rect x={x + 2} y={y + 2} width={TILE - 4} height={TILE - 4} rx={7} fill="none" stroke="#ffffff" strokeWidth={1} />}
            </a>
          );
        })}
      </svg>
      </div>
      <figcaption className="mt-3 space-y-2 text-xs text-ink-600">
        <p className="font-medium text-ink-800 sm:hidden">Swipe the map sideways to see the eastern states, or use the table view below.</p>
        {layer === "gaps" ? (
          <p className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-4 rounded-sm" style={{ background: GAP_STYLE.fill, outline: `2px solid ${GAP_STYLE.stroke}` }} /> ! Gap: buyers want gas delivered here, and no supply point or delivery partner is listed</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-4 rounded-sm border border-dashed border-ink-200" style={{ background: EMPTY.fill }} /> – No gap</span>
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-3" aria-label={`Legend: ${meta.label}`}>
            <span className="font-medium text-ink-800">{meta.label}:</span>
            <span className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-4 rounded-sm border border-dashed border-ink-200" style={{ background: EMPTY.fill }} /> 0</span>
            {STEPS.map((s, i) => (
              <span key={s.min} className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-4 rounded-sm" style={{ background: s.fill }} /> {STEPS[i + 1] ? (STEPS[i + 1].min - 1 === s.min ? s.min : `${s.min}–${STEPS[i + 1].min - 1}`) : `${s.min}+`}</span>
            ))}
          </p>
        )}
        <p>{meta.help}. Schematic: each state is one equal tile placed roughly where it lies, not to scale. Select a state for its sites and the nearest supply.</p>
      </figcaption>
    </figure>
  );
}
