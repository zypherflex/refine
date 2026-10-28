import Link from "next/link";
import { requireUser } from "@/server/auth";
import { openThread } from "@/server/hub/messages";
import { kindLabel } from "@/lib/hub/catalog";
import { fmtDateTime } from "@/lib/format";
import { ReplyForm } from "@/components/hub/forms";
import { DemoTag, SafetyNote, VerificationBadge } from "@/components/hub/parts";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Conversation" };

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const { thread, side, messages, starterBusiness, listing } = await openThread(user, id);
  const other = side === "starter" ? { id: thread.business.id, name: thread.business.name, verification: thread.business.verification, isDemo: false } : starterBusiness;
  const names = new Map([[thread.starterId, starterBusiness?.name ?? "Enquirer"], [thread.business.ownerId, thread.business.name]]);
  const blocked = side === "starter" && thread.business.verification === "SUSPENDED";
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub/inbox">← Inbox</Link></p>
      <PageHeader
        eyebrow={listing ? kindLabel(listing.kind) : "Direct message"}
        title={thread.subject}
        subtitle={other ? <span className="flex flex-wrap items-center gap-1.5">With <Link href={`/hub/businesses/${other.id}`}>{other.name}</Link> <VerificationBadge v={other.verification} />{other.isDemo && <DemoTag />}</span> : undefined}
        actions={listing ? <Link href={`/hub/listings/${listing.id}`} className="btn-secondary btn-sm no-underline">View listing</Link> : undefined}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2" aria-label="Messages">
          <ol className="space-y-3">
            {messages.map((m) => {
              const me = m.senderId === user.id;
              return (
                <li key={m.id} className={`max-w-[85%] rounded-xl px-4 py-3 text-sm shadow-card ${me ? "ml-auto bg-teal-50 ring-1 ring-teal-600/20" : "bg-white ring-1 ring-navy-100"}`}>
                  <p className="text-[11px] text-navy-600"><span className="font-medium text-navy-800">{me ? "You" : names.get(m.senderId)}</span> · {fmtDateTime(m.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-line text-navy-900">{m.body}</p>
                </li>
              );
            })}
          </ol>
          {blocked ? (
            <Notice tone="risk" title="This business has been suspended">RefineryLens has suspended {thread.business.name}. You can no longer message it. Do not send money or goods.</Notice>
          ) : (
            <div className="card"><ReplyForm threadId={thread.id} /></div>
          )}
        </section>
        <aside className="card h-fit"><SafetyNote /></aside>
      </div>
    </>
  );
}
