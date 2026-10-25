import Link from "next/link";
import type { Metric } from "@prisma/client";
import { fmtDate, fmtNumber } from "@/lib/format";
import { unitLabel } from "@/lib/calculations";
import { provenanceLabel, scopeLabel } from "@/lib/labels";
import { Pill } from "./ui";

type M = Metric & { document: { id: string; title: string } | null; legalEntity: { name: string } | null; conflictClaims?: { conflict: { topic: string; status: string } }[] };

const auditLabel = { AUDITED: "Audited", UNAUDITED: "Unaudited", RESTATED: "Restated", NOT_APPLICABLE: "—" } as const;
const typeStyle = { REPORTED: "bg-navy-100 text-navy-900", CALCULATED: "bg-teal-100 text-teal-800", ESTIMATED: "bg-amber-100 text-amber-800" } as const;

export function MetricTable({ rows }: { rows: M[] }) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr><th scope="col">Period</th><th scope="col">Value</th><th scope="col">Scope and entity</th><th scope="col">Type</th><th scope="col">Audit</th><th scope="col">Source</th></tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className={m.status === "DRAFT" ? "bg-amber-50/60" : ""}>
              <td className="whitespace-nowrap">{m.periodLabel}{m.status === "DRAFT" && <Pill className="ml-1 bg-amber-100 text-amber-800">Draft, staff only</Pill>}</td>
              <td className="tabular-nums">
                {m.disclosureStatus === "NOT_DISCLOSED" ? <span className="font-medium text-navy-700">Not publicly disclosed</span> : m.value === null ? <span className="text-navy-700">{m.notes || "No numeric value"}</span> : <><span className="font-semibold">{fmtNumber(Number(m.value))}</span> <span className="text-xs text-navy-700">{m.unit === "%" ? "%" : unitLabel(m)}</span></>}
                {m.conflictClaims?.some((c) => c.conflict.status === "UNRESOLVED") && <p className="text-xs text-amber-800">Conflicting source exists</p>}
              </td>
              <td className="text-xs">{scopeLabel[m.scope]}{m.legalEntity && <><br />{m.legalEntity.name}</>}</td>
              <td><Pill className={typeStyle[m.valueType]}>{m.valueType === "REPORTED" ? "Reported" : m.valueType === "CALCULATED" ? "Calculated" : "Estimate"}</Pill><p className="mt-0.5 text-xs text-navy-700">{provenanceLabel[m.provenance]}</p></td>
              <td className="text-xs">{auditLabel[m.auditStatus]}</td>
              <td className="text-xs">
                {m.document ? <Link href={`/documents/${m.document.id}?page=${m.page ?? 1}`}>{m.document.title}{m.page ? `, p.${m.page}` : ""}</Link> : m.excerpt ? <span>“{m.excerpt}”</span> : "—"}
                {m.formula && <p className="mt-0.5">Formula: {m.formula}</p>}
                {m.methodology && <p className="mt-0.5">Method: {m.methodology}</p>}
                {m.notes && m.value !== null && <p className="mt-0.5 text-navy-700">{m.notes}</p>}
                <p className="mt-0.5 text-navy-700">Updated {fmtDate(m.updatedAt)}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
