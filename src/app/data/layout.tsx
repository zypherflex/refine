import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Public pages for RefineryLens Data, the price index sold to companies in and outside Nigeria. */
export default function DataLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-ink-100 bg-white">
        <div aria-hidden className="band-brand h-1 w-full" />
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4 sm:px-8">
          <Link href="/" className="no-underline hover:no-underline"><Logo size={26} /></Link>
          <span className="rounded-full bg-navy-100 px-2 py-0.5 text-xs font-semibold text-navy-800">Data</span>
          <nav className="ml-auto flex items-center gap-2 text-sm">
            <Link href="/data" className="btn-ghost btn-sm no-underline">Overview</Link>
            <Link href="/data/docs" className="btn-ghost btn-sm no-underline">API docs</Link>
            <Link href="/account/data" className="btn-primary btn-sm no-underline">Start free trial</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">{children}</main>
      <footer className="border-t border-ink-100">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-ink-600 sm:px-8">RefineryLens Data is compiled from prices members of the public and sellers report; it is not an assessment of physical cargoes. Not affiliated with any company covered. <Link href="/privacy">Privacy</Link></p>
      </footer>
    </div>
  );
}
