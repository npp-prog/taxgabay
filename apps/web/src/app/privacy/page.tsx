import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <article className="prose-guide mx-auto max-w-3xl">
      <PageHeader title="Privacy notice" description="How TaxGabay handles your personal data under the Data Privacy Act of 2012 (RA 10173)." />
      <p>
        <em>Draft for review by the product owner and counsel before launch.</em>
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>Your taxpayer profile answers: taxpayer type, VAT status, income tax option, whether you have employees or withhold tax, filing channel, fiscal year, taxpayer size, and optionally your RDO code and line of business.</li>
        <li>Which deadlines you marked as filed and paid, and which registration steps you completed.</li>
        <li>If you create an account: your email address (and your Google account name and email if you sign in with Google).</li>
      </ul>
      <p>We do <strong>not</strong> ask for or store your TIN. Calculator inputs are processed in your browser and are not sent to us.</p>
      <h2>Why we collect it</h2>
      <p>Only to show the registrations, returns, deadlines and guides that apply to you. We do not sell your data or use it for advertising.</p>
      <h2>Where it is stored</h2>
      <ul>
        <li>Without an account: only in your browser&apos;s local storage on this device.</li>
        <li>With an account: in our database (Supabase), protected so that only you can read or change your records.</li>
      </ul>
      <h2>Your rights</h2>
      <p>
        You may access, correct, download or delete your data at any time from the <a href="/account">Account</a> page. Deleting your account removes your profile and progress permanently.
      </p>
      <h2>Contact</h2>
      <p>TODO(owner): name and contact details of the Data Protection Officer.</p>
    </article>
  );
}
