import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { hasPriceData, listApiKeys, MAX_KEYS, METHODOLOGY } from "@/server/hub/priceindex";
import { addThresholdAction, removeThresholdAction, revokeApiKeyAction } from "@/app/actions/hub";
import { listThresholds, MAX_THRESHOLDS } from "@/server/hub/thresholds";
import { PRICED_PRODUCTS, productLabel, stateName, STATES_BY_NAME } from "@/lib/hub/catalog";
import { EmptyState, Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";
import { ApiKeyForm } from "@/components/hub/ApiKeyForm";
import { day, naira } from "@/components/hub/bits";

export const metadata = { title: "Price data and API" };

export default async function DataPage() {
  const user = await requireUser();
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const active = hasPriceData(u);
  const [keys, thresholds] = active ? await Promise.all([listApiKeys(user), listThresholds(user)]) : [[], []];
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return (
    <>
      <PageHeader eyebrow="Price intelligence" title="Price data and API" subtitle="Weekly median history, CSV exports and a JSON API for credit, procurement and research teams. Built from the same rules as the free price board." />
      {active ? (
        <p className="mb-6"><Pill className="bg-brand-50 text-brand-800">Active until {day(u.priceDataUntil!)}</Pill></p>
      ) : (
        <div className="mb-8">
          <Notice title="Price data is not on for your account">
            The board, morning alerts and the last 8 weeks of history stay free. For longer history, exports and the API, <Link href="/plans">register interest</Link> and the RefineryLens team will set it up. Online payment is not switched on yet, so nothing is charged here.
          </Notice>
        </div>
      )}

      {active && (
        <section className="mb-10" aria-labelledby="keys-h">
          <SectionHeader id="keys-h" title="API keys" note={`Up to ${MAX_KEYS} active keys. We store only a fingerprint of each key.`} />
          <div className="card mb-4"><ApiKeyForm /></div>
          {keys.length ? (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                  <span><span className="font-medium">{k.name}</span> · <span className="num">{k.prefix}…</span> · created {day(k.createdAt)}{k.lastUsedAt ? ` · last used ${day(k.lastUsedAt)}` : " · never used"}</span>
                  {k.revokedAt ? <Pill className="bg-ink-100 text-ink-700">Revoked {day(k.revokedAt)}</Pill> : <HubForm action={revokeApiKeyAction} submit="Revoke" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={k.id} /></HubForm>}
                </li>
              ))}
            </ul>
          ) : <EmptyState title="No keys yet" />}
        </section>
      )}

      {active && (
        <section className="mb-10" aria-labelledby="thr-h">
          <SectionHeader id="thr-h" title="Threshold alerts" note={`Up to ${MAX_THRESHOLDS}. Each fires once when the board median crosses your price, and again only after it crosses back.`} />
          {thresholds.length > 0 && (
            <ul className="mb-4 space-y-2">
              {thresholds.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                  <span>{productLabel(t.product)} in {stateName(t.state)} {t.direction === "ABOVE" ? "above" : "below"} <span className="num">{naira(t.priceNgn)}</span>{t.met ? <Pill className="ml-2 bg-ink-800 text-white">Crossed{t.lastFiredAt ? ` ${day(t.lastFiredAt)}` : ""}</Pill> : null}</span>
                  <HubForm action={removeThresholdAction} submit="Remove" buttonClass="btn-secondary btn-sm" inline><input type="hidden" name="id" value={t.id} /></HubForm>
                </li>
              ))}
            </ul>
          )}
          <HubForm action={addThresholdAction} submit="Add alert" className="card grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <div><label htmlFor="t-product" className="label">Product</label><select id="t-product" name="product" className="input">{PRICED_PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
            <div><label htmlFor="t-state" className="label">State</label><select id="t-state" name="state" className="input" defaultValue="LA">{STATES_BY_NAME.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <div><label htmlFor="t-dir" className="label">When the median goes</label><select id="t-dir" name="direction" className="input"><option value="ABOVE">Above</option><option value="BELOW">Below</option></select></div>
            <div><label htmlFor="t-price" className="label">Price (₦)</label><input id="t-price" name="priceNgn" className="input num w-32" inputMode="numeric" required /></div>
          </HubForm>
          <p className="muted mt-2 text-xs">Alerts arrive in the app, and by SMS or WhatsApp if you switched those on and confirmed your number under Price alerts.</p>
        </section>
      )}

      <section aria-labelledby="docs-h" className="card space-y-3 text-sm">
        <h2 id="docs-h" className="h-section">Using the API</h2>
        <p>Send your key in the <code>Authorization</code> header. Limit: 600 requests an hour per key. Responses are JSON in naira.</p>
        <pre className="overflow-x-auto rounded-lg bg-ink-950 p-3 text-xs text-white"><code>{`curl -H "Authorization: Bearer rl_live_…" \\
  "${base}/api/v1/prices/history?product=LPG&state=LA&weeks=52"

curl -H "Authorization: Bearer rl_live_…" "${base}/api/v1/prices/board"`}</code></pre>
        <ul className="list-disc space-y-1 pl-5">
          <li><code>/api/v1/prices/history</code>: <code>product</code> (LPG, DIESEL, PETROL, KEROSENE, CNG), <code>state</code> (two-letter code, or NG for all Nigeria), <code>weeks</code> (1 to 104). Each point has <code>weekEnding</code>, <code>median</code> (null when fewer than three sellers) and <code>sellers</code>.</li>
          <li><code>/api/v1/prices/board</code>: today&apos;s published medians by product and state, with the dates they cover and whether sample data is included.</li>
        </ul>
        <p className="muted text-xs">{METHODOLOGY} Do not use this data to agree or coordinate prices with competitors.</p>
      </section>
    </>
  );
}
