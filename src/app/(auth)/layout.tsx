import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1fr_1.05fr]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-800 via-[#9b2fd6] to-sun-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="band-ng absolute inset-x-0 top-0 h-[3px]" />
        <Link href="/" className="relative no-underline hover:no-underline"><Logo light /></Link>
        <blockquote className="relative max-w-md">
          <p className="font-serif text-3xl font-semibold leading-snug tracking-tight">“Show me what changed, what supports it, and what we still don’t know.”</p>
          <p className="mt-4 text-sm text-white/80">The standard every RefineryLens page is built to.</p>
        </blockquote>
        <p className="relative text-xs text-white/70">Independent research. Not affiliated with any company we cover. Not investment advice.</p>
      </aside>
      <div className="flex flex-col px-4 py-10 sm:px-8">
        <Link href="/" className="no-underline hover:no-underline lg:hidden"><Logo /></Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="mx-auto max-w-sm text-center text-xs text-ink-500 lg:hidden">RefineryLens is independent and does not provide investment advice.</p>
      </div>
    </div>
  );
}
