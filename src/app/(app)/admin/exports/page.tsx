import { Download } from "lucide-react";
import { requireRole } from "@/server/auth";
import { EXPORTS } from "@/server/admin/exports";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Exports · Administration" };

export default async function AdminExports() {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader eyebrow="System" title="Exports" subtitle="Download data as CSV for spreadsheets, reporting and price index work. Each download is recorded in the audit log." />
      <ul className="grid gap-3 md:grid-cols-2">
        {Object.entries(EXPORTS).map(([id, e]) => (
          <li key={id} className="card flex flex-col justify-between gap-3">
            <div><p className="font-semibold text-ink-950">{e.label}</p><p className="mt-1 text-sm text-ink-600">{e.about}</p></div>
            {/* A plain link: the download is a file, not a page. */}
            <a href={`/api/admin/exports/${id}`} className="btn-secondary btn-sm w-fit no-underline" download><Download size={14} aria-hidden /> Download CSV</a>
          </li>
        ))}
      </ul>
      <div className="mt-6"><Notice tone="warn" title="Handle with care">Exports with emails are personal data under the Nigeria Data Protection Act. Keep them on encrypted storage, share them only with people who need them, and delete them when done.</Notice></div>
    </>
  );
}
