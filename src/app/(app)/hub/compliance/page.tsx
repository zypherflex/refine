import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listRecords, MAX_FILE_MB } from "@/server/hub/compliance";
import { COMPLIANCE_KINDS, complianceLabel, complianceStatus, type ComplianceStatus } from "@/lib/hub/compliance";
import { addComplianceAction, removeComplianceAction, renewComplianceAction, setInVendorPackAction } from "@/app/actions/hub";
import { EmptyState, Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { day, isoDay } from "@/components/hub/bits";

export const metadata = { title: "Compliance vault" };

const STATUS: Record<ComplianceStatus, [string, string]> = {
  VALID: ["Current", "bg-brand-50 text-brand-800"],
  EXPIRING: ["Expires soon", "bg-amber-100 text-amber-800"],
  EXPIRED: ["Expired", "bg-amber-200 text-amber-900"],
  NO_EXPIRY: ["No expiry", "bg-ink-100 text-ink-700"],
};

export default async function CompliancePage() {
  const user = await requireUser();
  const data = await listRecords(user);
  const today = isoDay(new Date());
  const counts = { EXPIRED: 0, EXPIRING: 0 } as Record<string, number>;
  for (const r of data?.records ?? []) { const s = complianceStatus(r.expiresOn); counts[s] = (counts[s] ?? 0) + 1; }
  return (
    <>
      <PageHeader eyebrow="Compliance vault" title="Licences, permits and certificates" subtitle="Keep every paper in one place, get reminded before anything expires, and hand buyers a vendor pack in one click." actions={data ? <a href="/api/hub/vendor-pack" className="btn-primary btn-sm no-underline">Download vendor pack (PDF)</a> : undefined} />
      {!data ? (
        <EmptyState title="Add your business first" action={<Link href="/hub/my" className="btn-primary btn-sm no-underline">My business</Link>} />
      ) : (
        <>
          <div className="mb-6 space-y-3">
            {counts.EXPIRED > 0 && <Notice tone="warn" title={`${counts.EXPIRED} expired`}>Renew these and record the new dates. Expired papers show as expired in your vendor pack.</Notice>}
            {counts.EXPIRING > 0 && <Notice tone="warn" title={`${counts.EXPIRING} expire within 60 days`}>We remind you 60, 30 and 7 days before, and on the day.</Notice>}
            <Notice title="Who sees what">Scanned copies are private: only you can open them, not buyers and not RefineryLens staff. The vendor pack lists the papers you tick (name, number, issuer, dates) and says a copy is available on request. Free while the vault is in pilot.</Notice>
          </div>

          <section className="mb-8" aria-labelledby="list-h">
            <SectionHeader id="list-h" title="Your papers" note={`${data.records.length}`} />
            {data.records.length ? (
              <ul className="space-y-3">
                {data.records.map((r) => {
                  const s = complianceStatus(r.expiresOn);
                  return (
                    <li key={r.id} className="card text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{r.title} <Pill className={STATUS[s][1]}>{STATUS[s][0]}</Pill> {!r.inVendorPack && <Pill className="bg-ink-100 text-ink-700">Not in vendor pack</Pill>}</p>
                        {r.storageKey && <a href={`/api/hub/compliance/${r.id}`} className="text-sm">Open copy</a>}
                      </div>
                      <p className="mt-1 text-ink-700">
                        {r.title !== complianceLabel(r.kind) ? `${complianceLabel(r.kind)} · ` : ""}{r.number ? <>No. <span className="num">{r.number}</span> · </> : null}{r.issuer ? `${r.issuer} · ` : ""}{r.issuedOn ? `issued ${day(r.issuedOn)} · ` : ""}{r.expiresOn ? `expires ${day(r.expiresOn)}` : "does not expire"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-start gap-2">
                        {r.expiresOn && (
                          <details className="w-full sm:w-auto">
                            <summary className="cursor-pointer text-brand-700">Record a renewal</summary>
                            <HubForm action={renewComplianceAction} submit="Save renewal" className="mt-2 grid gap-2 sm:grid-cols-2">
                              <input type="hidden" name="id" value={r.id} />
                              <div><label className="label" htmlFor={`ri-${r.id}`}>Issued on</label><input id={`ri-${r.id}`} name="issuedOn" type="date" className="input" max={today} /></div>
                              <div><label className="label" htmlFor={`re-${r.id}`}>New expiry date</label><input id={`re-${r.id}`} name="expiresOn" type="date" className="input" required /></div>
                              <div><label className="label" htmlFor={`rn-${r.id}`}>New number (if it changed)</label><input id={`rn-${r.id}`} name="number" className="input" maxLength={80} /></div>
                              <div><label className="label" htmlFor={`rf-${r.id}`}>New copy (optional)</label><input id={`rf-${r.id}`} name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="input" /></div>
                            </HubForm>
                          </details>
                        )}
                        <HubForm action={setInVendorPackAction} submit={r.inVendorPack ? "Leave out of vendor pack" : "Include in vendor pack"} buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={r.id} /><input type="hidden" name="include" value={r.inVendorPack ? "0" : "1"} /></HubForm>
                        <HubForm action={removeComplianceAction} submit="Remove" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={r.id} /></HubForm>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title="Nothing in the vault yet">Start with your CAC certificate and NMDPRA licence.</EmptyState>}
          </section>

          <section aria-labelledby="add-h">
            <SectionHeader id="add-h" title="Add a paper" note={`PDF, PNG or JPEG up to ${MAX_FILE_MB} MB. The copy is optional.`} />
            <HubForm action={addComplianceAction} submit="Save to vault" className="card space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="kind">What it is</label><select id="kind" name="kind" className="input">{COMPLIANCE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></div>
                <div><label className="label" htmlFor="ctitle">Name (optional)</label><input id="ctitle" name="title" className="input" maxLength={120} placeholder="e.g. LPG retail outlet licence, Ikeja" /></div>
                <div><label className="label" htmlFor="cnumber">Number</label><input id="cnumber" name="number" className="input num" maxLength={80} /></div>
                <div><label className="label" htmlFor="cissuer">Issued by</label><input id="cissuer" name="issuer" className="input" maxLength={120} placeholder="e.g. NMDPRA" /></div>
                <div><label className="label" htmlFor="issuedOn">Issued on</label><input id="issuedOn" name="issuedOn" type="date" className="input" max={today} /></div>
                <div><label className="label" htmlFor="expiresOn">Expires on (leave empty only for papers that never expire)</label><input id="expiresOn" name="expiresOn" type="date" className="input" /></div>
              </div>
              <div><label className="label" htmlFor="cfile">Scanned copy (optional)</label><input id="cfile" name="file" type="file" accept="application/pdf,image/png,image/jpeg" className="input" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inVendorPack" defaultChecked /> List this in my vendor pack</label>
            </HubForm>
          </section>
        </>
      )}
    </>
  );
}
