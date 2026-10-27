import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { PURPOSES, sharedRecord } from "@/server/hub/finance";
import { productLabel, roleLabel, stateName } from "@/lib/hub/catalog";
import { NotFoundError } from "@/lib/errors";
import { lenderDecideAction } from "@/app/actions/hub";
import { PageHeader, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { TradeRecord } from "@/components/hub/TradeRecord";
import { BusinessName, day, naira } from "@/components/hub/bits";

export const metadata = { title: "Shared trade record" };

export default async function SharedRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const data = await sharedRecord(user, (await params).id).catch((e) => { if (e instanceof NotFoundError || (e as Error).name === "ForbiddenError") return null; throw e; });
  if (!data) notFound();
  const { request: r, record } = data;
  const b = r.business;
  return (
    <>
      <Link href="/hub/lender" className="text-sm">← Lender desk</Link>
      <PageHeader eyebrow="Shared with consent" title={b.name} subtitle={`Asked for ${naira(r.amountNgn)}: ${PURPOSES.find((p) => p.id === r.purpose)?.label}, ${productLabel(r.product)}. Shared ${day(r.consentAt)}, until ${day(r.shareUntil)}.`} />
      <section className="card mb-6 text-sm">
        <p><BusinessName b={b} /></p>
        <p className="mt-1">{b.roles.map(roleLabel).join(", ")} · {b.town ? `${b.town}, ` : ""}{stateName(b.state)} · CAC <span className="num">{b.cacNumber}</span> · phone <span className="num">{b.phone}</span></p>
        {b.verifiedAt && <p className="muted mt-1">Verified by RefineryLens on {day(b.verifiedAt)}.</p>}
        {r.notes && <p className="mt-2 text-ink-700">“{r.notes}”</p>}
      </section>
      <section className="mb-6" aria-labelledby="rec-h">
        <SectionHeader id="rec-h" title="Confirmed trade record, last 12 months" />
        <div className="card"><TradeRecord record={record} /></div>
      </section>
      <section aria-labelledby="dec-h">
        <SectionHeader id="dec-h" title="Tell the business where this stands" />
        <HubForm action={lenderDecideAction} submit="Save and tell the business" className="card grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
          <input type="hidden" name="requestId" value={r.id} />
          <div><label htmlFor="status" className="label">Status</label><select id="status" name="status" className="input" defaultValue={r.status === "SHARED" ? "IN_REVIEW" : r.status}><option value="IN_REVIEW">Reviewing</option><option value="OFFERED">We would like to make an offer</option><option value="DECLINED">Declined</option></select></div>
          <div><label htmlFor="note" className="label">Message</label><input id="note" name="note" className="input" maxLength={1000} placeholder="Required to decline. Contact details or next steps." defaultValue={r.partnerNote} /></div>
        </HubForm>
      </section>
    </>
  );
}
