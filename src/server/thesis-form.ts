import { db } from "@/lib/db";
import { TOPICS, topicLabel } from "@/lib/labels";
import { FINANCIAL_KEYS, OPERATIONAL_KEYS } from "./services/metrics";

export async function thesisFormOptions() {
  const companies = await db.company.findMany({ select: { id: true, name: true }, orderBy: [{ isFictional: "asc" }, { name: "asc" }] });
  const unit: Record<string, string> = { utilization: "%", refining_margin: "USD/bbl", throughput: "bpd", nameplate_capacity: "bpd" };
  const metricOptions = [...FINANCIAL_KEYS, ...OPERATIONAL_KEYS].map(([key, label]) => ({ key, label, unit: unit[key] ?? (FINANCIAL_KEYS.some(([k]) => k === key) ? "currency bn" : "") }));
  return { companies, metricOptions, topics: TOPICS.map((t) => ({ value: t, label: topicLabel[t] })) };
}
