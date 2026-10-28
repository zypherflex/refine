import Link from "next/link";
import { Logo } from "../Logo";

/** Plain, readable layout for public policy pages linked from the app stores. */
export function LegalPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div aria-hidden className="band-ng h-1 w-full" />
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-8">
        <Link href="/" className="no-underline hover:no-underline"><Logo /></Link>
        <Link href="/login" className="btn-secondary btn-sm no-underline">Sign in</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-8">
        <h1 className="h-page">{title}</h1>
        {updated && <p className="mt-2 text-sm text-ink-600">Last updated {updated}</p>}
        <div className="legal mt-8 space-y-4 text-[15px] leading-relaxed text-ink-800 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink-950 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">{children}</div>
      </main>
    </div>
  );
}

export function SupportContact() {
  const email = process.env.SUPPORT_EMAIL;
  return email ? (
    <>
      email <a href={`mailto:${email}`}>{email}</a>
    </>
  ) : (
    <>contact RefineryLens through the support address shown in the app store listing</>
  );
}
