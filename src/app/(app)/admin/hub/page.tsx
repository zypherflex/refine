import Link from "next/link";
import { requireRole } from "@/server/auth";
import { moderatedBusinesses, openReports, verificationQueue } from "@/server/hub/moderation";
import { closeReportAction, reinstateBusinessAction } from "@/app/actions/hub";
import { roleLabel } from "@/lib/hub/catalog";
import { fmtDateTime } from "@/lib/format";
import { DecideForm, SuspendForm } from "@/components/hub/forms";
import { VerificationBadge } from "@/components/hub/parts";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Trade hub moderation" };

export default async function HubModerationPage() {
  const admin = await requireRole("ADMIN");
  const [queue, reports, decided] = await Promise.all([verificationQueue(admin), openReports(admin), moderatedBusinesses(admin)]);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/admin">← Administration</Link></p>
      <PageHeader eyebrow="Administration" title="Trade hub moderation" subtitle="Check registration and licence details before verifying, and act on reports. Administrators cannot read conversations between businesses." />
      <section aria-labelledby="q-h" className="mb-8">
        <h2 id="q-h" className="h-section">Verification requests ({queue.length})</h2>
        <p className="muted">Check the CAC number on the CAC public search and each licence with the issuing regulator (e.g. NMDPRA) before verifying. The badge tells users these details were checked; it is not a guarantee.</p>
        {queue.length === 0 ? (
          <EmptyState title="Nothing waiting" />
        ) : (
          <ul className="mt-3 space-y-4">
            {queue.map((b) => (
              <li key={b.id} className="card grid gap-4 lg:grid-cols-2">
                <div className="text-sm">
                  <p className="font-semibold"><Link href={`/hub/businesses/${b.id}`}>{b.name}</Link></p>
                  <p className="text-xs text-navy-600">{b.roles.map(roleLabel).join(", ")} · {[b.city, b.state].filter(Boolean).join(", ")} · owner {b.owner.name} ({b.owner.email})</p>
                  <dl className="mt-2 space-y-1">
                    <div><dt className="inline text-navy-600">CAC registration: </dt><dd className="inline font-medium">{b.registrationNumber || "not given"}</dd></div>
                    <div><dt className="inline text-navy-600">Licences: </dt><dd className="inline">{b.licences || "none listed"}</dd></div>
                    {b.capacityBpd && <div><dt className="inline text-navy-600">Stated capacity: </dt><dd className="inline">{b.capacityBpd.toLocaleString("en-GB")} bpd</dd></div>}
                    {b.website && <div><dt className="inline text-navy-600">Website: </dt><dd className="inline"><a href={b.website} target="_blank" rel="noopener noreferrer nofollow">{b.website}</a></dd></div>}
                    <div><dt className="inline text-navy-600">Requested: </dt><dd className="inline">{fmtDateTime(b.updatedAt)}</dd></div>
                  </dl>
                </div>
                <DecideForm businessId={b.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="r-h" className="mb-8">
        <h2 id="r-h" className="h-section">Open reports ({reports.length})</h2>
        {reports.length === 0 ? (
          <EmptyState title="No open reports" />
        ) : (
          <ul className="mt-3 space-y-4">
            {reports.map((r) => (
              <li key={r.id} className="card space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/hub/businesses/${r.business.id}`} className="font-semibold">{r.business.name}</Link>
                  <VerificationBadge v={r.business.verification} />
                  <span className="text-xs text-navy-600">reported by {r.reporter.name} ({r.reporter.email}) · {fmtDateTime(r.createdAt)}</span>
                </div>
                <p className="whitespace-pre-line rounded-lg bg-navy-50 px-3 py-2">{r.reason}</p>
                {r.business.verification !== "SUSPENDED" && <SuspendForm businessId={r.business.id} name={r.business.name} />}
                <form action={closeReportAction}><input type="hidden" name="id" value={r.id} /><button className="btn-secondary btn-sm">Close report</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="d-h">
        <h2 id="d-h" className="h-section">Verified and suspended businesses</h2>
        {decided.length === 0 ? (
          <EmptyState title="None yet" />
        ) : (
          <div className="table-wrap mt-2">
            <table className="tbl">
              <thead><tr><th>Business</th><th>Status</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {decided.map((b) => (
                  <tr key={b.id}>
                    <td><Link href={`/hub/businesses/${b.id}`}>{b.name}</Link><p className="text-xs text-navy-600">{b.roles.map(roleLabel).join(", ")}</p></td>
                    <td><VerificationBadge v={b.verification} /></td>
                    <td className="text-xs">{b.verificationNote}</td>
                    <td>
                      {b.verification === "SUSPENDED" ? (
                        <form action={reinstateBusinessAction}><input type="hidden" name="businessId" value={b.id} /><button className="btn-secondary btn-sm">Lift suspension</button></form>
                      ) : (
                        <SuspendForm businessId={b.id} name={b.name} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
