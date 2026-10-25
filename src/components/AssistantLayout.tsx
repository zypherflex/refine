import Link from "next/link";
import { fmtDate } from "@/lib/format";

export function ConversationList({ conversations, current }: { conversations: { id: string; title: string; createdAt: Date }[]; current?: string }) {
  return (
    <nav aria-label="Previous conversations" className="card">
      <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Your conversations</h2><Link href="/assistant" className="text-xs">New</Link></div>
      {conversations.length === 0 ? <p className="mt-2 text-xs text-navy-700">None yet. Conversations are private to you.</p> : (
        <ul className="mt-2 space-y-1">
          {conversations.map((c) => (
            <li key={c.id}><Link href={`/assistant/${c.id}`} aria-current={c.id === current ? "page" : undefined} className={`block rounded px-2 py-1 text-sm no-underline ${c.id === current ? "bg-teal-50 font-medium text-teal-800" : "text-navy-900 hover:bg-navy-50"}`}>{c.title}<span className="block text-xs text-navy-700">{fmtDate(c.createdAt)}</span></Link></li>
          ))}
        </ul>
      )}
    </nav>
  );
}
