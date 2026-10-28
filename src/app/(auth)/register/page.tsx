import Link from "next/link";
import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <p className="eyebrow">Get started</p>
      <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Create your account</h1>
      <p className="muted mb-8 mt-2">Free plan. No payment details needed.</p>
      <RegisterForm />
      <p className="mt-6 text-sm text-navy-600">Already registered? <Link href="/login">Sign in</Link></p>
    </>
  );
}
