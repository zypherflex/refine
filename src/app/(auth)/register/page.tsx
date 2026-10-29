import Link from "next/link";
import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; for?: string }> }) {
  const { next, for: audience } = await searchParams;
  return (
    <>
      <p className="eyebrow">Get started</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="muted mb-8 mt-2">Free. No payment details needed.</p>
      <RegisterForm next={next} audience={audience === "business" ? "BUSINESS" : "PERSONAL"} />
      <p className="mt-6 text-sm text-ink-600">Already registered? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}>Sign in</Link></p>
    </>
  );
}
