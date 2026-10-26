import Link from "next/link";
import { LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Sign in to RefineryLens</h1>
      <p className="muted mb-8 mt-2">Pick up your research where you left off.</p>
      <LoginForm next={next} />
      <p className="mt-6 text-sm text-ink-600">New here? <Link href="/register">Create a free account</Link></p>
      <details className="mt-6 rounded-xl border border-ink-100 bg-ink-50 p-3 text-xs text-ink-700">
        <summary className="font-medium">Demo accounts</summary>
        <p className="mt-2">Password for all: <code>RefineryLens-demo-2026</code></p>
        <ul className="mt-1 list-disc pl-4">
          <li>investor@refinerylens.test (investor with a saved thesis)</li>
          <li>editor@refinerylens.test (editor)</li>
          <li>analyst@refinerylens.test (analyst)</li>
          <li>admin@refinerylens.test (administrator)</li>
          <li>other@refinerylens.test (second investor, for isolation checks)</li>
        </ul>
      </details>
    </>
  );
}
