/** Frequently asked questions. Pure data (safe for client bundles). Pending CPA verification. */

export interface FaqLink {
  label: string;
  href: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  see?: FaqLink[];
}

export const faqs: FaqItem[] = [
  { id: "register-small-income", category: "Registration", question: "Do I need to register with the BIR if my income is small?", answer: "Yes. If you have a business or profession, you register regardless of how much you earn. The ₱250,000 income tax exemption affects how much tax you owe, not whether you register and file.", see: [{ label: "Registration roadmap", href: "/roadmap" }] },
  { id: "registration-fee", category: "Registration", question: "Do I still pay the ₱500 annual registration fee?", answer: "No. The Ease of Paying Taxes Act abolished the annual registration fee." },
  { id: "which-form-register", category: "Registration", question: "Which BIR registration form do I use?", answer: "Individuals with business or professional income (sole proprietors, freelancers, professionals, mixed-income earners) use Form 1901. Corporations, partnerships, OPCs and cooperatives use Form 1903." },
  { id: "zero-sales", category: "Filing", question: "Do I file if I had no sales this quarter?", answer: "Yes. File every return listed on your Certificate of Registration on time, even with zero sales. Late filing carries penalties even when no tax is due.", see: [{ label: "Tax calendar", href: "/calendar" }] },
  { id: "weekend-deadline", category: "Filing", question: "What if a deadline falls on a weekend or holiday?", answer: "You can file on the next working day. The TaxGabay calendar moves the dates for you." },
  { id: "1701-vs-1701a", category: "Filing", question: "Should I file Form 1701 or 1701A?", answer: "Use 1701A if you earn purely from business or profession and use the 8% option or the optional standard deduction (OSD). Use 1701 if you have mixed income or use itemized deductions.", see: [{ label: "1701A guide", href: "/guides/1701a" }, { label: "1701 guide", href: "/guides/1701" }] },
  { id: "8pct-when", category: "Income tax", question: "When do I choose the 8% option?", answer: "In your first quarterly income tax return of the year (Form 1701Q, due 15 May) or at registration. The choice is irrevocable for that year.", see: [{ label: "Income tax calculator", href: "/calculators/income-tax" }] },
  { id: "8pct-percentage-tax", category: "Income tax", question: "If I choose 8%, do I still pay percentage tax?", answer: "No. The 8% income tax is in lieu of percentage tax, so you do not file Form 2551Q." },
  { id: "employee-file", category: "Income tax", question: "I'm an employee. Do I need to file an income tax return?", answer: "Usually not, if you had one employer for the whole year and your tax was correctly withheld — you qualify for substituted filing and your Form 2316 serves as your return. Ask your employer for your 2316 each year." },
  { id: "vat-threshold", category: "VAT and percentage tax", question: "When must I register for VAT?", answer: "When your gross sales or receipts for the year exceed ₱3,000,000. Below that, you pay percentage tax unless you register for VAT voluntarily.", see: [{ label: "VAT or percentage tax", href: "/learn/vat-vs-percentage-tax" }] },
  { id: "form-2307", category: "Withholding", question: "What is Form 2307 and why do I need it?", answer: "It is the certificate a client gives you when they withhold tax from your payment. Attach it to your income tax return to credit the tax already withheld, so you don't pay it twice.", see: [{ label: "Withholding tax explained", href: "/learn/withholding-tax-explained" }] },
  { id: "late-penalty", category: "Penalties", question: "What happens if I file or pay late?", answer: "You pay a surcharge, interest for each day late, and usually a compromise penalty. Micro and small taxpayers get lower surcharge and interest rates under the Ease of Paying Taxes Act.", see: [{ label: "Penalty calculator", href: "/calculators/penalty" }] },
  { id: "tin-stored", category: "Using TaxGabay", question: "Does TaxGabay file my returns or ask for my TIN?", answer: "No. TaxGabay explains and computes; you file on eBIRForms, eFPS or ORUS. It never asks for your TIN." },
];
