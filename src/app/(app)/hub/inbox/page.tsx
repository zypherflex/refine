import Link from "next/link";
import { requireUser } from "@/server/auth";
import { listThreads } from "@/server/hub/messages";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Hub inbox" };

export default async function InboxPage() {
  const user = await requireUser();
  const threads = await listThreads(user);
  return (
    <>
      <p className="mb-2 text-sm"><Link href="/hub">← Trade hub</Link></p>
      <PageHeader eyebrow="Trade hub" title="Inbox" subtitle="Conversations with other businesses. Only you and the other business can read them; RefineryLens staff cannot." />
      {threads.length === 0 ? (
        <EmptyState title="No conversations yet" action={<Link href="/hub" className="btn-secondary btn-sm no-underline">Browse the hub</Link>}>Message a business from one of its listings, or wait for enquiries about yours.</EmptyState>
      ) : (
        <ul className="divide-y divide-navy-100 overflow-hidden rounded-xl border border-navy-100 bg-white">
          {threads.map((t) => (
            <li key={t.id} className={t.unread ? "bg-teal-50/50" : ""}>
              <Link href={`/hub/inbox/${t.id}`} className="block px-4 py-3 no-underline hover:bg-navy-50 hover:no-underline">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-navy-950 ${t.unread ? "font-semibold" : "font-medium"}`}>{t.counterpart}</span>
                  <Pill className="bg-navy-50 text-navy-700 ring-1 ring-inset ring-navy-100">{t.side === "starter" ? "You enquired" : "Enquiry to you"}</Pill>
                  {t.unread && <span className="text-xs font-semibold text-teal-800">Unread</span>}
                  <span className="ml-auto text-xs text-navy-500">{fmtDateTime(t.lastMessageAt)}</span>
                </div>
                <p className="mt-0.5 text-sm text-navy-800">{t.subject}</p>
                {t.messages[0] && <p className="mt-0.5 line-clamp-1 text-xs text-navy-600">{t.messages[0].senderId === user.id ? "You: " : ""}{t.messages[0].body}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
