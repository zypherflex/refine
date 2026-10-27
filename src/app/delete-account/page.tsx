import Link from "next/link";
import { LegalPage, SupportContact } from "@/components/legal/LegalPage";

export const metadata = { title: "Delete your account" };

/** Linked from the Google Play listing, which requires a web page explaining account deletion. */
export default function DeleteAccountInfoPage() {
  return (
    <LegalPage title="Delete your RefineryLens account">
      <p>You can delete your account yourself at any time, in the app or on the website.</p>
      <h2>Steps</h2>
      <ul>
        <li>Sign in to the RefineryLens app or website.</li>
        <li>Open <b>Account &amp; plan</b> (in the menu, under the account section).</li>
        <li>Under <b>Privacy and your data</b>, choose <b>Delete my account</b>, enter your password and type DELETE.</li>
      </ul>
      <p>If you cannot sign in, <SupportContact /> from the email address on your account and we will delete it for you.</p>
      <h2>What is deleted</h2>
      <p>Your account, private files, theses, alerts, your trade hub business with its listings, gas sites, price reports, delivery jobs, quotes, supply agreements and messages, and the phones registered for notifications. Deletion happens straight away and cannot be undone.</p>
      <h2>What is kept</h2>
      <p>Security log entries, without your name, and payment records that Paystack keeps under its own rules. Public research documents stay in the library without your name.</p>
      <p><Link href="/privacy">Read the privacy policy</Link></p>
    </LegalPage>
  );
}
