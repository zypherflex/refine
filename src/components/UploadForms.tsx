"use client";
import { useActionState, useRef } from "react";
import { uploadPrivateAction, uploadPublicAction } from "@/app/actions/documents";
import { FieldError } from "./ui";

export function PrivateUploadForm({ companies, maxMb }: { companies: { id: string; name: string }[]; maxMb: number }) {
  const [state, action, pending] = useActionState(uploadPrivateAction, {});
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="pfile" className="label">File</label>
        <input id="pfile" name="file" type="file" accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv" required className="block w-full text-sm" aria-describedby="pfile-hint" />
        <p id="pfile-hint" className="hint">PDF, TXT or CSV, up to {maxMb} MB.</p>
      </div>
      <div>
        <label htmlFor="ptitle" className="label">Title</label>
        <input id="ptitle" name="title" className="input" placeholder="Optional" />
      </div>
      <div>
        <label htmlFor="pcompany" className="label">Related company</label>
        <select id="pcompany" name="companyId" className="input"><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="sm:col-span-3">
        <FieldError message={state.error} />
        {state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
        <button className="btn-primary mt-1" disabled={pending}>{pending ? "Uploading…" : "Upload privately"}</button>
      </div>
    </form>
  );
}

export function PublicUploadForm({ companies, sources, docTypes, provenances, topics }: { companies: { id: string; name: string }[]; sources: { id: string; name: string; approved: boolean }[]; docTypes: [string, string][]; provenances: [string, string][]; topics: [string, string][] }) {
  const [state, action, pending] = useActionState(uploadPublicAction, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor="file" className="label">File</label><input id="file" name="file" type="file" accept=".pdf,.txt,.csv" required className="block w-full text-sm" /></div>
      <div><label htmlFor="title" className="label">Title</label><input id="title" name="title" className="input" required /></div>
      <div><label htmlFor="companyId" className="label">Company</label><select id="companyId" name="companyId" className="input">{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label htmlFor="sourceId" className="label">Source</label><select id="sourceId" name="sourceId" className="input"><option value="">None</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}{s.approved ? "" : " (not approved)"}</option>)}</select></div>
      <div><label htmlFor="documentType" className="label">Document type</label><select id="documentType" name="documentType" className="input">{docTypes.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label htmlFor="provenance" className="label">Provenance</label><select id="provenance" name="provenance" className="input">{provenances.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label htmlFor="publisher" className="label">Publisher</label><input id="publisher" name="publisher" className="input" /></div>
      <div><label htmlFor="url" className="label">Original URL</label><input id="url" name="url" type="url" className="input" /></div>
      <div><label htmlFor="publishedAt" className="label">Publication date</label><input id="publishedAt" name="publishedAt" type="date" className="input" /></div>
      <fieldset className="sm:col-span-2"><legend className="label">Topics</legend><div className="flex flex-wrap gap-2">{topics.map(([k, v]) => <label key={k} className="text-xs"><input type="checkbox" name="topics" value={k} className="mr-1" />{v}</label>)}</div></fieldset>
      <div className="sm:col-span-2">
        <p className="hint mb-2">Respect source permissions and licences. Do not upload paywalled material you are not licensed to redistribute.</p>
        <FieldError message={state.error} />
        {state.ok && <p className="text-sm text-brand-800" role="status">{state.ok}</p>}
        <button className="btn-primary mt-1" disabled={pending}>{pending ? "Uploading…" : "Upload to library"}</button>
      </div>
    </form>
  );
}
