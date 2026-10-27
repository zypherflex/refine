import Link from "next/link";
import { requireUser } from "@/server/auth";
import { getAlertSettings, ALERT_HOUR_WAT, composeAlert, watDay } from "@/server/hub/alerts";
import { priceBoard } from "@/server/hub/prices";
import { channelAvailable } from "@/server/messaging";
import { integrationStatus } from "@/server/integrations";
import { myBusiness } from "@/server/hub/business";
import { hubT } from "@/server/hub/lang";
import { LANGS } from "@/lib/i18n/hub";
import { PRICED_PRODUCTS, STATES_BY_NAME } from "@/lib/hub/catalog";
import { confirmPhoneAction, saveAlertsAction, sendPhoneCodeAction } from "@/app/actions/hub";
import { Notice, PageHeader, Pill, SectionHeader } from "@/components/ui";
import { HubForm } from "@/components/hub/HubForm";

export const metadata = { title: "Price alerts" };

export default async function AlertsPage() {
  const user = await requireUser();
  const { t, lang } = await hubT();
  const [sub, me, board] = await Promise.all([getAlertSettings(user), myBusiness(user), priceBoard()]);
  const sms = channelAvailable("SMS");
  const whatsapp = channelAvailable("WHATSAPP");
  const email = integrationStatus().email.available;
  const states = sub?.states ?? [me?.state ?? "LA"];
  const preview = composeAlert(board, { states, products: sub?.products ?? [], language: sub?.language ?? lang }, watDay(new Date()), "…/hub/prices");

  return (
    <>
      <PageHeader eyebrow={t("hub.eyebrow")} title={t("alerts.title")} subtitle={t("alerts.subtitle")} />
      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <section aria-labelledby="settings-h">
          <SectionHeader id="settings-h" title="What to send" />
          <HubForm action={saveAlertsAction} submit={t("alerts.save")} className="card space-y-4">
            <fieldset>
              <legend className="label">States (up to five)</legend>
              <div className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-ink-100 p-2 sm:grid-cols-3">
                {STATES_BY_NAME.map((s) => <label key={s.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="states" value={s.id} defaultChecked={states.includes(s.id)} />{s.name}</label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">Products</legend>
              <div className="flex flex-wrap gap-2">{PRICED_PRODUCTS.map((p) => <label key={p.id} className="flex items-center gap-1.5 rounded-full border border-ink-200 px-3 py-1 text-sm"><input type="checkbox" name="products" value={p.id} defaultChecked={sub ? sub.products.includes(p.id) : ["LPG", "DIESEL", "PETROL"].includes(p.id)} />{p.label}</label>)}</div>
            </fieldset>
            <fieldset>
              <legend className="label">How</legend>
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2"><input type="checkbox" checked disabled aria-label="In the app" /> In the app, under Watchlist and alerts <Pill className="bg-brand-50 text-brand-800">Always on</Pill></li>
                <li className="flex items-center gap-2"><input type="checkbox" disabled checked={email} aria-label="Email" /> Email {email ? <span className="text-xs text-ink-600">(turn on email copies under <Link href="/watchlist">Watchlist and alerts</Link>)</span> : <Pill className="bg-ink-100 text-ink-700">Not switched on yet</Pill>}</li>
                <li className="flex items-center gap-2"><input type="checkbox" name="channels" value="SMS" disabled={!sms} defaultChecked={sub?.channels.includes("SMS")} id="ch-sms" /><label htmlFor="ch-sms">SMS</label>{!sms && <Pill className="bg-ink-100 text-ink-700">Not switched on yet</Pill>}</li>
                <li className="flex items-center gap-2"><input type="checkbox" name="channels" value="WHATSAPP" disabled={!whatsapp} defaultChecked={sub?.channels.includes("WHATSAPP")} id="ch-wa" /><label htmlFor="ch-wa">WhatsApp</label>{!whatsapp && <Pill className="bg-ink-100 text-ink-700">Not switched on yet</Pill>}</li>
              </ul>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="language" className="label">{t("lang.choose")}</label>
                <select id="language" name="language" className="input" defaultValue={sub?.language ?? lang}>{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
              </div>
              <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={sub?.active ?? true} /> Send alerts</label>
            </div>
          </HubForm>

          {(sms || whatsapp) && sub && (
            <section aria-labelledby="phone-h" className="mt-6 card space-y-3">
              <h2 id="phone-h" className="h-section">Phone for text alerts {sub.phoneConfirmedAt ? <Pill className="ml-1 bg-brand-50 text-brand-800">Confirmed {sub.phone}</Pill> : null}</h2>
              <p className="text-sm text-ink-700">We text only numbers their owner has confirmed. Reply STOP to your provider at any time, or untick SMS and WhatsApp above.</p>
              <HubForm action={sendPhoneCodeAction} submit="Send code" className="flex flex-wrap items-end gap-2" buttonClass="btn-secondary btn-sm">
                <div><label htmlFor="phone" className="label">Mobile number</label><input id="phone" name="phone" className="input" defaultValue={sub.phone} placeholder="0803 123 4567" /></div>
              </HubForm>
              {sub.phoneCodeHash && (
                <HubForm action={confirmPhoneAction} submit="Confirm number" className="flex flex-wrap items-end gap-2">
                  <div><label htmlFor="code" className="label">6-digit code</label><input id="code" name="code" className="input num" inputMode="numeric" maxLength={6} /></div>
                </HubForm>
              )}
            </section>
          )}
        </section>

        <aside className="space-y-4">
          <section aria-labelledby="preview-h" className="card">
            <h2 id="preview-h" className="h-section">Today&apos;s message</h2>
            <p className="mt-1 text-xs text-ink-600">Sent once a day after {ALERT_HOUR_WAT}am WAT{sub?.lastSentOn ? `; last sent ${sub.lastSentOn.toISOString().slice(0, 10)}` : ""}.</p>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-ink-50 p-3 font-mono text-xs leading-relaxed text-ink-900">{preview}</pre>
          </section>
          <Notice title="Same rules as the price board">Alerts carry only published medians across at least three sellers, never one seller&apos;s price. They are not offers or advice.</Notice>
          {!sms && !whatsapp && <Notice title="Text alerts are coming">SMS and WhatsApp switch on once the RefineryLens team connects a messaging provider. Until then alerts arrive in the app, and by email where it is switched on.</Notice>}
        </aside>
      </div>
    </>
  );
}
