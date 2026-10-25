"use client";
import { useActionState, useState } from "react";
import { askAction } from "@/app/actions/assistant";
import { FieldError } from "./ui";

const SUGGESTED = [
  "What changed this month?",
  "Explain this report in simple language.",
  "Why can higher fuel prices fail to increase profit?",
  "Which disclosures challenge my saved thesis?",
  "What information is missing from this analysis?",
];

export function AskForm({ companyId, conversationId, documents, initialQuestion, initialDocument }: { companyId: string; conversationId?: string; documents: { id: string; title: string; private: boolean }[]; initialQuestion?: string; initialDocument?: string }) {
  const [state, action, pending] = useActionState(askAction, {});
  const [q, setQ] = useState(initialQuestion ?? "");
  return (
    <form action={action} className="card space-y-3" aria-busy={pending}>
      <input type="hidden" name="companyId" value={companyId} />
      {conversationId && <input type="hidden" name="conversationId" value={conversationId} />}
      <div>
        <label htmlFor="question" className="label">Your question</label>
        <textarea id="question" name="question" value={q} onChange={(e) => setQ(e.target.value)} className="input min-h-20" maxLength={1000} required placeholder="Ask about announcements, reports, metrics, risks or your thesis" />
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
        {SUGGESTED.map((s) => <button type="button" key={s} onClick={() => setQ(s)} className="rounded-full border border-navy-100 bg-white px-2.5 py-1 text-xs hover:border-teal-600">{s}</button>)}
      </div>
      {documents.length > 0 && (
        <div>
          <label htmlFor="documentId" className="label">Focus on a document (optional)</label>
          <select id="documentId" name="documentId" defaultValue={initialDocument ?? ""} className="input">
            <option value="">All available evidence</option>
            {documents.map((d) => <option key={d.id} value={d.id}>{d.title}{d.private ? " (private)" : ""}</option>)}
          </select>
        </div>
      )}
      <FieldError message={state.error} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Retrieving evidence…" : "Ask"}</button>
        <p className="text-xs text-navy-700">Answers cite their sources. Not investment advice.</p>
      </div>
    </form>
  );
}
