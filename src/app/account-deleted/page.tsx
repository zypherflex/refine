import Link from "next/link";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = { title: "Account deleted" };

export default function AccountDeletedPage() {
  return (
    <LegalPage title="Your account has been deleted">
      <p>Your account and the data linked to it have been deleted. Thank you for using RefineryLens.</p>
      <p><Link href="/" className="btn-primary no-underline">Back to the home page</Link></p>
    </LegalPage>
  );
}
