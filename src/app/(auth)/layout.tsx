import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_100%_0%,rgba(91,130,240,0.14),transparent_60%)]" />
        <div aria-hidden className="bg-meridian pointer-events-none absolute inset-0 opacity-[0.05]" />
        <div aria-hidden className="band-brand absolute inset-x-0 top-0 h-1.5" />
        <Link href="/" className="relative no-underline hover:no-underline"><Logo light /></Link>
        <blockquote className="relative max-w-md">
          <p className="font-serif text-3xl font-semibold leading-snug tracking-tight">Today’s price, a seller you can trust, and gas at the door. At home or from abroad.</p>
          <p className="mt-4 text-sm text-ink-300">RefineryLens, for Nigerians everywhere.</p>
        </blockquote>
        <p className="relative text-xs text-ink-400">Prices are reported by people and sellers and are not checked by RefineryLens.</p>
      </aside>
      <div className="flex flex-col px-4 py-10 sm:px-8">
        <Link href="/" className="no-underline hover:no-underline lg:hidden"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="mx-auto max-w-sm text-center text-xs text-ink-500 lg:hidden">RefineryLens is independent and does not provide investment advice.</p>
      </div>
    </div>
  );
}
