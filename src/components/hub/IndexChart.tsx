"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type IndexChartPoint = { weekEnding: string; median: number | null; sellers: number };

/** Weekly median line. Weeks without enough sellers are gaps, never filled in. */
export function IndexChart({ points, unit, label }: { points: IndexChartPoint[]; unit: string; label: string }) {
  const published = points.filter((p) => p.median != null);
  if (published.length < 2) return <p className="muted text-sm">Not enough weeks with three or more sellers to draw a line yet.</p>;
  const first = published[0]!;
  const last = published.at(-1)!;
  const summary = `${label}: weekly median ₦${first.median!.toLocaleString("en-GB")} per ${unit} in the week to ${first.weekEnding}, ₦${last.median!.toLocaleString("en-GB")} in the week to ${last.weekEnding}. ${published.length} of ${points.length} weeks have enough sellers.`;
  return (
    <div role="img" aria-label={summary} className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#e6e9f2" />
          <XAxis dataKey="weekEnding" tick={{ fontSize: 10, fill: "#182a5a" }} axisLine={{ stroke: "#d5dae6" }} tickLine={false} minTickGap={40} />
          <YAxis tick={{ fontSize: 10, fill: "#182a5a" }} axisLine={false} tickLine={false} width={60} domain={["auto", "auto"]} tickFormatter={(v: number) => `₦${v.toLocaleString("en-GB")}`} />
          <Tooltip formatter={(v, _n, item) => [`₦${Number(v).toLocaleString("en-GB")}/${unit} · ${(item.payload as IndexChartPoint).sellers} sellers`, "Median"]} labelFormatter={(l) => `Week to ${l}`} contentStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="median" stroke="#5b2ee8" strokeWidth={2} dot={points.length <= 30} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
