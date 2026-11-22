import Link from "next/link";
import { HomeFootnote, HomeHero } from "@/components/home-hero";

const FEATURES = [
  { href: "/profile", title: "Find out what applies to you", body: "Answer a few questions about your work or business. We list the registrations, returns and taxes that apply." },
  { href: "/calendar", title: "Never miss a deadline", body: "A tax calendar built from your profile, with weekend and holiday roll-over. Export to Google or Apple Calendar." },
  { href: "/checklists", title: "Stay compliant every month", body: "Monthly, quarterly and annual checklists from your profile, with a compliance score." },
  { href: "/calculators", title: "Compute with the legal basis shown", body: "Income tax (8% vs graduated), corporate, VAT, percentage, withholding, estate, donor's, capital gains, DST and penalties — every line explained." },
  { href: "/guides", title: "Step-by-step filing guides", body: "Who files, when, where, what to attach and common mistakes for the most-used BIR forms." },
  { href: "/business-guide", title: "Run your business by the book", body: "Bookkeeping basics, books of accounts, payroll and SSS/PhilHealth/Pag-IBIG, LGU permits and financial statements — in plain language." },
  { href: "/practice", title: "Practice keeping the books", body: "Sample businesses with invoices and receipts to record. Your entries are checked and turned into a ledger, statements and tax returns." },
  { href: "/roadmap", title: "Starting a business?", body: "Registration roadmaps for sole proprietorships (DTI), companies (SEC) and cooperatives (CDA), with progress saved." },
  { href: "/learn", title: "Learn the basics", body: "Plain-language articles, a Taglish-friendly glossary and answers to common questions." },
  { href: "/issuances", title: "BIR issuances, explained", body: "Revenue regulations, memorandum orders and circulars with plain-language summaries and links to the official text." },
  { href: "/life-events", title: "Big life events", body: "Hiring, closing a business, settling an estate, selling or donating property, moving RDO — step by step." },
];

export default function Home() {
  return (
    <div className="space-y-14">
      <HomeHero />
      <section aria-labelledby="what-h">
        <div className="mb-4 flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
          <h2 id="what-h" className="font-display text-xl font-bold tracking-tight">
            What TaxGabay covers
          </h2>
          <span className="form-label">{FEATURES.length} tools</span>
        </div>
        <ul className="grid sm:grid-cols-2 sm:gap-x-10">
          {FEATURES.map((f) => (
            <li key={f.href} className="border-b border-border">
              <Link href={f.href} className="group flex items-start gap-4 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold group-hover:text-primary">{f.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{f.body}</span>
                </span>
                <span className="mt-0.5 font-mono text-sm text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="max-w-[80ch] border-l-2 border-sun pl-4 text-sm leading-relaxed text-muted-foreground">
        <HomeFootnote />
      </p>
    </div>
  );
}
