import { integrationStatus } from "@/server/integrations";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { PLANS } from "@/lib/plans";
import { CheckoutButton, DeleteAccountForm, PasswordForm, ProfileForm, TextSettingsForm } from "@/components/SettingsForms";
import { checkoutAvailable } from "@/server/data/billing";
import { isPlus, plusPrice } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { PushSettings } from "@/components/native/Push";
import { Notice, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Account and plan" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const user = await requireUser();
  const { payment } = await searchParams;
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, textAlerts: true, priceDigest: true, digestState: true, plan: true, planUntil: true } });
  const status = integrationStatus();
  const paymentsEnabled = status.payments.available;
  const usdEnabled = checkoutAvailable("USD");
  const plus = isPlus(me);
  const price = plusPrice();
  const textProvider = status.text.provider;
  const textName = { termii: "SMS", africastalking: "SMS", whatsapp: "WhatsApp" } as const;
  return (
    <>
      <PageHeader eyebrow="Account" title="Account and plan" />
      {payment === "success" && <div className="mb-4"><Notice tone="ok" title="Payment received">You are on RefineryLens Plus. A receipt comes by email.</Notice></div>}
      {payment === "failed" && <div className="mb-4"><Notice tone="risk" title="Payment not completed">The payment was not confirmed, so your plan has not changed. Try again, or contact your bank if money left your account.</Notice></div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4">
          <h2 className="h-section">Profile</h2>
          <p className="text-sm">Signed in as <strong>{user.email}</strong> · role: {user.role.toLowerCase()}</p>
          <ProfileForm name={user.name} />
          <h3 className="pt-2 font-semibold">Password</h3>
          <PasswordForm />
        </section>
        <PushSettings />
        <section className="card space-y-3" aria-labelledby="texts-h">
          <h2 id="texts-h" className="h-section">Text alerts{textProvider ? ` by ${textName[textProvider]}` : ""}</h2>
          {!textProvider && <Notice tone="warn">Text messages are not configured in this installation. You can save your number now; alerts stay in-app and email until a provider is set up.</Notice>}
          <TextSettingsForm phone={me.phone ?? ""} textAlerts={me.textAlerts} priceDigest={me.priceDigest} digestState={me.digestState ?? ""} provider={textProvider} />
        </section>
      </div>
      <section className="mt-8" aria-labelledby="plans-h">
        <h2 id="plans-h" className="h-section">Your plan</h2>
        {!paymentsEnabled && !usdEnabled && <div className="mt-2"><Notice tone="warn">Payment collection is disabled because no payment provider is configured. Plans can be assigned by an administrator.</Notice></div>}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {PLANS.map((p) => {
            const current = p.id === "PRO" ? plus : !plus;
            return (
              <div key={p.id} className={`card ${current ? "border-brand-600 ring-1 ring-brand-600" : ""}`}>
                <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3>{current && <Pill className="bg-brand-100 text-brand-800">Current plan</Pill>}</div>
                <p className="mt-1 text-sm text-ink-700">{p.tagline}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                {p.id === "PRO" && (
                  <>
                    <p className="mt-3 text-sm"><span className="num text-lg font-semibold text-ink-950">₦{(price.ngnKobo / 100).toLocaleString("en-GB")}</span> or <span className="num font-semibold text-ink-950">${(price.usdCents / 100).toFixed(2)}</span> for 30 days{plus && me.planUntil ? ` · yours runs until ${fmtDate(me.planUntil)}` : ""}</p>
                    {paymentsEnabled && <CheckoutButton label={plus ? "Add 30 days in naira" : `Get Plus for ₦${(price.ngnKobo / 100).toLocaleString("en-GB")}`} />}
                    {usdEnabled && <CheckoutButton currency="USD" secondary label={`Pay $${(price.usdCents / 100).toFixed(2)} from abroad`} />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="mt-8 space-y-3" aria-labelledby="privacy-h">
        <h2 id="privacy-h" className="h-section">Privacy and your data</h2>
        <p className="muted">Read the <a href="/privacy">privacy policy</a>. You can delete your account at any time.</p>
        <DeleteAccountForm />
      </section>
    </>
  );
}
