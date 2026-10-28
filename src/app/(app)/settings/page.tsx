import { integrationStatus } from "@/server/integrations";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { PLANS } from "@/lib/plans";
import { CheckoutButton, DeleteAccountForm, PasswordForm, ProfileForm, TextSettingsForm } from "@/components/SettingsForms";
import { proPriceKobo } from "@/server/connect/paystack";
import { PushSettings } from "@/components/native/Push";
import { Notice, PageHeader, Pill } from "@/components/ui";

export const metadata = { title: "Account and plan" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const user = await requireUser();
  const { payment } = await searchParams;
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true, textAlerts: true, priceDigest: true, digestState: true } });
  const status = integrationStatus();
  const org = user.organizationId ? await db.organization.findUnique({ where: { id: user.organizationId }, include: { members: { select: { name: true, role: true } } } }) : null;
  const paymentsEnabled = status.payments.available;
  const textProvider = status.text.provider;
  const textName = { termii: "SMS", africastalking: "SMS", whatsapp: "WhatsApp" } as const;
  return (
    <>
      <PageHeader eyebrow="Account" title="Account and plan" />
      {payment === "success" && <div className="mb-4"><Notice tone="ok" title="Payment received">Your plan is now Pro. A receipt comes from Paystack by email.</Notice></div>}
      {payment === "failed" && <div className="mb-4"><Notice tone="risk" title="Payment not completed">Paystack did not confirm the payment, so nothing was charged to your plan. Try again, or contact your bank if money left your account.</Notice></div>}
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
        <section className="card">
          <h2 className="h-section">Team</h2>
          {org ? (
            <>
              <p className="mt-1 text-sm">{org.name} · {org.plan.toLowerCase()} plan</p>
              <ul className="mt-2 text-sm">{org.members.map((m) => <li key={m.name}>{m.name} <span className="text-xs text-ink-700">({m.role.toLowerCase()})</span></li>)}</ul>
            </>
          ) : <p className="muted mt-1">You are not part of a team. Team plans let research teams share a workspace; theses and private files always stay personal.</p>}
        </section>
      </div>
      <section className="mt-8" aria-labelledby="plans-h">
        <h2 id="plans-h" className="h-section">Subscription</h2>
        {!paymentsEnabled && <div className="mt-2"><Notice tone="warn">Payment collection is disabled because no payment provider is configured. Plans can be assigned by an administrator.</Notice></div>}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.id} className={`card ${user.plan === p.id ? "border-brand-600 ring-1 ring-brand-600" : ""}`}>
              <div className="flex items-center justify-between"><h3 className="font-semibold">{p.name}</h3>{user.plan === p.id && <Pill className="bg-brand-100 text-brand-800">Current plan</Pill>}</div>
              <p className="mt-1 text-sm text-ink-700">{p.tagline}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
              {paymentsEnabled && p.id === "PRO" && user.plan === "FREE" ? (
                <CheckoutButton label={`Upgrade for ₦${(proPriceKobo() / 100).toLocaleString("en-GB")} a month`} />
              ) : (
                <button className="btn-secondary mt-4 w-full" disabled title={paymentsEnabled ? undefined : "Payments are not configured"}>{user.plan === p.id ? "Your plan" : paymentsEnabled ? "Contact us for this plan" : "Payments not yet available"}</button>
              )}
            </div>
          ))}
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
