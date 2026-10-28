"use client";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = { period: string; value: number; note?: string };

/**
 * Comparable-period bar chart. Only points with the same scope, currency and period type are passed in,
 * so bars are always like-for-like. A text summary and data table accompany the chart for screen readers.
 */
export function PeriodChart({ title, unit, points, description }: { title: string; unit: string; points: ChartPoint[]; description: string }) {
  if (points.length < 2) return null;
  const summary = `${title}: ${points.map((p) => `${p.period} ${p.value.toLocaleString("en-GB")} ${unit}`).join("; ")}.`;
  return (
    <figure className="mt-3">
      <div role="img" aria-label={summary} className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#e4eee8" />
            <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#0f2f20" }} axisLine={{ stroke: "#d0ded6" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#0f2f20" }} axisLine={false} tickLine={false} width={64} tickFormatter={(v: number) => v.toLocaleString("en-GB")} />
            <ReferenceLine y={0} stroke="#365a48" />
            <Tooltip formatter={(v) => [`${Number(v).toLocaleString("en-GB")} ${unit}`, title]} contentStyle={{ fontSize: 12 }} />
            <Bar dataKey="value" fill="#087c47" radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-xs text-ink-700">{description}</figcaption>
      <details className="mt-1 text-xs">
        <summary className="text-brand-700">Show chart data as a table</summary>
        <table className="mt-1 w-full text-left">
          <thead><tr><th className="py-1 pr-3">Period</th><th className="py-1">{title} ({unit})</th></tr></thead>
          <tbody>{points.map((p) => <tr key={p.period}><td className="py-0.5 pr-3">{p.period}</td><td className="tabular-nums">{p.value.toLocaleString("en-GB")}{p.note ? ` (${p.note})` : ""}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
