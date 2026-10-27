import type { MonthRow } from "@/server/hub/finance";
import type { Component } from "@/server/hub/reliability";
import { Reliability } from "./Reliability";

/** The record a lender sees: monthly confirmed activity and the reliability score. Counterparties are counted, not named. */
export function TradeRecord({ record }: { record: { months: MonthRow[]; counterparties: number; reliability: { confirmed: number; due: number; components: Component[]; score: number | null } } }) {
  const totalJobs = record.months.reduce((s, m) => s + m.jobs, 0);
  const totalSupply = record.months.reduce((s, m) => s + m.supplyDeliveries, 0);
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-600">Delivery jobs, 12 months</dt><dd className="num text-xl">{totalJobs}</dd></div>
        <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-600">Supply deliveries, 12 months</dt><dd className="num text-xl">{totalSupply}</dd></div>
        <div className="rounded-xl bg-ink-50 p-3"><dt className="text-xs text-ink-600">Different trading partners</dt><dd className="num text-xl">{record.counterparties}</dd></div>
      </dl>
      <div className="table-wrap">
        <table className="tbl min-w-0">
          <caption className="sr-only">Confirmed activity by month</caption>
          <thead><tr><th scope="col">Month</th><th scope="col" className="text-right">Jobs</th><th scope="col" className="text-right">Supply deliveries</th><th scope="col">Supplied quantity</th></tr></thead>
          <tbody>
            {record.months.map((m) => (
              <tr key={m.month}><td className="num">{m.month}</td><td className="num text-right">{m.jobs}</td><td className="num text-right">{m.supplyDeliveries}</td><td className="num text-xs">{Object.entries(m.supplyQuantity).map(([k, v]) => `${v.toLocaleString("en-GB")} ${k.split(" ")[1]} ${k.split(" ")[0]}`).join(", ") || "-"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <Reliability r={record.reliability} />
      <p className="muted text-xs">Only trades confirmed by both sides on RefineryLens are counted. Figures are what the parties confirmed; RefineryLens has not audited them.</p>
    </div>
  );
}
