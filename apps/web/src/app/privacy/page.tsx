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
      <p>For the tax guide, calculators and calendar we do <strong>not</strong> ask for or store your TIN. Calculator inputs are processed in your browser and are not sent to us. The document preparation service below is the only exception, and only with your consent.</p>
      <h2>Why we collect it</h2>
      <p>Only to show the registrations, returns, deadlines and guides that apply to you. We do not sell your data or use it for advertising.</p>
      <h2>Where it is stored</h2>
      <ul>
        <li>Without an account: only in your browser&apos;s local storage on this device.</li>
        <li>With an account: in our database (Supabase), protected so that only you can read or change your records.</li>
      </ul>
      <h2>Document preparation for clients of Neil Priolo, CPA</h2>
      <p>If you are a client of Neil Priolo, CPA&apos;s firm and use TaxGabay to have your returns and supporting documents prepared:</p>
      <ul>
        <li>
          <strong>What we keep:</strong> the business records you enter (sales, purchases, expenses, Form 2307s received, payroll), the receipts and documents you upload, the periods you submit, and the documents we prepare from them.
        </li>
        <li>
          <strong>TINs:</strong> your TIN, and the TINs of your suppliers, customers and employees that must appear on returns, Form 2307 and Form 2316, are stored only after you give separate TIN consent. They are encrypted in our database; screens show only the last four digits. Withdrawing TIN consent deletes the stored TINs.
        </li>
        <li>
          <strong>Who can see it:</strong> you (and other users you link to your business) and Neil Priolo, CPA and the firm's staff who prepare and review your documents. Nobody else. Prepared documents become visible to you once the firm has reviewed and released them.
        </li>
        <li>
          <strong>What we do not do:</strong> TaxGabay prepares documents; it never files returns or pays taxes for you and never asks for your eBIRForms or eFPS password.
        </li>
        <li>
          <strong>How long:</strong> we keep records and prepared documents while you are a client, and afterwards for as long as the law requires books and supporting documents to be kept (period to be confirmed by Neil Priolo, CPA). You may ask for a copy or for deletion at any time, subject to that legal retention period.
        </li>
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
