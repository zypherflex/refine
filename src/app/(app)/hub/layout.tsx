import { requireUser } from "@/server/auth";
import { hubT } from "@/server/hub/lang";
import { LANGS, langLabel } from "@/lib/i18n/hub";
import { setLangAction } from "@/app/actions/hub";
import { HubTabs } from "@/components/hub/HubTabs";

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { lang, t } = await hubT();
  const tabs = [
    { href: "/hub", label: t("tab.overview") },
    { href: "/hub/directory", label: t("tab.directory") },
    { href: "/hub/listings", label: t("tab.listings") },
    { href: "/hub/prices", label: t("tab.prices") },
    { href: "/hub/gas-map", label: t("tab.gasMap") },
    { href: "/hub/jobs", label: t("tab.jobs") },
    { href: "/hub/supply", label: t("tab.supply") },
    { href: "/hub/alerts", label: t("tab.alerts") },
    { href: "/hub/my", label: t("tab.my") },
    { href: "/hub/finance", label: t("tab.finance") },
    { href: "/hub/cylinders", label: t("tab.cylinders") },
    ...(user.fieldAgent ? [{ href: "/hub/field", label: t("tab.field") }] : []),
    ...(user.financePartnerId ? [{ href: "/hub/lender", label: t("tab.lender") }] : []),
  ];
  return (
    <>
      <form key={lang} action={setLangAction} className="mb-2 flex items-center justify-end gap-2">
        <label htmlFor="hub-lang" className="text-xs text-ink-600">{t("lang.choose")}</label>
        <select id="hub-lang" name="lang" defaultValue={lang} className="input w-auto py-1 text-xs">{LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
        <button className="btn-secondary btn-sm">OK</button>
      </form>
      <div className="mb-6 border-b border-ink-100">
        <HubTabs tabs={tabs} />
      </div>
      {lang !== "en" && <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-700" role="note">{t("lang.note", { lang: langLabel(lang) })}</p>}
      {children}
    </>
  );
}
