import Link from "next/link";
import { LegalPage, SupportContact } from "@/components/legal/LegalPage";

export const metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="27 October 2026">
      <p>RefineryLens helps businesses in Nigeria buy, sell and deliver fuel and gas, and publishes independent research. This policy explains what we collect in the RefineryLens website and the Android and iPhone apps, why, who else receives it, and how to delete it. We follow the Nigeria Data Protection Act 2023.</p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Your account:</b> name, email address and a scrambled (hashed) password. We never store your password itself.</li>
        <li><b>Your business, if you set one up:</b> business name, roles, state and town, website, description, CAC registration number and licences you list. Your registration number is seen only by RefineryLens administrators who check it.</li>
        <li><b>What you post:</b> listings, gas sites, delivery jobs and quotes, supply agreements and deliveries, and reports. Prices you report are published only as medians across at least three sellers, never on their own.</li>
        <li><b>Station and gas shop reports:</b> prices you paid, whether a place was selling and its queue, and problems such as short measure, with any note you add. They are published without your name; prices appear on their own at the station and in state medians across at least three people. Places you add are listed publicly. If you flag a report or a place, administrators see your reason, note and account so they can act on misuse; flags are never published.</li>
        <li><b>Gas orders:</b> your delivery address, area, phone number, cylinder size and any note. Only the seller you order from sees them, so their rider can reach you. Your rating of a delivery counts towards the seller&apos;s public average.</li>
        <li><b>Location, from drivers only:</b> if a business sends you a driver link and you tap &quot;Start sharing&quot;, your phone&apos;s precise position, speed and direction are sent every few seconds while that page is open, and shown to the customer or business receiving the delivery and to the business that sent the link. Sharing stops when you tap Stop, close the page, or the delivery ends. RefineryLens never collects anyone else&apos;s location and never tracks in the background.</li>
        <li><b>Cooking gas tracker:</b> your cylinders, refill dates and what you paid, visible to you alone. Your state, if you choose one, so we show its prices first.</li>
        <li><b>Messages</b> between your business and others. Only the two businesses in a conversation can read it; RefineryLens staff cannot.</li>
        <li><b>Research you keep:</b> files you upload privately, theses, watchlists and questions to the research assistant. Private files and theses are visible to you alone.</li>
        <li><b>Optional contact details:</b> a phone number, if you turn on SMS or WhatsApp alerts, and a notification token for each phone where you turn on app notifications.</li>
        <li><b>Payments:</b> a payment reference, amount and status. Card details go directly to Paystack; RefineryLens never receives them.</li>
        <li><b>Security records:</b> a log of important actions (for example publishing, verifying or suspending), and temporary counts of sign-in attempts to stop abuse.</li>
      </ul>
      <p>We do not use advertising, we do not sell personal data, we do not use third-party tracking or analytics tools, and the apps do not access your location, contacts, camera or microphone.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>To run your account and the trade hub: showing your listings, carrying messages, matching buyers, sellers and delivery partners, and keeping delivery records both sides confirmed.</li>
        <li>To verify businesses and keep the hub safe, including handling reports and suspending businesses that break the rules.</li>
        <li>To publish today&apos;s prices and station reports, pass your gas order to the seller you chose, and remind you before your gas runs out.</li>
        <li>To send the alerts you asked for, in the app, by email, SMS, WhatsApp or phone notification.</li>
        <li>To take payment for plans you buy on the website.</li>
      </ul>

      <h2>Who else receives data</h2>
      <p>Only when the related feature is switched on in this installation, and only what that service needs:</p>
      <ul>
        <li><b>Paystack</b> (payments): your email and the amount.</li>
        <li><b>Termii, Africa&apos;s Talking or Meta WhatsApp</b> (text alerts): your phone number and the alert text.</li>
        <li><b>Google Firebase Cloud Messaging and Apple Push Notification service</b> (phone notifications): your phone&apos;s notification token and the alert title and text.</li>
        <li><b>Dojah</b> (company registry check): your CAC registration number, when you ask for verification.</li>
        <li><b>OpenStreetMap Nominatim</b> (map positions of gas sites and delivery drop-offs): a town, area and state, never your name or exact address.</li>
        <li><b>Map tile provider</b> (OpenStreetMap or the provider we configure): when you view a live map, your browser downloads map images for the area shown, as with any online map.</li>
        <li><b>Anthropic</b> (research assistant): your question and the research passages used to answer it, if the assistant&apos;s language model is switched on.</li>
        <li>Our email provider and file storage provider, to send email and keep uploaded files.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>We keep your data while your account is open. Listings expire and drop off the hub; closed listings stay visible to you. When you delete your account, your data is deleted straight away, including gas orders and your gas tracker, except driver positions, which are deleted 7 days after each delivery ends, and security log entries and station reports, which are kept without your name, and payment records Paystack keeps under its own rules.</p>

      <h2>Your rights and choices</h2>
      <ul>
        <li>See and correct your details under Account and on your business profile.</li>
        <li>Turn email, text and phone notifications on or off at any time.</li>
        <li><b>Delete your account</b> in the app or on the website under Account, then &quot;Delete my account&quot;. See <Link href="/delete-account">how to delete your account</Link>.</li>
        <li>Ask for a copy of your data, or complain about how we handle it: <SupportContact />. You can also complain to the Nigeria Data Protection Commission.</li>
      </ul>

      <h2>Security</h2>
      <p>Connections are encrypted (HTTPS). Passwords are hashed, sessions expire, private files are stored outside the public website, and staff access is limited by role. The apps do not keep your messages, inbox or settings on the phone for offline use, and signing out clears pages stored on the phone.</p>

      <h2>Children</h2>
      <p>RefineryLens is a business service for people aged 18 and over.</p>

      <h2>Changes</h2>
      <p>We will update this page when what we collect changes, and change the date at the top.</p>
    </LegalPage>
  );
}
