"use client";
import { useActionState, useEffect, useState } from "react";
import { Copy, MapPin, MessageCircle } from "lucide-react";
import { createDriverLinkAction } from "@/app/actions/tracking";
import { FieldError } from "../ui";

/**
 * Creates the driver's private tracking link and offers to send it by WhatsApp or SMS. The link is shown once; making
 * a new one cancels the old link.
 */
export function DriverLinkForm({ kind, id, hasLink, compact = false }: { kind: "GAS_ORDER" | "DELIVERY_JOB"; id: string; hasLink: boolean; compact?: boolean }) {
  const [state, action, pending] = useActionState(createDriverLinkAction, {});
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = state.path ? `${origin}${state.path}` : "";
  const text = `RefineryLens delivery: open this link and tap "Start sharing" so the customer can follow you. ${url}`;
  return (
    <details className="rounded-xl border border-ink-100 bg-white" open={!compact || !!state.path}>
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium"><MapPin size={15} aria-hidden className="text-brand-700" />{hasLink ? "Driver link (send a new one)" : "Track the driver live"}</summary>
      <div className="space-y-3 border-t border-ink-100 p-3">
        {url ? (
          <>
            <p className="text-sm text-ink-700">Send this link to the driver. It works in any phone browser, no account needed. Only send it to your driver: anyone with it can share a location for this delivery.</p>
            <input readOnly value={url} aria-label="Driver link" className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap gap-2">
              <a className="btn-primary btn-sm no-underline" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} aria-hidden /> Send by WhatsApp</a>
              <a className="btn-secondary btn-sm no-underline" href={`sms:?&body=${encodeURIComponent(text)}`}>Send by SMS</a>
              <button type="button" className="btn-ghost btn-sm" onClick={async () => { await navigator.clipboard?.writeText(url).catch(() => undefined); setCopied(true); }}><Copy size={14} aria-hidden /> {copied ? "Copied" : "Copy"}</button>
            </div>
          </>
        ) : (
          <form action={action} className="space-y-3">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div><label className="label" htmlFor={`dn-${id}`}>Driver&apos;s name</label><input id={`dn-${id}`} name="driverName" required minLength={2} className="input" /></div>
              <div><label className="label" htmlFor={`dp-${id}`}>Driver&apos;s phone (shown to the customer)</label><input id={`dp-${id}`} name="driverPhone" type="tel" className="input" placeholder="optional" /></div>
            </div>
            {hasLink && <p className="text-xs text-ink-600">A new link stops the old one from working.</p>}
            <FieldError message={state.error} />
            <button className="btn-primary btn-sm" disabled={pending}>{pending ? "Creating…" : "Create driver link"}</button>
          </form>
        )}
      </div>
    </details>
  );
}
