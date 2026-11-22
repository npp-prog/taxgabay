/** Taglish-friendly glossary. Pure data (safe for client bundles). Pending CPA verification. */

export interface GlossaryLink {
  label: string;
  href: string;
}

export interface GlossaryTerm {
  term: string;
  /** Filipino/Taglish names and abbreviations. */
  aka?: string[];
  definition: string;
  see?: GlossaryLink[];
}

export const GLOSSARY_NEEDS_VERIFICATION = true;

export function glossarySlug(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const terms: GlossaryTerm[] = [
  { term: "8% option", aka: ["8% income tax rate"], definition: "An income tax option for self-employed individuals and professionals who are not VAT-registered and whose gross sales or receipts do not exceed ₱3,000,000: 8% of gross sales (less ₱250,000 if purely self-employed), in place of graduated income tax and percentage tax.", see: [{ label: "8% or graduated rates", href: "/learn/eight-percent-vs-graduated" }] },
  { term: "Alphalist", aka: ["Alphabetical list"], definition: "A list of employees or payees with the amounts paid and taxes withheld, attached to withholding returns such as 1604C, 1604E and 1601EQ." },
  { term: "ATC", aka: ["Alphanumeric tax code"], definition: "The code that identifies a type of payment and its withholding tax rate, for example the code for rent or professional fees.", see: [{ label: "EWT calculator", href: "/calculators/ewt" }] },
  { term: "BIR", aka: ["Bureau of Internal Revenue", "Kawanihan ng Rentas Internas"], definition: "The national government agency that collects internal revenue taxes such as income tax, VAT, percentage tax and withholding taxes." },
  { term: "Books of accounts", aka: ["Libro", "Books"], definition: "Your registered records of sales, expenses and other transactions, kept manually, loose-leaf or on a computerized system." },
  { term: "Buwis", aka: ["Tax"], definition: "Filipino for tax." },
  { term: "Certificate of Registration (COR)", aka: ["COR", "Form 2303"], definition: "The BIR certificate you receive when you register. It lists your tax types — the taxes and returns you are responsible for — and must be displayed at your place of business.", see: [{ label: "Registration roadmap", href: "/roadmap" }] },
  { term: "CREATE", aka: ["RA 11534", "Corporate Recovery and Tax Incentives for Enterprises Act"], definition: "The 2021 law that lowered corporate income tax rates and temporarily reduced percentage tax to 1% from 1 July 2020 to 30 June 2023." },
  { term: "De minimis benefits", definition: "Small-value benefits given to employees, such as rice subsidy or uniform allowance, that are not taxable within the ceilings set by the BIR.", see: [{ label: "Withholding on compensation", href: "/calculators/withholding-compensation" }] },
  { term: "eBIRForms", definition: "The BIR's free system for preparing and filing tax returns, used by most small taxpayers." },
  { term: "eFPS", aka: ["Electronic Filing and Payment System"], definition: "The BIR's online filing and payment system required for certain taxpayers. eFPS filers of some monthly returns follow staggered deadlines by industry group (A to E)." },
  { term: "EOPT", aka: ["Ease of Paying Taxes Act", "RA 11976"], definition: "The 2024 law that, among others, classified taxpayers by size, reduced penalties for micro and small taxpayers, made the sales invoice the main document for goods and services, and abolished the ₱500 annual registration fee." },
  { term: "Expanded withholding tax (EWT)", aka: ["EWT", "Creditable withholding tax"], definition: "Tax that a payer withholds from certain payments, such as rent, professional fees and payments to contractors. The payee credits it against their own income tax using BIR Form 2307.", see: [{ label: "Withholding tax explained", href: "/learn/withholding-tax-explained" }] },
  { term: "Gross sales or receipts", aka: ["Benta"], definition: "Total sales or fees from your business before expenses, net of returns, allowances and discounts." },
  { term: "Input VAT", definition: "The VAT you paid on your business purchases. VAT-registered taxpayers subtract it from their output VAT, if supported by valid VAT invoices.", see: [{ label: "VAT calculator", href: "/calculators/vat" }] },
  { term: "Invoice", aka: ["Resibo", "Sales invoice"], definition: "The document you issue for each sale. Under the Ease of Paying Taxes Act, the sales invoice is the main document for both goods and services; official receipts (OR) are now supplementary." },
  { term: "Itemized deductions", definition: "Your actual business expenses, supported by receipts and books, deducted from gross income under graduated rates." },
  { term: "MCIT", aka: ["Minimum corporate income tax"], definition: "A minimum tax on a corporation's gross income, payable when it is higher than the regular corporate income tax, starting the fourth taxable year after operations began.", see: [{ label: "Corporate income tax calculator", href: "/calculators/corporate" }] },
  { term: "Mixed income", aka: ["Mixed-income earner"], definition: "Having both compensation (salary) and business or professional income in the same year." },
  { term: "OPC", aka: ["One Person Corporation"], definition: "A corporation with a single stockholder, registered with the SEC under the Revised Corporation Code." },
  { term: "ORUS", aka: ["Online Registration and Update System"], definition: "The BIR's online system for registering and updating your registration." },
  { term: "OSD", aka: ["Optional standard deduction"], definition: "Instead of listing expenses, individuals may deduct 40% of gross sales or receipts under graduated rates. No receipts are needed for expenses." },
  { term: "Output VAT", definition: "The 12% VAT on your vatable sales, which you collect from customers." },
  { term: "Percentage tax", definition: "A tax of 3% of gross quarterly sales or receipts for non-VAT taxpayers who did not elect the 8% option, filed on Form 2551Q.", see: [{ label: "VAT or percentage tax", href: "/learn/vat-vs-percentage-tax" }] },
  { term: "RCIT", aka: ["Regular corporate income tax"], definition: "The normal income tax rate on a corporation's taxable income: 25%, or 20% for corporations with taxable income of ₱5M or less and total assets (excluding land) of ₱100M or less." },
  { term: "RDO", aka: ["Revenue District Office"], definition: "The BIR office that has jurisdiction over your registered address. Its code is on your COR." },
  { term: "RMC", aka: ["Revenue Memorandum Circular"], definition: "A BIR issuance that clarifies or publishes information about laws and regulations." },
  { term: "RMO", aka: ["Revenue Memorandum Order"], definition: "A BIR issuance with instructions for BIR personnel on procedures, which often affects how taxpayers comply." },
  { term: "RR", aka: ["Revenue Regulations"], definition: "Regulations issued by the Secretary of Finance, on the BIR's recommendation, that implement the tax code." },
  { term: "Substituted filing", definition: "For employees with one employer in the year and correctly withheld tax, the employer's Form 2316 serves as the employee's annual income tax return." },
  { term: "TIN", aka: ["Tax Identification Number"], definition: "Your permanent BIR identification number. TaxGabay never asks for it." },
  { term: "TRAIN", aka: ["RA 10963", "Tax Reform for Acceleration and Inclusion"], definition: "The 2018 tax reform law that, among others, set the current graduated income tax rates, introduced the 8% option and set the ₱3M VAT threshold." },
  { term: "Withholding agent", definition: "A person or business required to withhold tax from payments it makes (such as salaries, rent or professional fees) and remit it to the BIR." },
  { term: "Zonal value", definition: "The BIR's fair market value of real property in an area. Capital gains tax and documentary stamp tax use the higher of the selling price, the zonal value and the assessor's value.", see: [{ label: "Capital gains tax calculator", href: "/calculators/cgt" }] },
];

export const glossary: GlossaryTerm[] = [...terms].sort((a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base", numeric: true }));
