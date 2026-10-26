"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SeriesPoint = { period: string; value: number };

/** Time-series line for one open-data series, with a text summary and a data table for screen readers. */
export function MarketChart({ title, unit, points }: { title: string; unit: string; points: SeriesPoint[] }) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const summary = `${title}: from ${first.value.toLocaleString("en-GB")} ${unit} (${first.period}) to ${last.value.toLocaleString("en-GB")} ${unit} (${last.period}), ${points.length} observations.`;
  return (
    <figure className="mt-3">
      <div role="img" aria-label={summary} className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e6e9f2" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#182a5a" }} axisLine={{ stroke: "#d5dae6" }} tickLine={false} minTickGap={36} />
            <YAxis tick={{ fontSize: 10, fill: "#182a5a" }} axisLine={false} tickLine={false} width={56} domain={["auto", "auto"]} tickFormatter={(v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: 2, notation: v >= 1e6 ? "compact" : "standard" })} />
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString("en-GB")} ${unit}`, title]} contentStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke="#087c47" strokeWidth={1.8} dot={points.length <= 30} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-1 text-xs">
        <summary className="text-brand-700">Show data as a table</summary>
        <div className="max-h-48 overflow-y-auto">
          <table className="mt-1 w-full text-left">
            <thead><tr><th className="py-1 pr-3">Period</th><th className="py-1">{unit}</th></tr></thead>
            <tbody>{[...points].reverse().map((p) => <tr key={p.period}><td className="py-0.5 pr-3">{p.period}</td><td className="tabular-nums">{p.value.toLocaleString("en-GB")}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
